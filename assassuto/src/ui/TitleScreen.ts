import { elementOrder, elements, type ElementId } from '../config/elements';
import { regions } from '../config/regions';

export interface TitleChoice {
  element: ElementId;
  presentation: 'feminine' | 'masculine';
}

/**
 * Phase 1 title screen: pick an element (which picks the starting region) and a body preset, then enter.
 * Replaced in phase 2 by the real main menu and character creator.
 */
export class TitleScreen {
  readonly root: HTMLElement;
  private choice: TitleChoice;

  constructor(parent: HTMLElement, initial: TitleChoice, onEnter: (c: TitleChoice) => void) {
    this.choice = { ...initial };
    this.root = document.createElement('div');
    this.root.className = 'title';
    const cards = elementOrder
      .map((id) => {
        const e = elements[id];
        const r = regions[e.startRegion];
        const hex = `#${e.color.toString(16).padStart(6, '0')}`;
        return `<button class="el-card" data-element="${id}" style="--el:${hex}">
          <span class="el-name">${e.name}</span>
          <span class="el-tag">${e.tagline}</span>
          <span class="el-region">${r.name}<br><small>${r.subtitle}</small></span>
        </button>`;
      })
      .join('');
    this.root.innerHTML = `
      <div class="title-inner">
        <div class="logo"><span class="logo-pre">Project</span><span class="logo-main">Fourfold</span></div>
        <div class="title-sub">Prototype · Phase 1 — movement, camera and the four regions</div>
        <div class="el-cards">${cards}</div>
        <div class="row">
          <div class="seg" role="group" aria-label="Body">
            <button data-pres="feminine">Feminine</button>
            <button data-pres="masculine">Masculine</button>
          </div>
          <button class="btn primary" data-enter>Enter world</button>
        </div>
        <div class="title-foot">Placeholder characters are shown until the Tripo models are generated.</div>
      </div>`;
    parent.append(this.root);
    this.root.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest('button');
      if (!t) return;
      if (t.dataset.element) this.choice.element = t.dataset.element as ElementId;
      if (t.dataset.pres) this.choice.presentation = t.dataset.pres as TitleChoice['presentation'];
      if (t.hasAttribute('data-enter')) onEnter({ ...this.choice });
      this.sync();
    });
    this.sync();
  }

  private sync(): void {
    this.root.querySelectorAll<HTMLElement>('[data-element]').forEach((b) => b.classList.toggle('selected', b.dataset.element === this.choice.element));
    this.root.querySelectorAll<HTMLElement>('[data-pres]').forEach((b) => b.classList.toggle('selected', b.dataset.pres === this.choice.presentation));
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }
}
