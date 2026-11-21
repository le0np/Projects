/** In-game DOM overlay: stamina, region banner, controls help and debug readout. */
export class Hud {
  readonly root: HTMLElement;
  private staminaEl: HTMLElement;
  private staminaFill: HTMLElement;
  private bannerEl: HTMLElement;
  private helpEl: HTMLElement;
  private debugEl: HTMLElement;
  private pauseEl: HTMLElement;
  private noticeEl: HTMLElement;
  private interactEl: HTMLElement;
  private bannerTimer = 0;
  private staminaVisible = 0;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    this.staminaEl = el('div', 'stamina');
    this.staminaFill = el('div', 'stamina-fill');
    this.staminaEl.append(this.staminaFill);
    this.bannerEl = el('div', 'region-banner');
    this.helpEl = el('div', 'help');
    this.helpEl.innerHTML = `
      <div class="help-title">Controls</div>
      <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</div>
      <div><kbd>Mouse</kbd> Camera &nbsp; <kbd>Wheel</kbd> Zoom</div>
      <div><kbd>Shift</kbd> Sprint &nbsp; <kbd>Ctrl</kbd> Walk</div>
      <div><kbd>Space</kbd> Jump &nbsp; <kbd>C</kbd>/<kbd>Alt</kbd> Dodge</div>
      <div><kbd>LMB</kbd> Light &nbsp; <kbd>RMB</kbd> Heavy &nbsp; <kbd>Q</kbd> Block / parry</div>
      <div><kbd>Tab</kbd> Lock on &nbsp; <kbd>F</kbd> Finisher</div>
      <div><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> Sword / Spear / Unarmed &nbsp; <kbd>X</kbd> Sheathe</div>
      <div><kbd>R</kbd> Elemental ability &nbsp; <kbd>V</kbd> Switch element &nbsp; <kbd>E</kbd> Interact</div>
      <div><kbd>H</kbd> Toggle help &nbsp; <kbd>F3</kbd> Debug</div>
      <div><kbd>Esc</kbd> Pause</div>`;
    this.debugEl = el('div', 'debug');
    this.debugEl.hidden = true;
    this.pauseEl = el('div', 'pause');
    this.pauseEl.innerHTML = `<div class="pause-card"><div class="pause-title">Paused</div>
      <nav class="menu-list">
        <button class="menu-item" data-action="resume"><span>Resume</span></button>
        <button class="menu-item" data-action="save"><span>Save game</span></button>
        <button class="menu-item" data-action="settings"><span>Settings</span></button>
        <button class="menu-item" data-action="menu"><span>Save &amp; quit to main menu</span></button>
      </nav></div>`;
    this.pauseEl.hidden = true;
    this.noticeEl = el('div', 'notice');
    this.noticeEl.hidden = true;
    this.interactEl = el('div', 'interact');
    this.interactEl.hidden = true;
    this.root.append(this.interactEl, this.staminaEl, this.bannerEl, this.helpEl, this.debugEl, this.noticeEl, this.pauseEl);
    parent.append(this.root);
  }

  onPauseAction(handler: (action: 'resume' | 'save' | 'settings' | 'menu') => void): void {
    this.pauseEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (btn) handler(btn.dataset.action as 'resume' | 'save' | 'settings' | 'menu');
    });
  }

  setHelpVisible(v: boolean): void {
    this.helpEl.classList.toggle('hidden', !v);
  }

  showBanner(title: string, subtitle: string): void {
    this.bannerEl.innerHTML = `<div class="banner-sub">${subtitle}</div><div class="banner-title">${title}</div>`;
    this.bannerEl.classList.add('visible');
    this.bannerTimer = 4.5;
  }

  /** "E  Shrine of Fire" style prompt; null hides it. */
  setInteract(text: string | null): void {
    this.interactEl.hidden = !text;
    if (text && this.interactEl.dataset.text !== text) {
      this.interactEl.dataset.text = text;
      this.interactEl.replaceChildren(Object.assign(document.createElement('kbd'), { textContent: 'E' }), document.createTextNode(text));
    }
  }

  notice(text: string | null): void {
    this.noticeEl.hidden = !text;
    this.noticeEl.textContent = text ?? '';
  }

  toggleHelp(): void {
    this.helpEl.classList.toggle('hidden');
  }

  toggleDebug(): void {
    this.debugEl.hidden = !this.debugEl.hidden;
  }

  setPaused(p: boolean): void {
    this.pauseEl.hidden = !p;
  }

  update(dt: number, stamina: number, exhausted: boolean, debug: Record<string, string | number>): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('visible');
    }
    this.staminaVisible = stamina < 0.999 ? 1 : Math.max(0, this.staminaVisible - dt * 1.5);
    this.staminaEl.style.opacity = String(this.staminaVisible);
    this.staminaFill.style.transform = `scaleX(${stamina})`;
    this.staminaEl.classList.toggle('exhausted', exhausted);
    if (!this.debugEl.hidden) {
      this.debugEl.textContent = Object.entries(debug)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    }
  }

  dispose(): void {
    this.root.remove();
  }
}

function el(tag: string, cls: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  return e;
}
