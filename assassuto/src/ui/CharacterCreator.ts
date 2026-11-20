import { ageRange, hairColors, hairStyles, heightRange, suggestedNames, validateName } from '../config/creator';
import { echoConnections, echoForms, echoHues, echoMemoryExamples, echoPersonalities, echoRelationships, type EchoForm, type EchoPersonality } from '../config/echo';
import { elementOrder, elements, type ElementId } from '../config/elements';
import { regionOrder, regions } from '../config/regions';
import { defaultAppearance, type Appearance } from '../entities/appearance';
import { defaultEcho, type EchoConfig } from '../save/SaveSchema';
import { h, hex } from './dom';

export interface CreatorState {
  appearance: Appearance;
  name: string;
  element: ElementId;
  echo: EchoConfig;
  regionId: string;
}

export type CreatorStep = 'appearance' | 'name' | 'element' | 'echo' | 'region' | 'begin';
const STEPS: { id: CreatorStep; title: string }[] = [
  { id: 'appearance', title: 'Appearance' },
  { id: 'name', title: 'Name' },
  { id: 'element', title: 'Element' },
  { id: 'echo', title: 'Your Echo' },
  { id: 'region', title: 'Starting region' },
  { id: 'begin', title: 'Begin' },
];

export interface CreatorHandlers {
  change(state: CreatorState, step: CreatorStep): void;
  finish(state: CreatorState): void;
  cancel(): void;
  /** Drag on the preview area rotates the character. */
  rotatePreview(dx: number): void;
}

export function defaultCreatorState(): CreatorState {
  return {
    appearance: { ...defaultAppearance, hairColor: hairColors[0].hex },
    name: '',
    element: 'earth',
    echo: { ...defaultEcho },
    regionId: elements.earth.startRegion,
  };
}

/** Six-step character creation (GDD 12). The 3D preview is the game canvas behind this panel. */
export class CharacterCreator {
  readonly root: HTMLElement;
  private panel: HTMLElement;
  private body: HTMLElement;
  private stepLabel: HTMLElement;
  private title: HTMLElement;
  private nav: HTMLElement;
  private backBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private error: HTMLElement;
  private step = 0;
  private regionTouched = false;
  state: CreatorState = defaultCreatorState();

  constructor(parent: HTMLElement, private readonly handlers: CreatorHandlers) {
    this.stepLabel = h('div', { class: 'step-label' });
    this.title = h('h2', { class: 'step-title' });
    this.body = h('div', { class: 'creator-body' });
    this.error = h('div', { class: 'form-error', attrs: { role: 'alert' } });
    this.backBtn = h('button', { class: 'btn ghost', text: 'Back', on: { click: () => this.go(-1) } });
    this.nextBtn = h('button', { class: 'btn primary', text: 'Next', attrs: { 'data-next': '' }, on: { click: () => this.go(1) } });
    this.nav = h('div', { class: 'step-dots' });
    this.panel = h('div', { class: 'creator-panel' }, this.stepLabel, this.title, this.nav, this.body, this.error, h('div', { class: 'row between' }, this.backBtn, this.nextBtn));
    const drag = h('div', { class: 'creator-drag', attrs: { title: 'Drag to rotate' } });
    let last: number | null = null;
    drag.addEventListener('pointerdown', (e) => {
      last = e.clientX;
      drag.setPointerCapture(e.pointerId);
    });
    drag.addEventListener('pointermove', (e) => {
      if (last === null) return;
      handlers.rotatePreview(e.clientX - last);
      last = e.clientX;
    });
    drag.addEventListener('pointerup', () => (last = null));
    this.root = h('div', { class: 'screen creator', attrs: { hidden: '' } }, drag, this.panel, h('div', { class: 'drag-hint', text: 'Drag to rotate' }));
    parent.append(this.root);
  }

  open(): void {
    this.state = defaultCreatorState();
    this.regionTouched = false;
    this.step = 0;
    this.root.hidden = false;
    this.render();
    this.emit();
  }

  close(): void {
    this.root.hidden = true;
  }

  get currentStep(): CreatorStep {
    return STEPS[this.step].id;
  }

  private emit(): void {
    this.handlers.change(this.state, this.currentStep);
  }

  private go(delta: number): void {
    if (delta > 0 && !this.validateStep()) return;
    if (delta < 0 && this.step === 0) {
      this.handlers.cancel();
      return;
    }
    if (delta > 0 && this.step === STEPS.length - 1) {
      this.handlers.finish(this.state);
      return;
    }
    this.step += delta;
    this.render();
    this.emit();
  }

  private validateStep(): boolean {
    this.error.textContent = '';
    if (this.currentStep === 'name') {
      const v = validateName(this.state.name);
      if (!v.ok) {
        this.error.textContent = v.error!;
        return false;
      }
      this.state.name = v.value;
    }
    if (this.currentStep === 'echo') {
      const v = validateName(this.state.echo.name);
      if (!v.ok) {
        this.error.textContent = `Echo: ${v.error}`;
        return false;
      }
      this.state.echo.name = v.value;
    }
    return true;
  }

  private render(): void {
    const s = STEPS[this.step];
    this.stepLabel.textContent = `Step ${this.step + 1} of ${STEPS.length}`;
    this.title.textContent = s.title;
    this.error.textContent = '';
    this.backBtn.textContent = this.step === 0 ? 'Main menu' : 'Back';
    this.nextBtn.textContent = this.step === STEPS.length - 1 ? 'Begin journey' : 'Next';
    this.nav.replaceChildren(...STEPS.map((_, i) => h('span', { class: `dot${i === this.step ? ' active' : i < this.step ? ' done' : ''}` })));
    const builders: Record<CreatorStep, () => Node[]> = {
      appearance: () => this.appearanceStep(),
      name: () => this.nameStep(),
      element: () => this.elementStep(),
      echo: () => this.echoStep(),
      region: () => this.regionStep(),
      begin: () => this.summaryStep(),
    };
    this.body.replaceChildren(...builders[s.id]());
  }

  // ---------- controls ----------

  private choice<T extends string>(label: string, options: { value: T; label: string }[], get: () => T, set: (v: T) => void, rerender = false): HTMLElement {
    const group = h('div', { class: 'chips', attrs: { role: 'group', 'aria-label': label } });
    for (const o of options) {
      const b = h('button', { class: 'chip', text: o.label, attrs: { 'data-value': o.value } });
      if (o.value === get()) b.classList.add('selected');
      b.addEventListener('click', () => {
        set(o.value);
        group.querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === b));
        if (rerender) this.render();
        this.emit();
      });
      group.append(b);
    }
    return h('div', { class: 'field-block' }, h('div', { class: 'field-label', text: label }), group);
  }

  private slider(label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string): HTMLElement {
    const out = h('span', { class: 'value', text: fmt(get()) });
    const input = h('input', { attrs: { type: 'range', min: String(min), max: String(max), step: String(step), value: String(get()), 'aria-label': label } });
    input.addEventListener('input', () => {
      set(Number(input.value));
      out.textContent = fmt(Number(input.value));
      this.emit();
    });
    return h('label', { class: 'field' }, h('span', { text: label }), input, out);
  }

  private swatches(label: string, colors: { name: string; hex: number }[], get: () => number, set: (v: number) => void): HTMLElement {
    const group = h('div', { class: 'swatches', attrs: { role: 'group', 'aria-label': label } });
    for (const c of colors) {
      const b = h('button', { class: 'swatch', attrs: { title: c.name, 'aria-label': c.name, style: `--c:${hex(c.hex)}` } });
      if (c.hex === get()) b.classList.add('selected');
      b.addEventListener('click', () => {
        set(c.hex);
        group.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('selected', x === b));
        this.emit();
      });
      group.append(b);
    }
    return h('div', { class: 'field-block' }, h('div', { class: 'field-label', text: label }), group);
  }

  private textInput(label: string, get: () => string, set: (v: string) => void, opts: { max: number; placeholder?: string; multiline?: boolean }): HTMLElement {
    const input = opts.multiline ? h('textarea', { attrs: { rows: '2', maxlength: String(opts.max), placeholder: opts.placeholder ?? '' } }) : h('input', { attrs: { type: 'text', maxlength: String(opts.max), placeholder: opts.placeholder ?? '', autocomplete: 'off', spellcheck: 'false' } });
    input.value = get();
    input.addEventListener('input', () => {
      set(input.value);
      this.error.textContent = '';
    });
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' && !opts.multiline) this.go(1);
    });
    return h('label', { class: 'field-block' }, h('span', { class: 'field-label', text: label }), input);
  }

  // ---------- steps ----------

  private appearanceStep(): Node[] {
    const a = this.state.appearance;
    const styles = hairStyles[a.presentation];
    if (!styles.some((x) => x.id === a.hairStyle)) a.hairStyle = styles[0].id;
    return [
      this.choice('Body', [{ value: 'feminine', label: 'Feminine' }, { value: 'masculine', label: 'Masculine' }], () => a.presentation, (v) => {
        a.presentation = v;
        a.hairStyle = hairStyles[v][0].id;
      }, true),
      this.slider('Age', ageRange.min, ageRange.max, 1, () => a.age, (v) => (a.age = v), (v) => `${v}`),
      this.slider('Height', heightRange.min, heightRange.max, 0.01, () => a.height, (v) => (a.height = v), (v) => `${Math.round(v * (a.presentation === 'feminine' ? 168 : 178))} cm`),
      this.slider('Build', 0, 1, 0.01, () => a.build, (v) => (a.build = v), (v) => (v < 0.25 ? 'Slim' : v < 0.5 ? 'Athletic' : v < 0.75 ? 'Strong' : 'Heavy')),
      this.choice('Hairstyle', styles.map((x) => ({ value: x.id, label: x.label })), () => a.hairStyle, (v) => (a.hairStyle = v)),
      this.swatches('Hair colour', hairColors, () => a.hairColor, (v) => (a.hairColor = v)),
      h('div', { class: 'hint', text: 'Height and build change only how you look, never how you fight.' }),
    ];
  }

  private nameStep(): Node[] {
    const pool = suggestedNames[this.state.appearance.presentation];
    const field = this.textInput('What is your name?', () => this.state.name, (v) => (this.state.name = v), { max: 18, placeholder: 'Enter a name' });
    const suggest = h('div', { class: 'chips' }, ...pool.slice(0, 6).map((n) => h('button', { class: 'chip', text: n, on: { click: () => { this.state.name = n; this.render(); } } })));
    setTimeout(() => (field.querySelector('input') as HTMLInputElement | null)?.focus(), 0);
    return [field, h('div', { class: 'field-label', text: 'Suggestions' }), suggest];
  }

  private elementStep(): Node[] {
    const cards = elementOrder.map((id) => {
      const e = elements[id];
      const r = regions[e.startRegion];
      const b = h('button', { class: `el-card${id === this.state.element ? ' selected' : ''}`, attrs: { 'data-element': id, style: `--el:${hex(e.color)}` } },
        h('span', { class: 'el-name', text: e.name }),
        h('span', { class: 'el-tag', text: e.tagline }),
        h('span', { class: 'el-region', text: `Begins in ${r.name}` }),
      );
      b.addEventListener('click', () => {
        this.state.element = id;
        if (!this.regionTouched) this.state.regionId = e.startRegion;
        this.render();
        this.emit();
      });
      return b;
    });
    return [h('div', { class: 'el-grid' }, ...cards), h('div', { class: 'hint', text: 'You can discover the other elements later in your journey.' })];
  }

  private echoStep(): Node[] {
    const e = this.state.echo;
    return [
      h('p', { class: 'lead', text: 'Someone who mattered never truly left you. Who are they?' }),
      this.textInput('Their name', () => e.name, (v) => (e.name = v), { max: 18 }),
      this.choice('Who were they to you?', echoRelationships.map((r) => ({ value: r, label: r })), () => e.relationship, (v) => (e.relationship = v)),
      this.choice('Personality', (Object.keys(echoPersonalities) as EchoPersonality[]).map((k) => ({ value: k, label: echoPersonalities[k].label })), () => e.personality, (v) => (e.personality = v), true),
      h('div', { class: 'hint', text: echoPersonalities[e.personality].blurb }),
      this.choice('Spirit form', (Object.keys(echoForms) as EchoForm[]).map((k) => ({ value: k, label: echoForms[k].label })), () => e.form, (v) => (e.form = v), true),
      this.swatches('Spirit colour', echoHues.map((c, i) => ({ name: ['Moonlight', 'Ember', 'Twilight', 'Verdant', 'Blossom'][i], hex: c })), () => e.hue, (v) => (e.hue = v)),
      this.textInput('A memory or lesson they left you', () => e.memory, (v) => (e.memory = v), { max: 160, multiline: true, placeholder: echoMemoryExamples[0] }),
      this.choice('The nature of your bond', echoConnections.map((c) => ({ value: c, label: c })), () => e.connection, (v) => (e.connection = v)),
    ];
  }

  private regionStep(): Node[] {
    const rec = elements[this.state.element].startRegion;
    const cards = regionOrder.map((id) => {
      const r = regions[id];
      const e = elements[r.element];
      const b = h('button', { class: `el-card${id === this.state.regionId ? ' selected' : ''}`, attrs: { 'data-region': id, style: `--el:${hex(e.color)}` } },
        h('span', { class: 'el-name', text: r.name }),
        h('span', { class: 'el-tag', text: `${r.subtitle} · ${e.name}` }),
        id === rec ? h('span', { class: 'el-region', text: 'Recommended for your element' }) : null,
      );
      b.addEventListener('click', () => {
        this.state.regionId = id;
        this.regionTouched = true;
        this.render();
        this.emit();
      });
      return b;
    });
    return [h('div', { class: 'el-grid' }, ...cards)];
  }

  private summaryStep(): Node[] {
    const s = this.state;
    const row = (k: string, v: string) => h('div', { class: 'sum-row' }, h('span', { class: 'sum-k', text: k }), h('span', { text: v }));
    return [
      row('Name', s.name),
      row('Element', elements[s.element].name),
      row('Echo', `${s.echo.name} — ${s.echo.relationship}, ${echoPersonalities[s.echo.personality].label.toLowerCase()} ${echoForms[s.echo.form].label.toLowerCase()} spirit`),
      row('Bond', s.echo.connection),
      s.echo.memory.trim() ? row('Memory', `“${s.echo.memory.trim()}”`) : null,
      row('Region', `${regions[s.regionId].name}, ${regions[s.regionId].subtitle}`),
    ].filter((x): x is HTMLDivElement => x !== null);
  }
}
