# Torba i škrinja: sortiranje i povlačenje – plan izvedbe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gumb „Sortiraj“ po količini i premještanje predmeta mišem u torbi, škrinji, štandu i kombiju.

**Architecture:** Dvije čiste funkcije u `src/sim.js` nad nizovima mjesta (`s.bag`, `s.chest`, `s.stand`, `s.cargo`); `src/ui.js` dodaje gumb i HTML5 drag & drop na `slotButton`, `src/main.js` ih spaja kroz `act()`.

**Tech Stack:** čisti JS (ES moduli), `node --test`.

**Spec:** `dev-farm/docs/specs/2026-11-16-bag-sort-drag-design.md`

## Global Constraints
- Mjesto drži najviše `STACK_MAX` (99). Pravila bez DOM-a. Tekst igre na hrvatskom.
- Prijelaz između mreža poštuje sve provjere iz `moveItem` (intown, novan, notsellable, puno).

## Review Focus
1. Spajanje kad ciljna hrpa nema mjesta za sve (98 + 5) → u cilj ide koliko stane, ostatak ostaje u izvoru (test u Tasku 1).
2. Spuštanje predmeta na samog sebe → ništa se ne mijenja (test u Tasku 1).
3. Spuštanje neprodajne robe na štand ili u kombi → odbija se s istom porukom kao danas (test u Tasku 1).
4. Sortiranje puno nepunih hrpa iste vrste (3 × 40) → 99 + 21, bez gubitka (test u Tasku 1).
5. Povlačenje dok je ploča otvorena, a stanje se promijeni (kupac kupi sa štanda) → indeks mjesta može biti zastario; `dropItem` mora provjeriti da izvor još postoji (test u Tasku 1: prazan izvor → `noitem`).

---

### Task 1: Pravila – `sortSlots` i `dropItem`

**Files:** Modify `src/sim.js` (uz `moveItem`); Test `tests/sim.test.js`

**Interfaces – Produces:**
- `export function sortSlots(s, which, nameOf = (id) => id, events = []): { ok: true }` – `which` ∈ `bag|chest|stand|cargo`; zbroji količine po `id`, poreda po zbroju silazno pa `nameOf(id)` (`localeCompare('hr')`), napuni od početka hrpama po `STACK_MAX`, ostatak `null`; event `{ type: 'sorted', which }`.
- `export function dropItem(s, from, slot, to, target, events = []): { ok } | { ok: false, reason }`.

- [ ] **Step 1: Testovi koji padaju**
```js
test('sort: most first, stacks merged, no gaps', () => {
  const s = createState();
  s.chest[0] = { id: 'wood', n: 3 };
  s.chest[2] = { id: 'crop:radish:2', n: 40 };
  s.chest[5] = { id: 'stone', n: 7 };
  s.chest[7] = { id: 'crop:radish:2', n: 40 };
  s.chest[9] = { id: 'crop:radish:2', n: 40 };
  sortSlots(s, 'chest');
  assert.deepEqual(s.chest.slice(0, 5), [
    { id: 'crop:radish:2', n: 99 }, { id: 'crop:radish:2', n: 21 }, { id: 'stone', n: 7 }, { id: 'wood', n: 3 }, null,
  ]);
  assert.ok(s.chest.slice(4).every((it) => it === null));
});

test('sort: equal amounts go by name', () => {
  const s = createState();
  s.bag[3] = { id: 'wood', n: 5 };
  s.bag[1] = { id: 'stone', n: 5 };
  sortSlots(s, 'bag', (id) => ({ wood: 'drva', stone: 'kamen' }[id]));
  assert.deepEqual(s.bag.slice(0, 2).map((it) => it.id), ['wood', 'stone']);
});

test('drag inside a grid: move to empty, swap with another item, merge the same one', () => {
  const s = createState();
  s.bag[0] = { id: 'wood', n: 3 };
  s.bag[1] = { id: 'stone', n: 2 };
  assert.ok(dropItem(s, 'bag', 0, 'bag', 5).ok);
  assert.deepEqual([s.bag[0], s.bag[5]], [null, { id: 'wood', n: 3 }]);
  dropItem(s, 'bag', 5, 'bag', 1);
  assert.deepEqual([s.bag[1], s.bag[5]], [{ id: 'wood', n: 3 }, { id: 'stone', n: 2 }]);
  s.bag[2] = { id: 'wood', n: 98 };
  dropItem(s, 'bag', 1, 'bag', 2);
  assert.deepEqual([s.bag[1], s.bag[2]], [{ id: 'wood', n: 2 }, { id: 'wood', n: 99 }], 'only what fits moves');
  dropItem(s, 'bag', 2, 'bag', 2);
  assert.deepEqual(s.bag[2], { id: 'wood', n: 99 }, 'onto itself: nothing');
});

test('drag between grids: lands on the chosen slot, follows the move rules', () => {
  const s = createState();
  s.bag[0] = { id: 'crop:radish:2', n: 4 };
  s.bag[1] = { id: 'wood', n: 2 };
  s.chest[0] = { id: 'stone', n: 1 };
  assert.ok(dropItem(s, 'bag', 0, 'chest', 6).ok);
  assert.deepEqual([s.bag[0], s.chest[6]], [null, { id: 'crop:radish:2', n: 4 }]);
  dropItem(s, 'bag', 1, 'chest', 0); // occupied by stone → first free slot
  assert.deepEqual(s.chest[1], { id: 'wood', n: 2 });
  assert.equal(s.chest[0].id, 'stone');
  s.bag[2] = { id: 'wood', n: 1 };
  assert.equal(dropItem(s, 'bag', 2, 'stand', 0).reason, 'notsellable');
  assert.equal(dropItem(s, 'bag', 7, 'chest', 0).reason, 'noitem', 'an empty (stale) source slot');
  s.market.trips.farmer = { phase: 'sell' };
  assert.equal(dropItem(s, 'chest', 6, 'bag', 3).reason, 'intown');
});
```
Uvezi `sortSlots, dropItem`.
- [ ] **Step 2:** `npm test` → FAIL (nema izvoza).
- [ ] **Step 3:** Izvedi. `dropItem`: isti spremnik → premjesti/spoji/zamijeni (isti slot → `{ ok: true }` bez promjene); drugi spremnik → iste provjere kao `moveItem` (izdvoji ih u `moveProblem(s, from, it, to)` koju koriste oba), pa prazan cilj ili isti id → stavi u cilj koliko stane, drugi predmet → `moveItem` (prvo slobodno). Event `moved` kao `moveItem`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `dev-farm: sort and drop rules for bag, chest, stand and van`.

### Task 2: Sučelje, priručnik, dokumentacija

**Files:** `src/ui.js` (`slotButton`, mreže torbe ~456, škrinje ~565, štanda ~575, kombija ~779), `src/main.js` (`onSort`, `onDrop` u `cb`), `style.css` (izgled za vrijeme povlačenja), `src/guide.js` (tema `storage`), `tests/guide.test.js`, README, PROGRESS.

- [ ] Test priručnika koji pada: tema „Torba, škrinja i dostava“ spominje „Sortiraj“ i povlačenje mišem.
- [ ] `slotButton(it, onClick, { label, from, slot })`: puno mjesto je `draggable`, `dragstart` zapisuje `{from, slot}` u `dataTransfer` (`text/plain` JSON); svako mjesto s `from` prima `dragover` (preventDefault, klasa `drop-target`) i `drop` → `cb.onDrop(from0, slot0, from, slot)`. Gumb „Sortiraj“ iznad svake od četiri mreže → `cb.onSort(which)`. `main.js`: `onSort = (w) => act((ev) => sortSlots(state, w, itemName, ev))`, `onDrop = (...a) => act((ev) => dropItem(state, ...a, ev))`.
- [ ] Priručnik, README (Kako se igra), PROGRESS v37.
- [ ] Provjera u headless Chromiumu: „Sortiraj“ u škrinji složi po količini; povlačenje (CDP `Input.dispatchDragEvent` ili sintetski `DragEvent` s `DataTransfer`) premjesti predmet u torbi i iz torbe u škrinju; bez JS grešaka. `npm test` zelen. Commit `dev-farm: sort button and drag and drop in bag, chest, stand and van`.
