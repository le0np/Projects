import { h } from './dom';

export class CreditsPanel {
  readonly root: HTMLElement;
  constructor(parent: HTMLElement) {
    const line = (role: string, who: string) => h('div', { class: 'credit' }, h('span', { class: 'credit-role', text: role }), h('span', { text: who }));
    this.root = h(
      'div',
      { class: 'modal', attrs: { hidden: '' } },
      h(
        'div',
        { class: 'modal-card' },
        h('h2', { text: 'Credits' }),
        line('Concept & game design', 'Leon'),
        line('Programming, world & effects', 'Claude (Anthropic)'),
        line('3D characters', 'Generated with Tripo AI from original prompts'),
        line('Engine', 'three.js (MIT)'),
        line('Fonts', 'Cinzel, Nunito Sans (SIL Open Font License)'),
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', text: 'Close', on: { click: () => (this.root.hidden = true) } })),
      ),
    );
    parent.append(this.root);
  }
  open(): void {
    this.root.hidden = false;
  }
}
