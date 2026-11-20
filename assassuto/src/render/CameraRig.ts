import * as THREE from 'three';
import { cameraConfig } from '../config/camera';
import { clamp, damp } from '../core/math';

/**
 * Third-person orbit camera. Yaw/pitch come from the mouse; the camera stays above the terrain
 * and pulls in when the ground would block the view.
 */
export class CameraRig {
  yaw = Math.PI;
  pitch: number = cameraConfig.startPitch;
  private distance: number = cameraConfig.distance;
  private targetDistance: number = cameraConfig.distance;
  private focus = new THREE.Vector3();
  private initialised = false;
  private fovBoost = 0;
  sensitivity: number = cameraConfig.mouseSensitivity;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly heightAt: (x: number, z: number) => number,
  ) {}

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity;
    this.pitch = clamp(this.pitch + dy * this.sensitivity, cameraConfig.pitchMin, cameraConfig.pitchMax);
  }

  zoom(steps: number): void {
    this.targetDistance = clamp(this.targetDistance + steps * 0.7, cameraConfig.minDistance, cameraConfig.maxDistance);
  }

  /** Horizontal forward vector of the camera (for camera-relative movement). */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  snapBehind(facing: number): void {
    this.yaw = facing + Math.PI;
    this.initialised = false;
  }

  update(dt: number, target: THREE.Vector3, sprinting: boolean): void {
    const goal = new THREE.Vector3(target.x, target.y + cameraConfig.targetHeight, target.z);
    if (!this.initialised) {
      this.focus.copy(goal);
      this.initialised = true;
    } else {
      this.focus.lerp(goal, damp(cameraConfig.followRate, dt));
    }
    this.distance += (this.targetDistance - this.distance) * damp(cameraConfig.zoomRate, dt);
    this.fovBoost += ((sprinting ? cameraConfig.sprintFovBoost : 0) - this.fovBoost) * damp(4, dt);

    const cp = Math.cos(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = this.focus.clone().addScaledVector(right, cameraConfig.shoulderOffset);

    // Pull the camera in if terrain blocks the line from pivot to camera.
    let dist = this.distance;
    for (let i = 1; i <= 8; i++) {
      const t = (i / 8) * dist;
      const p = pivot.clone().addScaledVector(dir, t);
      if (p.y < this.heightAt(p.x, p.z) + cameraConfig.groundClearance) {
        dist = Math.max(cameraConfig.minDistance * 0.6, t * 0.9);
        break;
      }
    }
    const pos = pivot.clone().addScaledVector(dir, dist);
    pos.y = Math.max(pos.y, this.heightAt(pos.x, pos.z) + cameraConfig.groundClearance);

    this.camera.position.copy(pos);
    this.camera.lookAt(pivot);
    const fov = cameraConfig.fov + this.fovBoost;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
