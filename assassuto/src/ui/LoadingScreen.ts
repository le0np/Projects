import { h } from './dom';

/** Full-screen cover art shown while the game boots and while a region / character is loading. */
export class LoadingScreen {
  readonly root: HTMLElement;
  private label: HTMLElement;

  constructor(parent: HTMLElement) {
    this.label = h('div', { class: 'loading-label', text: 'Loading' });
    this.root = h(
      'div',
      { class: 'screen loading-screen cover-bg' },
      h('div', { class: 'loading-box' }, h('div', { class: 'loading-spinner' }), this.label),
    );
    parent.append(this.root);
  }

  show(text = 'Loading'): void {
    this.label.textContent = text;
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }
}
