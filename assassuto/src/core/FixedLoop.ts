/**
 * Fixed-timestep accumulator. Logic runs at a constant rate regardless of frame rate;
 * `alpha` tells the renderer how far it is between the last two logic steps.
 */
export class FixedLoop {
  private accumulator = 0;

  constructor(
    readonly step: number,
    private readonly maxStepsPerFrame = 5,
  ) {}

  /** Returns how many logic steps to run this frame and the interpolation factor. */
  advance(dt: number): { steps: number; alpha: number } {
    this.accumulator += Math.min(dt, this.step * this.maxStepsPerFrame);
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.maxStepsPerFrame) {
      this.accumulator -= this.step;
      steps++;
    }
    if (steps === this.maxStepsPerFrame) this.accumulator = Math.min(this.accumulator, this.step);
    return { steps, alpha: this.accumulator / this.step };
  }
}
