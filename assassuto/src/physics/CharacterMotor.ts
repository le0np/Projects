import { playerConfig, type PlayerConfig } from '../config/player';

/** Vertical cylinder obstacle (tree trunks, rocks, pillars). */
export interface CylinderCollider {
  x: number;
  z: number;
  radius: number;
  bottom: number;
  top: number;
}

/** What the motor needs to know about the world. Kept tiny so physics can be swapped (e.g. Rapier) later. */
export interface CollisionWorld {
  heightAt(x: number, z: number): number;
  /** Uphill direction (dh/dx, dh/dz) at a point; used for the slope limit. */
  gradientAt?(x: number, z: number): [number, number];
  /** Colliders near a point; implementations may use a spatial grid. */
  collidersNear(x: number, z: number, radius: number): Iterable<CylinderCollider>;
  /** Players cannot leave this radius around the origin. */
  boundsRadius: number;
}

export interface MotorInput {
  /** Desired horizontal direction (world space, length 0..1). */
  moveX: number;
  moveZ: number;
  /** Desired speed in m/s. */
  speed: number;
  jump: boolean;
}

export type MotorEvent = { type: 'jumped' } | { type: 'landed'; fallSpeed: number };

/** Kinematic capsule controller: acceleration-based movement, gravity, jump buffering and coyote time. */
export class CharacterMotor {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  grounded = true;
  /** Multiplier on gravity (wind skill falls slower). */
  gravityScale = 1;
  private airTime = 0;
  private jumpBufferTimer = 0;
  private jumpedThisAir = false;

  constructor(private readonly cfg: PlayerConfig = playerConfig) {}

  teleport(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.grounded = true;
    this.airTime = 0;
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  step(dt: number, input: MotorInput, world: CollisionWorld): MotorEvent[] {
    const cfg = this.cfg;
    const events: MotorEvent[] = [];

    // Horizontal velocity approaches the wish velocity.
    const wishX = input.moveX * input.speed;
    const wishZ = input.moveZ * input.speed;
    const hasInput = input.moveX !== 0 || input.moveZ !== 0;
    const accel = this.grounded ? (hasInput ? cfg.groundAccel : cfg.groundDecel) : cfg.airAccel;
    const dvx = wishX - this.vx;
    const dvz = wishZ - this.vz;
    const dvLen = Math.hypot(dvx, dvz);
    const maxDv = accel * dt;
    if (dvLen <= maxDv) {
      this.vx = wishX;
      this.vz = wishZ;
    } else if (this.grounded || hasInput) {
      this.vx += (dvx / dvLen) * maxDv;
      this.vz += (dvz / dvLen) * maxDv;
    }

    // Jump with buffering and coyote time.
    if (input.jump) this.jumpBufferTimer = cfg.jumpBuffer;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    const canJump = !this.jumpedThisAir && (this.grounded || this.airTime < cfg.coyoteTime);
    if (this.jumpBufferTimer > 0 && canJump) {
      this.vy = cfg.jumpVelocity;
      this.grounded = false;
      this.jumpedThisAir = true;
      this.jumpBufferTimer = 0;
      events.push({ type: 'jumped' });
    }

    if (!this.grounded) {
      this.vy = Math.max(this.vy - cfg.gravity * this.gravityScale * dt, -cfg.maxFallSpeed);
      this.airTime += dt;
    }

    const prevX = this.x;
    const prevZ = this.z;
    const prevGround = world.heightAt(prevX, prevZ);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.y += this.vy * dt;

    // Slope limit: too-steep terrain blocks uphill movement and makes the player slide along it.
    if (this.grounded && world.gradientAt) {
      const moved = Math.hypot(this.x - prevX, this.z - prevZ);
      const rise = world.heightAt(this.x, this.z) - prevGround;
      if (moved > 1e-5 && rise / moved > cfg.maxWalkSlope) {
        const [gx, gz] = world.gradientAt(this.x, this.z);
        const gl = Math.hypot(gx, gz) || 1;
        const ux = gx / gl;
        const uz = gz / gl;
        this.x = prevX;
        this.z = prevZ;
        const up = this.vx * ux + this.vz * uz;
        if (up > 0) {
          this.vx -= up * ux;
          this.vz -= up * uz;
        }
        this.x += this.vx * dt;
        this.z += this.vz * dt;
        if ((world.heightAt(this.x, this.z) - prevGround) / Math.max(1e-5, Math.hypot(this.x - prevX, this.z - prevZ)) > cfg.maxWalkSlope) {
          this.x = prevX;
          this.z = prevZ;
        }
      }
    }

    this.resolveColliders(world);
    this.clampBounds(world);

    // Ground contact.
    const ground = world.heightAt(this.x, this.z);
    if (this.grounded) {
      if (this.y - ground > cfg.groundSnap) {
        this.grounded = false; // walked off a ledge
        this.airTime = 0;
        this.vy = 0;
      } else {
        this.y = ground;
        this.vy = 0;
      }
    } else if (this.y <= ground && this.vy <= 0) {
      events.push({ type: 'landed', fallSpeed: -this.vy });
      this.y = ground;
      this.vy = 0;
      this.grounded = true;
      this.airTime = 0;
      this.jumpedThisAir = false;
    } else if (this.y < ground) {
      this.y = ground; // moving up into a slope
    }
    if (this.grounded) this.jumpedThisAir = false;
    return events;
  }

  private resolveColliders(world: CollisionWorld): void {
    const r = this.cfg.capsuleRadius;
    for (const c of world.collidersNear(this.x, this.z, r + 4)) {
      if (this.y >= c.top || this.y + this.cfg.capsuleHeight <= c.bottom) continue;
      const dx = this.x - c.x;
      const dz = this.z - c.z;
      const min = r + c.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.0001;
      const nx = dx / d;
      const nz = dz / d;
      this.x = c.x + nx * min;
      this.z = c.z + nz * min;
      // Remove velocity into the obstacle so the player slides around it.
      const into = this.vx * nx + this.vz * nz;
      if (into < 0) {
        this.vx -= into * nx;
        this.vz -= into * nz;
      }
    }
  }

  private clampBounds(world: CollisionWorld): void {
    const d = Math.hypot(this.x, this.z);
    if (d > world.boundsRadius) {
      const k = world.boundsRadius / d;
      this.x *= k;
      this.z *= k;
      const nx = this.x / world.boundsRadius;
      const nz = this.z / world.boundsRadius;
      const out = this.vx * nx + this.vz * nz;
      if (out > 0) {
        this.vx -= out * nx;
        this.vz -= out * nz;
      }
    }
  }
}
