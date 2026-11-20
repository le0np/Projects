import { elements } from '../config/elements';
import { regions } from '../config/regions';
import type { SaveData } from '../save/SaveSchema';
import { formatPlayTime, h } from './dom';

export interface MainMenuHandlers {
  newGame(): void;
  continueGame(): void;
  settings(): void;
  credits(): void;
}

export class MainMenu {
  readonly root: HTMLElement;
  private continueBtn: HTMLButtonElement;
  private continueSub: HTMLElement;
  private confirm: HTMLElement;

  constructor(parent: HTMLElement, private readonly handlers: MainMenuHandlers) {
    this.continueSub = h('span', { class: 'menu-sub' });
    this.continueBtn = h('button', { class: 'menu-item', attrs: { 'data-menu': 'continue' }, on: { click: () => handlers.continueGame() } }, h('span', { text: 'Continue' }), this.continueSub);
    this.confirm = h(
      'div',
      { class: 'confirm', attrs: { hidden: '' } },
      h('p', { text: 'Starting a new game will replace your current journey.' }),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn ghost', text: 'Cancel', on: { click: () => (this.confirm.hidden = true) } }),
        h('button', { class: 'btn primary', text: 'Start anew', attrs: { 'data-confirm': '' }, on: { click: () => handlers.newGame() } }),
      ),
    );
    this.root = h(
      'div',
      { class: 'screen main-menu' },
      h(
        'div',
        { class: 'menu-col' },
        h('div', { class: 'logo' }, h('span', { class: 'logo-pre', text: 'Project' }), h('span', { class: 'logo-main', text: 'Fourfold' })),
        h(
          'nav',
          { class: 'menu-list' },
          h('button', { class: 'menu-item', attrs: { 'data-menu': 'new' }, on: { click: () => this.onNew() } }, h('span', { text: 'New Game' })),
          this.continueBtn,
          h('button', { class: 'menu-item', attrs: { 'data-menu': 'settings' }, on: { click: () => handlers.settings() } }, h('span', { text: 'Settings' })),
          h('button', { class: 'menu-item', attrs: { 'data-menu': 'credits' }, on: { click: () => handlers.credits() } }, h('span', { text: 'Credits' })),
        ),
        this.confirm,
      ),
      h('div', { class: 'menu-foot', text: 'Prototype · phase 2' }),
    );
    parent.append(this.root);
  }

  private hasSave = false;
  private onNew(): void {
    if (this.hasSave) this.confirm.hidden = false;
    else this.handlers.newGame();
  }

  show(save: SaveData | null): void {
    this.hasSave = !!save;
    this.confirm.hidden = true;
    this.continueBtn.disabled = !save;
    this.continueSub.textContent = save
      ? `${save.character.name} · ${elements[save.character.element].name} · ${regions[save.world.regionId].name} · ${formatPlayTime(save.playTime)}`
      : 'No saved journey';
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
