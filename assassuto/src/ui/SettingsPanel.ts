import type { Settings } from '../save/Settings';
import { h } from './dom';

/** Modal settings dialog shared by the main menu and the pause menu. Changes apply immediately. */
export class SettingsPanel {
  readonly root: HTMLElement;
  private settings!: Settings;
  private body: HTMLElement;

  constructor(parent: HTMLElement, private readonly onChange: (s: Settings) => void) {
    this.body = h('div', { class: 'form' });
    this.root = h(
      'div',
      { class: 'modal', attrs: { hidden: '' } },
      h('div', { class: 'modal-card' }, h('h2', { text: 'Settings' }), this.body, h('div', { class: 'row end' }, h('button', { class: 'btn primary', text: 'Done', on: { click: () => this.close() } }))),
    );
    parent.append(this.root);
  }

  open(s: Settings): void {
    this.settings = { ...s };
    this.render();
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  private set<K extends keyof Settings>(k: K, v: Settings[K]): void {
    this.settings[k] = v;
    this.onChange({ ...this.settings });
  }

  private render(): void {
    const s = this.settings;
    const slider = (label: string, key: 'masterVolume' | 'mouseSensitivity', min: number, max: number, step: number, fmt: (v: number) => string) => {
      const out = h('span', { class: 'value', text: fmt(s[key]) });
      const input = h('input', { attrs: { type: 'range', min: String(min), max: String(max), step: String(step), value: String(s[key]), 'aria-label': label } });
      input.addEventListener('input', () => {
        const v = Number(input.value);
        out.textContent = fmt(v);
        this.set(key, v);
      });
      return h('label', { class: 'field' }, h('span', { text: label }), input, out);
    };
    const toggle = (label: string, key: 'invertY' | 'showControls') => {
      const input = h('input', { attrs: { type: 'checkbox' } });
      input.checked = s[key];
      input.addEventListener('change', () => this.set(key, input.checked));
      return h('label', { class: 'field check' }, input, h('span', { text: label }));
    };
    const quality = h('select', { attrs: { 'aria-label': 'Graphics quality' } });
    for (const q of ['low', 'medium', 'high'] as const) {
      const o = h('option', { text: q[0].toUpperCase() + q.slice(1), attrs: { value: q } });
      if (q === s.quality) o.selected = true;
      quality.append(o);
    }
    quality.addEventListener('change', () => this.set('quality', quality.value as Settings['quality']));
    this.body.replaceChildren(
      slider('Master volume', 'masterVolume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`),
      h('div', { class: 'hint', text: 'Audio arrives in a later phase; the level is already saved.' }),
      slider('Mouse sensitivity', 'mouseSensitivity', 0.2, 3, 0.05, (v) => `${v.toFixed(2)}×`),
      toggle('Invert camera Y axis', 'invertY'),
      h('label', { class: 'field' }, h('span', { text: 'Graphics quality' }), quality),
      toggle('Show controls panel in game', 'showControls'),
    );
  }
}
