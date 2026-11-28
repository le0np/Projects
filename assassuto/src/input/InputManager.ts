import { defaultBindings, type Action } from './actions';

/**
 * Collects keyboard and mouse state between logic steps.
 * `pressed` is edge-triggered and survives until the next `endStep`, so quick taps are never lost
 * even when several frames pass between fixed logic steps.
 */
export class InputManager {
  private down = new Set<string>();
  private pressedCodes = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private wheel = 0;
  private codeToActions = new Map<string, Action[]>();
  pointerLocked = false;

  constructor(
    private readonly element: HTMLElement,
    bindings: Record<Action, string[]> = defaultBindings,
  ) {
    for (const [action, codes] of Object.entries(bindings) as [Action, string[]][]) {
      for (const code of codes) {
        const list = this.codeToActions.get(code) ?? [];
        list.push(action);
        this.codeToActions.set(code, list);
      }
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  requestPointerLock(): void {
    if (this.pointerLocked) return;
    try {
      // Returns a promise in modern browsers; it rejects without a user gesture (e.g. automated tests).
      const r = this.element.requestPointerLock?.() as unknown as Promise<void> | undefined;
      r?.catch?.(() => {});
    } catch {
      /* pointer lock unavailable */
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock?.();
  }

  isDown(action: Action): boolean {
    for (const code of this.down) if (this.codeToActions.get(code)?.includes(action)) return true;
    return false;
  }

  wasPressed(action: Action): boolean {
    for (const code of this.pressedCodes) if (this.codeToActions.get(code)?.includes(action)) return true;
    return false;
  }

  /** Mouse movement accumulated since the last call. */
  consumeMouse(): { dx: number; dy: number; wheel: number } {
    const r = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheel };
    this.mouseDX = this.mouseDY = this.wheel = 0;
    return r;
  }

  /** Call after each logic step to clear edge-triggered presses. */
  endStep(): void {
    this.pressedCodes.clear();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
  }

  /** Mouse buttons only count while the pointer is locked, so the click that grabs the mouse never attacks. */
  private onMouseDown = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    const code = `Mouse${e.button}`;
    if (e.button === 1) e.preventDefault();
    this.down.add(code);
    this.pressedCodes.add(code);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.down.delete(`Mouse${e.button}`);
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.codeToActions.has(e.code)) {
      if (e.code === 'Space' || e.code === 'Tab' || e.code === 'AltLeft' || e.code.startsWith('Arrow') || e.code === 'F1' || e.code === 'F3') e.preventDefault();
      if (!e.repeat) this.pressedCodes.add(e.code);
    }
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  private onBlur = () => {
    this.down.clear();
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.mouseDX += e.movementX;
    this.mouseDY += e.movementY;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.wheel += Math.sign(e.deltaY);
  };

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.element;
  };
}
