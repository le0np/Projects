import * as THREE from 'three';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { abilities } from '../config/abilities';
import { elementOrder, elements } from '../config/elements';
import { h, hex } from './dom';

/**
 * Combat overlay: player health, enemy health bars (projected over heads), lock-on reticle,
 * finisher prompt, combo counter, floating damage numbers and the defeat screen.
 */
export class CombatHud {
  readonly root: HTMLElement;
  private hpFill: HTMLElement;
  private hpText: HTMLElement;
  private nameEl: HTMLElement;
  private weaponEl: HTMLElement;
  private bars = new Map<string, { el: HTMLElement; fill: HTMLElement }>();
  private reticle: HTMLElement;
  private prompt: HTMLElement;
  private combo: HTMLElement;
  private popups: { el: HTMLElement; pos: THREE.Vector3; t: number }[] = [];
  private defeat: HTMLElement;
  private v = new THREE.Vector3();
  private abilitySlots = new Map<string, { el: HTMLElement; cd: HTMLElement; time: HTMLElement }>();
  private abilityName: HTMLElement;
  private lastFail = 0;

  constructor(parent: HTMLElement) {
    this.hpFill = h('div', { class: 'hp-fill' });
    this.hpText = h('div', { class: 'hp-text' });
    this.nameEl = h('div', { class: 'hp-name' });
    this.weaponEl = h('div', { class: 'hp-weapon' });
    this.reticle = h('div', { class: 'reticle', attrs: { hidden: '' } });
    this.prompt = h('div', { class: 'prompt', attrs: { hidden: '' } }, h('kbd', { text: 'F' }), h('span', { text: 'Finisher' }));
    this.combo = h('div', { class: 'combo', attrs: { hidden: '' } });
    this.defeat = h('div', { class: 'defeat', attrs: { hidden: '' } }, h('div', { class: 'defeat-title', text: 'You have fallen' }), h('div', { class: 'defeat-sub', text: 'Returning to the shrine…' }));
    const slots = elementOrder.map((el) => {
      const cd = h('div', { class: 'ab-cd' });
      const time = h('div', { class: 'ab-time' });
      const slot = h('div', { class: 'ab-slot', attrs: { 'data-element': el, style: `--el:${hex(elements[el].color)};--glow:${hex(elements[el].glow)}` } }, abilityIcon(el), cd, time);
      this.abilitySlots.set(el, { el: slot, cd, time });
      return slot;
    });
    this.abilityName = h('div', { class: 'ab-name' });
    this.root = h(
      'div',
      { class: 'combat-hud' },
      h('div', { class: 'abilities' }, h('div', { class: 'ab-row' }, ...slots), this.abilityName, h('div', { class: 'ab-keys' }, h('kbd', { text: 'R' }), 'cast ', h('kbd', { text: 'V' }), 'switch')),
      h('div', { class: 'hp' }, this.nameEl, h('div', { class: 'hp-bar' }, this.hpFill, this.hpText), this.weaponEl),
      this.reticle,
      this.prompt,
      this.combo,
      this.defeat,
    );
    parent.append(this.root);
  }

  setDefeated(v: boolean): void {
    this.defeat.hidden = !v;
  }

  popup(at: THREE.Vector3, text: string, kind: 'damage' | 'crit' | 'player' | 'info'): void {
    const el = h('div', { class: `pop ${kind}`, text });
    this.root.append(el);
    this.popups.push({ el, pos: at.clone(), t: 0 });
  }

  private project(p: THREE.Vector3, camera: THREE.Camera, w: number, hgt: number): { x: number; y: number; on: boolean } {
    this.v.copy(p).project(camera);
    return { x: (this.v.x * 0.5 + 0.5) * w, y: (-this.v.y * 0.5 + 0.5) * hgt, on: this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2 };
  }

  update(dt: number, now: number, camera: THREE.Camera, player: Player, playerName: string, enemies: Enemy[], lock: Enemy | null, finisherReady: boolean, combo: number): void {
    const w = this.root.clientWidth || window.innerWidth;
    const hgt = this.root.clientHeight || window.innerHeight;
    const c = player.combatant;
    const ratio = c.health / c.opts.maxHealth;
    this.hpFill.style.transform = `scaleX(${ratio})`;
    this.hpFill.classList.toggle('low', ratio < 0.3);
    this.hpText.textContent = `${Math.ceil(c.health)} / ${c.opts.maxHealth}`;
    this.nameEl.textContent = playerName;
    this.weaponEl.textContent = `${player.weapon.name}  ·  1 Sword  2 Spear  3 Unarmed  X Sheathe/Draw`;
    this.updateAbilities(player);

    const seen = new Set<string>();
    for (const e of enemies) {
      const show = e.alive && (e === lock || now - e.lastHurt < 5 || e.brain === 'attack' || e.brain === 'circle');
      if (!show) continue;
      const p = this.project(this.v.set(e.renderPosition.x, e.renderPosition.y + 2.35 * e.def.look.scale, e.renderPosition.z), camera, w, hgt);
      if (!p.on) continue;
      seen.add(e.id);
      let bar = this.bars.get(e.id);
      if (!bar) {
        const fill = h('div', { class: 'eb-fill' });
        const el = h('div', { class: 'enemy-bar' }, h('div', { class: 'eb-name', text: e.def.name }), h('div', { class: 'eb-track' }, fill));
        this.root.append(el);
        bar = { el, fill };
        this.bars.set(e.id, bar);
      }
      bar.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      bar.fill.style.transform = `scaleX(${e.combatant.health / e.def.maxHealth})`;
      bar.el.classList.toggle('vulnerable', e.combatant.state === 'vulnerable');
      bar.el.classList.toggle('locked', e === lock);
    }
    for (const [id, bar] of this.bars) if (!seen.has(id)) {
      bar.el.remove();
      this.bars.delete(id);
    }

    this.reticle.hidden = true;
    if (lock) {
      const p = this.project(this.v.set(lock.renderPosition.x, lock.renderPosition.y + 1.2, lock.renderPosition.z), camera, w, hgt);
      this.reticle.hidden = !p.on;
      this.reticle.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    }
    this.prompt.hidden = !finisherReady;
    this.combo.hidden = combo < 3;
    if (combo >= 3) this.combo.textContent = `${combo} HITS`;

    this.popups = this.popups.filter((pp) => {
      pp.t += dt;
      const p = this.project(this.v.copy(pp.pos).add(new THREE.Vector3(0, pp.t * 0.9, 0)), camera, w, hgt);
      pp.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
      pp.el.style.opacity = String(Math.max(0, 1 - Math.max(0, pp.t - 0.6) / 0.5));
      if (pp.t > 1.1 || !p.on) {
        pp.el.remove();
        return false;
      }
      return true;
    });
  }

  private updateAbilities(player: Player): void {
    const ab = player.abilities;
    for (const [el, slot] of this.abilitySlots) {
      const id = el as keyof typeof abilities;
      const unlocked = ab.unlocked.has(id);
      const cd = ab.cooldownOf(id);
      slot.el.classList.toggle('locked', !unlocked);
      slot.el.classList.toggle('selected', ab.selected === id);
      slot.el.classList.toggle('ready', unlocked && cd <= 0);
      slot.el.classList.toggle('active', (id === 'earth' && player.aegisT > 0) || player.cast?.def.element === id);
      slot.cd.style.setProperty('--cd', String(unlocked ? ab.cooldownRatio(id) : 0));
      slot.time.textContent = unlocked && cd > 0 ? String(Math.ceil(cd)) : '';
      slot.el.title = unlocked ? abilities[id].name : 'Attune at this element\'s shrine to unlock';
    }
    const sel = abilities[ab.selected];
    this.abilityName.textContent = sel.name;
    const fail = player.castFailed;
    if (fail && fail.at !== this.lastFail) {
      this.lastFail = fail.at;
      const slot = this.abilitySlots.get(ab.selected)?.el;
      slot?.classList.remove('denied');
      void slot?.offsetWidth;
      slot?.classList.add('denied');
    }
  }

  clear(): void {
    for (const b of this.bars.values()) b.el.remove();
    this.bars.clear();
    for (const p of this.popups) p.el.remove();
    this.popups = [];
    this.defeat.hidden = true;
  }
}

/** Inline SVG icons for the ability slots (constant markup, no user text). */
const abilityPaths: Record<string, string> = {
  fire: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-9.5z',
  water: 'M12 2.5c3 4.5 6 8 6 11.5a6 6 0 0 1-12 0c0-3.5 3-7 6-11.5z',
  earth: 'M2 20l6-10 3.5 5 3-4.5L22 20z',
  air: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8',
};

function abilityIcon(el: string): HTMLElement {
  const wrap = h('div', { class: 'ab-icon' });
  const stroke = el === 'air';
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="${abilityPaths[el]}" fill="${stroke ? 'none' : 'currentColor'}" stroke="${stroke ? 'currentColor' : 'none'}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
  return wrap;
}
