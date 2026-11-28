/** All player movement tuning lives here. Values are in metres and seconds. */
export const playerConfig = {
  capsuleRadius: 0.4,
  capsuleHeight: 1.8,
  walkSpeed: 2.2,
  runSpeed: 5.5,
  sprintSpeed: 8.5,
  groundAccel: 38,
  groundDecel: 30,
  airAccel: 9,
  gravity: 26,
  jumpVelocity: 9.2,
  /** Grace time after leaving a ledge during which jump still works. */
  coyoteTime: 0.12,
  /** Jump presses are remembered this long before landing. */
  jumpBuffer: 0.15,
  maxFallSpeed: 40,
  /** Max height the motor snaps down to stay grounded when walking downhill. */
  groundSnap: 0.6,
  turnRate: 14,
  /** Rise over run the player can still walk up (1 = 45 degrees). */
  maxWalkSlope: 1.0,
  stamina: {
    max: 100,
    sprintCostPerSec: 18,
    jumpCost: 8,
    regenPerSec: 26,
    regenDelay: 0.8,
    /** After running dry, sprint is locked until stamina is back above this. */
    exhaustedThreshold: 30,
  },
} as const;

export type PlayerConfig = typeof playerConfig;
