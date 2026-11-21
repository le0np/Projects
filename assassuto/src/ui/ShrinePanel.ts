import { abilities } from '../config/abilities';
import { elements, type ElementId } from '../config/elements';
import { regions } from '../config/regions';
import { h } from './dom';

export interface ShrineView {
  regionId: string;
  attuned: boolean;
  /** Elements whose ability the player already has. */
  unlocked: ElementId[];
  /** Ids of discovered shrines, by region. */
  attunedRegions: string[];
  waystones: { name: string; lit: boolean }[];
}

export interface ShrineHandlers {
  attune(): void;
  rest(): void;
  travel(regionId: string): void;
  close(): void;
}

/** Shrine menu (E at a shrine): attune to unlock the element, rest to recover, travel between regions. */
export class ShrinePanel {
  readonly root: HTMLElement;
  private card: HTMLElement;

  constructor(parent: HTMLElement, private readonly handlers: ShrineHandlers) {
    this.card = h('div', { class: 'modal-card shrine-card' });
    this.root = h('div', { class: 'modal shrine', attrs: { hidden: '' } }, this.card);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.handlers.close();
    });
    parent.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(v: ShrineView): void {
    this.render(v);
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  render(v: ShrineView): void {
    const region = regions[v.regionId];
    const el = elements[region.element];
    const ability = abilities[region.element];
    const knows = v.unlocked.includes(region.element);
    const status = v.attuned
      ? h('p', { class: 'shrine-status' }, 'You are attuned to this shrine. ', h('strong', { text: ability.name }), knows ? ' is yours.' : '')
      : h(
          'p',
          { class: 'shrine-status' },
          `The ${el.name.toLowerCase()} crystal hums, waiting. Attune to `,
          knows ? 'mark it as a place of rest.' : h('strong', { text: `learn ${ability.name}` }),
          knows ? '' : ` — ${ability.description}`,
        );
    const actions = h('div', { class: 'shrine-actions' });
    if (!v.attuned) actions.append(h('button', { class: 'btn primary', text: `Attune to ${el.name}`, attrs: { 'data-shrine': 'attune' }, on: { click: () => this.handlers.attune() } }));
    actions.append(h('button', { class: 'btn ghost', text: 'Rest — restore health and abilities', attrs: { 'data-shrine': 'rest' }, on: { click: () => this.handlers.rest() } }));

    const travel = h('div', { class: 'shrine-travel' });
    for (const r of Object.values(regions)) {
      const here = r.id === v.regionId;
      const known = v.attunedRegions.includes(r.id);
      const btn = h(
        'button',
        { class: 'btn ghost', attrs: { 'data-travel': r.id }, on: { click: () => this.handlers.travel(r.id) } },
        r.name,
        h('small', { text: here ? 'You are here' : known ? `${elements[r.element].name} · attuned` : `${elements[r.element].name} · ${r.direction}, unexplored` }),
      );
      btn.disabled = here;
      travel.append(btn);
    }

    const lit = v.waystones.filter((w) => w.lit).length;
    const disc = h(
      'div',
      { class: 'shrine-discoveries' },
      ...v.waystones.map((w) => h('div', { text: `${w.lit ? '◆' : '◇'} ${w.lit ? w.name : 'Unlit waystone'}` })),
    );

    this.card.replaceChildren(
      h('div', { class: 'shrine-sub', text: `Shrine of ${el.name}` }),
      h('h2', { text: region.name }),
      status,
      actions,
      h('div', { class: 'shrine-h', text: 'Journey' }),
      travel,
      h('div', { class: 'shrine-h', text: `Waystones ${lit} / ${v.waystones.length}` }),
      disc,
      h('div', { class: 'row end' }, h('button', { class: 'btn ghost', text: 'Leave', attrs: { 'data-shrine': 'close' }, on: { click: () => this.handlers.close() } })),
    );
  }
}
