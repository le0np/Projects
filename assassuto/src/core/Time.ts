/** Game time with a global time scale (used later for slow motion, hitstop and Guardian's Embrace). */
export class Time {
  /** Seconds of game time elapsed (affected by timeScale). */
  elapsed = 0;
  /** Seconds of real time elapsed. */
  realElapsed = 0;
  timeScale = 1;

  advance(realDt: number): number {
    const dt = realDt * this.timeScale;
    this.realElapsed += realDt;
    this.elapsed += dt;
    return dt;
  }
}
