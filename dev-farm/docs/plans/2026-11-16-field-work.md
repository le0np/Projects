# Rad na polju – plan izvedbe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Farmer hoda brzinom kupaca, radnje na parceli traju (traka napretka i poza), polje se obrađuje povlačenjem mišem, a serija berba → sadnja → zalijevanje radi jednom naredbom.

**Architecture:** Sve ide kroz postojeći red poslova (`f.queue`, `f.job`, `continueJob`, `route` u `src/sim.js`) i stanje `farmer.busy` koje `build()` odbrojava. `arrive()` za radnje na parceli ne izvršava odmah nego postavlja `busy = { what: 'work', … }`; kad istekne, izvrši se isti kod kao dosad. Povlačenje i serija samo pune red. `plotAction` i ostali izvršitelji ostaju trenutni (testovi ih zovu izravno).

**Tech Stack:** čisti JS (ES moduli), `node --test`, canvas; bez ovisnosti.

**Spec:** `dev-farm/docs/specs/2026-11-16-field-work-design.md`

## Global Constraints

- `WALK_SPEED` = `NPC_SPEED` = 3 polja/s.
- Trajanja u stvarnim sekundama: sadnja 1,5, berba 1,5, čišćenje trule parcele 1,5, punjenje kante 2, zalijevanje 1, gnojenje 1, malčiranje 1.
- Energija se troši kad radnja završi; prekid ne troši ništa.
- Serija sadi istu vrstu; ako je nema, vrstu iz vrećice (`s.seed`); ako ni nje nema, parcela ostaje prazna, a serija ide dalje.
- Pravila (`src/sim.js`) ne smiju ovisiti o DOM-u. Tekst igre je na hrvatskom, kod i commit poruke na engleskom.
- Red poslova i radnja u tijeku se ne spremaju (kao i dosad).
- Nakon svake promjene: `PROGRESS.md` (novi odjeljak, provjera, ograničenja, koraci) i README ako se mijenja način igre.

## Review Focus

1. Brzo povlačenje miša preskoči parcele između dva `mousemove` događaja → očekuje se da sve parcele na putu budu označene (`tilesBetween`, test u Tasku 3).
2. Povlačenje preko zaključanog drugog polja ili preko staze/ograde → te pločice se ignoriraju, posao dobiva samo otključane parcele s poslom (test u Tasku 3).
3. Farmeru ponestane energije usred serije ili skupnog posla → posao staje s `tired`, nijedna radnja nije napola naplaćena (test u Tasku 4).
4. Spavanje, nesvjestica u 02 h ili odlazak u grad dok traje radnja → `busy` se očisti, ništa se ne izvrši naknadno (test u Tasku 1).
5. Povlačenje dok farmer peca ili radi honorarac → ponaša se kao `startJob` danas (prekida to), a u gradu se odbija s `intown` (test u Tasku 3).

---

### Task 1: Sporiji hod i radnje koje traju

**Files:**
- Modify: `src/data.js` (oko retka 26: `WALK_SPEED`, `NPC_SPEED`; novo `WORK_SECONDS`)
- Modify: `src/sim.js` (`command` ~291, `arrive` ~355, `build` ~2047)
- Modify: `src/main.js` (`cancelJob` ~685; `buildcancel` poruka se ne smije pojaviti za `work`)
- Test: `tests/sim.test.js`

**Interfaces:**
- Produces: `WORK_SECONDS = { plant: 1.5, harvest: 1.5, clear: 1.5, refill: 2, water: 1, fertilize: 1, mulch: 1 }` u `data.js`.
- Produces: `export function workAct(s, task): 'plant'|'harvest'|'clear'|'refill'|'water'|'fertilize'|'mulch'|null` u `sim.js` — koja radnja bi se na tom zadatku izvršila sad; `null` kad nema posla ili farmer nema energije za nju (tada se zadatak izvrši odmah kao dosad, pa skip/fail stigne bez čekanja). Zadaci: `plot` (prema stanju parcele i `s.tool`, isti redoslijed kao `plotAction`), `jobplant`, `jobharvest`, `jobwater` (`null` i kad je kanta prazna – tada `jobWater` sam stavi punjenje u red), `jobfert`, `jobmulch`, `jobrefill`, `object` s `id` `pond`/`well`/`tap` → `'refill'` kad bi `objectAction` punio kantu (nije pecanje, bunar je sazidan, montaža pumpe ne čeka, `s.water < canSize(s)`), a od Taska 4 i `jobseries`.
- Produces: `farmer.busy = { what: 'work', act, left, total, task }`; `doTask(s, task, events)` – dosadašnje tijelo `arrive` (izvršitelj bez čekanja).

- [ ] **Step 1: Napiši testove koji padaju**

```js
test('the farmer walks as fast as the customers', () => {
  assert.equal(WALK_SPEED, NPC_SPEED);
  assert.equal(WALK_SPEED, 3);
});

test('a plot action takes its time; energy is spent when it is done', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  s.farmer.x = AX; s.farmer.y = AY; // already standing on the plot
  command(s, AX, AY);
  assert.equal(s.farmer.busy?.what, 'work');
  assert.equal(s.farmer.busy.act, 'plant');
  advance(s, 1.4);
  assert.equal(plotOf(s).crop, null, 'not planted yet');
  assert.equal(s.energy, MAX_ENERGY);
  advance(s, 0.2);
  assert.equal(plotOf(s).crop, 'radish');
  assert.equal(s.energy, MAX_ENERGY - 2);
  assert.equal(s.farmer.busy, null);
});

test('a new click interrupts the work and spends nothing', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  s.farmer.x = AX; s.farmer.y = AY;
  command(s, AX, AY);
  advance(s, 1);
  const events = [];
  command(s, HOUSE_DOOR[0], HOUSE_DOOR[1], 'auto', events);
  advance(s, 2);
  assert.equal(plotOf(s).crop, null);
  assert.equal(s.seeds.radish, 5);
  assert.equal(s.energy, MAX_ENERGY);
  assert.ok(!events.some((e) => e.type === 'buildcancel'));
});

test('if the plot changed during the work (drone, someone faster), it is skipped', () => {
  const s = createState();
  s.plots[idx(AX, AY)] = ripePlot('radish');
  s.farmer.x = AX; s.farmer.y = AY;
  const before = countWhere(s.bag, () => true);
  command(s, AX, AY);
  assert.equal(s.farmer.busy.act, 'harvest');
  s.plots[idx(AX, AY)] = makePlot(); // the drone took it
  advance(s, 2);
  assert.equal(s.energy, MAX_ENERGY);
  assert.equal(countWhere(s.bag, () => true), before);
});

test('sleep, passing out or leaving for town clears the work in progress', () => {
  const s = withSeeds(5);
  s.tool = 'seed';
  s.farmer.x = AX; s.farmer.y = AY;
  command(s, AX, AY);
  s.clock = PASS_OUT - 0.5; // passes out during the work
  advance(s, 2);
  assert.equal(s.farmer.busy, null);
  assert.equal(plotOf(s).crop, null);
});
```

Dodaj `WALK_SPEED, NPC_SPEED, WORK_SECONDS` u import iz `data.js`.

- [ ] **Step 2: Pokreni i provjeri da padaju**

Run: `cd dev-farm && node --test tests/sim.test.js`
Expected: FAIL (WALK_SPEED je 4, nema `busy.what === 'work'`).

- [ ] **Step 3: Izvedi**

- `data.js`: `NPC_SPEED` definiraj prije `WALK_SPEED`, `export const WALK_SPEED = NPC_SPEED;` s komentarom „vlasnik: farmer hoda kao kupci“; dodaj `WORK_SECONDS`.
- `sim.js`: preimenuj tijelo `arrive` u `doTask(s, t, events)`. Novi `arrive`: uzme `t = f.task`, `f.task = null`; ako `workAct(s, t)` vrati radnju, postavi `f.busy = { what: 'work', act, left: WORK_SECONDS[act], total: WORK_SECONDS[act], task: t }`, a farmera okreni prema parceli (`dir` iz razlike položaja, `down` kad stoji na njoj); inače `doTask`.
- `build()`: za `b.what === 'work'` po isteku `f.busy = null; doTask(s, b.task, events)` (izvršitelji već preskaču promijenjenu parcelu sa `skip`).
- `command()`: kad prekida `busy` s `what === 'work'`, ne šalje nikakav događaj (prekid posla već javlja `jobcancel` ako ga je bilo).
- Energija za `workAct`: `ENERGY_COST` po radnji (`refill` 0); `s.energy < cost` → `null`.
- `main.js` `cancelJob()`: ako je `f.busy?.what === 'work'`, postavi `f.busy = null`.

- [ ] **Step 4: Prilagodi postojeće testove**

Helper `walkTo` neka vrti `tick` dok `s.farmer.path.length || s.farmer.busy?.what === 'work'` (granica 2000 koraka). Petlje `for (let i = 0; i < 400 && s.farmer.job; …)` podigni na 3000. Ne mijenjaj očekivane vrijednosti testova; ako neki pada iz drugog razloga, to je greška u izvedbi.

- [ ] **Step 5: Pokreni sve testove**

Run: `cd dev-farm && npm test`
Expected: svi prolaze (82 + 5 novih).

- [ ] **Step 6: Commit**

```bash
git add dev-farm/src/data.js dev-farm/src/sim.js dev-farm/src/main.js dev-farm/tests/sim.test.js
git commit -m "dev-farm: farmer walks like the customers, plot work takes time"
```

---

### Task 2: Poza rada na mapi

**Files:**
- Modify: `src/art.js` (`person()` ~1057)
- Modify: `src/render.js` (`drawPerson` ~261, traka napretka ~461)
- Test: `tests/sim.test.js` (postojeći test crteža, ako pokriva `person`; inače samo provjera u pregledniku)

**Interfaces:**
- Consumes: `farmer.busy = { what: 'work', act, left, total }` iz Taska 1.
- Produces: `A.person({ …, pose })` gdje je `pose` `'bend'` (sadnja, berba, čišćenje, gnojenje, malčiranje) ili `'pour'` (zalijevanje, punjenje kante); bez `pose` crtež je isti kao danas.

- [ ] **Step 1:** U `drawPerson` farmer s `busy.what === 'work'` nije „u hodu“ (bez koraka); crta se slika s `pose` prema `busy.act`, ključ u cacheu uključuje pozu. `bend`: glava i trup spušteni 2–3 px, ruke prema tlu, lagano njihanje svakih 300 ms. `pour`: ruka ispružena prema smjeru gledanja s ikonom kante, kapi kod zalijevanja.
- [ ] **Step 2:** Traka napretka (postojeća, `fxp/fyp`) radi i za `work` bez promjene; provjeri da ne prekriva oblačić.
- [ ] **Step 3: Provjera** – `npm test` prolazi; u headless Chromiumu (`devFarm`): farmer na parceli sa sjemenom, screenshot usred radnje pokazuje sagnutog farmera i traku; isto s kantom.
- [ ] **Step 4: Commit** – `git commit -m "dev-farm: farmer bends down and pours while working"`

---

### Task 3: Povlačenje mišem preko polja

**Files:**
- Modify: `src/sim.js` (uz `jobTargets` ~411 i `startJob` ~462)
- Modify: `src/main.js` (unos mišem ~716–760)
- Modify: `src/render.js` (obrub označenih parcela, uz `setHover`)
- Test: `tests/sim.test.js`

**Interfaces:**
- Produces: `export const TOOL_JOB = { hand: 'harvest', seed: 'plant', can: 'water', fert: 'fertilize', mulch: 'mulch' }` (zamjenjuje lokalni `SPLIT` u `ui.js`, koji ga uvozi).
- Produces: `export function tilesBetween([x0, y0], [x1, y1]): [x, y][]` – sve pločice na ravnoj crti između dviju (uključivo, bez duplikata).
- Produces: `export function dragTargets(s, kind, tiles): [x, y][]` – zadržava redoslijed ulaza; od zadanih pločica samo otključane parcele na kojima posao `kind` ima što raditi (isti uvjeti kao `jobTargets`; za `plant` najviše koliko ima sjemena `s.seed`, za gnojivo/malč koliko doza).
- Produces: `export function startJobOn(s, kind, tiles, events = []): { ok, total } | { ok: false, reason }` – kao `startJob`, ali na zadanim pločicama (`dragTargets` + `route`). Ako je `f.job?.kind === kind`, dodaje nove (bez duplikata s redom i trenutnim zadatkom) na kraj reda i povećava `job.total`, bez novog `jobstart`. Inače zamjenjuje trenutni posao (`jobcancel` za stari). Za `plant` je `job.crop = s.seed`. Prazno → `fail('nothingthere')`; u gradu → `fail('intown')`.
- Produces: `renderer.setDragTiles(tiles | null)`.

- [ ] **Step 1: Testovi koji padaju**

```js
test('tilesBetween fills the gap a fast mouse leaves', () => {
  assert.deepEqual(tilesBetween([0, 0], [3, 0]), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.equal(tilesBetween([0, 0], [3, 3]).length >= 4, true);
  assert.deepEqual(tilesBetween([2, 2], [2, 2]), [[2, 2]]);
});

test('dragging over the field marks only plots where the tool has work', () => {
  const s = withSeeds(2);
  const row = PLOTS_A.slice(0, 4).map(xy);
  s.plots[PLOTS_A[1]] = ripePlot('radish');
  assert.deepEqual(dragTargets(s, 'plant', row), [row[0], row[2]], 'two seeds, the ripe plot is skipped');
  assert.deepEqual(dragTargets(s, 'harvest', [...row, [0, 0], xy(PLOTS_B[0])]), [row[1]], 'trees and the locked field are ignored');
});

test('drag-planting: the farmer works the marked plots; a second drag adds to the same job', () => {
  const s = withSeeds(6);
  s.tool = 'seed';
  const events = [];
  assert.equal(startJobOn(s, 'plant', PLOTS_A.slice(0, 2).map(xy), events).total, 2);
  startJobOn(s, 'plant', PLOTS_A.slice(1, 4).map(xy), events);
  assert.equal(s.farmer.job.total, 4, 'the overlap is not counted twice');
  assert.equal(events.filter((e) => e.type === 'jobstart').length, 1);
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
  assert.equal(PLOTS_A.slice(0, 4).filter((i) => s.plots[i].crop === 'radish').length, 4);
});

test('a drag with another tool replaces the running job; in town it is refused', () => {
  const s = withSeeds(6);
  s.plots[PLOTS_A[10]] = { ...makePlot(), crop: 'radish', progress: 0.3 };
  startJobOn(s, 'plant', PLOTS_A.slice(0, 3).map(xy));
  const events = [];
  startJobOn(s, 'water', [xy(PLOTS_A[10])], events);
  assert.equal(s.farmer.job.kind, 'water');
  assert.ok(events.some((e) => e.type === 'jobcancel'));
  const t = createState();
  t.market.trips.farmer = { phase: 'sell' };
  assert.equal(startJobOn(t, 'plant', [xy(PLOTS_A[0])]).reason, 'intown');
});
```

- [ ] **Step 2:** `npm test` → FAIL (funkcije ne postoje).
- [ ] **Step 3: Izvedi sim dio** (`tilesBetween`, `dragTargets`, `startJobOn`, `TOOL_JOB`; `jobTargets` i `dragTargets` dijele iste uvjete po vrsti posla, bez kopiranja).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Izvedi unos u `main.js`:** `mousedown` (lijeva tipka) na parceli dok je odabran alat iz `TOOL_JOB` i nema postavljanja (`ui.state.placing`) počinje povlačenje; `mousemove` dodaje `tilesBetween(zadnja, nova)` i zove `renderer.setDragTiles(dragTargets(...))`; `mouseup`: ako je miš prešao na barem jednu drugu pločicu → `act((ev) => startJobOn(state, kind, tiles, ev))` i sljedeći `click` se proguta; inače ništa (postojeći `click` radi kao dosad). `mouseleave` i `Escape` prekidaju povlačenje bez posla. Shift pri otpuštanju s rukama → `'series'` (Task 4; dotad ignoriraj Shift).
- [ ] **Step 6: Obrub:** `render.js` crta označene parcele (žuti obrub 2 px, isti stil kao hover, jače).
- [ ] **Step 7: Provjera u headless Chromiumu:** `Input.dispatchMouseEvent` pressed → moved preko 4 parcele → released sa sjemenom; farmer ih posadi redom, gumb sjemena pokazuje „sadi 1/4“…; kratki klik i dalje radi jednu parcelu.
- [ ] **Step 8: Commit** – `git commit -m "dev-farm: drag over the field to plant, harvest, water, fertilize or mulch"`

---

### Task 4: Serija berba → sadnja → zalijevanje

**Files:**
- Modify: `src/sim.js` (`jobTargets`, `JOB_TASK`, `continueJob`, `workAct`, `doTask`)
- Modify: `src/ui.js` (izbornik Ruke ▾ ~277–310, natpis napretka ~395)
- Modify: `src/main.js` (tekstovi `jobstart`/`jobcancel`/`jobend` ~351–370; Shift kod povlačenja)
- Test: `tests/sim.test.js`

**Interfaces:**
- Consumes: `startJob`, `startJobOn`, `dragTargets`, `workAct`, `doTask`.
- Produces: vrsta posla `'series'`: `jobTargets(s, 'series', crop)` = zrele parcele (kao `harvest`). Zadatak u redu `{ type: 'jobseries', x, y, step: 'harvest' | 'plant' | 'water', crop? }`. Nakon uspješne berbe na početak reda idu `plant` (s ubranom vrstom) pa `water` za istu parcelu. `job.done` raste kad je berba na parceli gotova.
- Pravila: sadnja – ubrana vrsta ako `s.seeds[crop] > 0`, inače `s.seed` ako ima sjemena, inače se `plant` i `water` za tu parcelu preskaču. Zalijevanje – kao `jobWater` (prazna kanta → `jobrefill` pa nastavak; na kišni dan parcela je već mokra pa se preskače). `noseeds` ne zaustavlja seriju; `tired` i `bagfull` je zaustavljaju (`JOB_STOP`).

- [ ] **Step 1: Testovi koji padaju**

```js
test('series: harvest, plant the same crop and water, plot by plot', () => {
  const s = withSeeds(3);
  for (const i of PLOTS_A.slice(0, 3)) s.plots[i] = ripePlot('radish');
  const events = [];
  assert.ok(startJob(s, 'series', null, events).ok);
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1, events);
  for (const i of PLOTS_A.slice(0, 3)) {
    assert.equal(s.plots[i].crop, 'radish');
    assert.equal(s.plots[i].progress, 0);
    assert.ok(s.plots[i].wet);
  }
  assert.equal(s.seeds.radish, 0);
  assert.equal(countWhere(s.bag, (id) => id.startsWith('crop:radish')), 3 * CROPS.find((c) => c.id === 'radish').yield);
  assert.equal(events.find((e) => e.type === 'jobend').done, 3);
});

test('series: no seed of that crop → the chosen seed; no seeds at all → harvest only', () => {
  const s = createState();
  s.seeds.carrot = 1;
  s.seed = 'carrot';
  for (const i of PLOTS_A.slice(0, 2)) s.plots[i] = ripePlot('radish');
  startJob(s, 'series');
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1);
  const crops = PLOTS_A.slice(0, 2).map((i) => s.plots[i].crop).sort();
  assert.deepEqual(crops, ['carrot', null]);
  assert.equal(ripeCount(s), 0, 'both were harvested');
});

test('series on a rainy day does not use the can; running out of energy stops cleanly', () => {
  const s = withSeeds(2);
  s.weather = 'rain';
  const water = s.water;
  for (const i of PLOTS_A.slice(0, 2)) s.plots[i] = ripePlot('radish');
  startJob(s, 'series');
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1);
  assert.equal(s.water, water);

  const t = withSeeds(3);
  for (const i of PLOTS_A.slice(0, 3)) t.plots[i] = ripePlot('radish');
  t.energy = 4; // harvest 1 + plant 2 + water 1 = one plot
  const events = [];
  startJob(t, 'series', null, events);
  for (let i = 0; i < 3000 && t.farmer.job; i++) tick(t, 0.1, events);
  assert.equal(events.find((e) => e.type === 'jobend').reason, 'tired');
  assert.equal(t.energy, 0);
  assert.equal(ripeCount(t), 2);
});

test('shift-drag with the hands runs the series on the marked plots only', () => {
  const s = withSeeds(5);
  for (const i of PLOTS_A.slice(0, 4)) s.plots[i] = ripePlot('radish');
  startJobOn(s, 'series', PLOTS_A.slice(0, 2).map(xy));
  for (let i = 0; i < 3000 && s.farmer.job; i++) tick(s, 0.1);
  assert.equal(ripeCount(s), 2);
});
```

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3: Izvedi sim dio** (pravila iz Interfaces; `workAct` za `jobseries` vraća radnju koraka).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: UI:** u izborniku Ruke ▾ ispod berbe naslov „Serija: poberi, posadi, zalij“ i stavke „Sve zrelo“ te po vrsti (broj zrelih), klik → `cb.onJob('series', crop)`. Dok serija traje, ▾ na rukama je ■, a natpis „serija 2/5“. `main.js`: `jobstart` „Idem: berba, sadnja i zalijevanje – N parcela.“, `jobcancel` „…prekidam seriju.“, `jobend` „Gotovo! Serija na N parcela.“ (dodaj usput i `mulch` koji u tim tekstovima fali). Shift pri otpuštanju povlačenja s rukama → `startJobOn(state, 'series', …)`.
- [ ] **Step 6: Provjera u headless Chromiumu:** tri zrele rotkvice, Ruke ▾ → Serija → Sve zrelo; farmer bere, sadi, zalijeva; ■ prekida.
- [ ] **Step 7: Commit** – `git commit -m "dev-farm: harvest-plant-water series from the hands menu and shift-drag"`

---

### Task 5: Priručnik, README, PROGRESS i završna provjera

**Files:**
- Modify: `src/guide.js` (teme Tipke, Ruke/berba, Sjeme, Voda; nova tema „Rad na polju“)
- Modify: `README.md`, `PROGRESS.md` (novi odjeljak v35)
- Test: `tests/guide.test.js`

- [ ] **Step 1: Test koji pada** u `guide.test.js`: tema „Rad na polju“ postoji, spominje povlačenje, Shift i seriju, i sadrži trajanja iz `WORK_SECONDS` (npr. `'1,5 s'`); tražilica „serija“ vraća tu temu prvu.
- [ ] **Step 2:** `npm test` → FAIL; **Step 3:** napiši temu (brojke iz `data.js`, ne upisane); **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** README: opis rada na polju (hod, trajanja, povlačenje, Shift, serija) i obrazloženje odluka; PROGRESS: v35, zadnja provjera, ograničenja (red i radnja u tijeku se ne spremaju; ravnoteža tempa nije isprobana igranjem), sljedeći koraci (točka 3 iz liste vlasnika).
- [ ] **Step 6: Završna provjera:** `npm test` sve prolazi; headless Chromium bez JS grešaka: klik-sadnja s trakom i pozom, povlačenje preko 4 parcele, serija iz izbornika, prekid klikom.
- [ ] **Step 7: Commit** – `git commit -m "dev-farm: guide, readme and progress for field work"`

---

### Task 6: Trule parcele u berbi, povlačenju i seriji (dodatak specu)

**Files:** `src/sim.js` (`jobFits`, `workKind`, `jobHarvest`, `jobSeries`, novi `export rottenCount(s)`), `src/ui.js` (natpis ruku, jedinica u izborniku), `src/main.js` (tekstovi berbe), `src/guide.js`, `tests/sim.test.js`, README, PROGRESS.

- [ ] Testovi koji padaju: „harvest all also clears rotten plots“ (2 zrele + 2 trule → sve prazne, u torbi 2 berbe, energija −4, `done` 4); „bulk harvest of one crop clears only that crop's rotten plots“; „dragging the hands over rotten plots clears them“ (`dragTargets(s, 'harvest', …)` uključuje trule); „series on a rotten plot: clear, plant the same crop, water“.
- [ ] Izvedba: `jobFits` za `harvest`/`series` = `p.crop && (p.rotten || p.progress >= 1)`; `workKind` za `jobharvest` i korak berbe u `jobseries` vraća `'clear'` za trulu parcelu; čišćenje izdvojeno u `clearPlot(s, i, events)` (koristi ga i `plotAction`); serija nakon čišćenja sadi `p.crop` trule parcele.
- [ ] UI: „zrelih: N · trulih: M“ na rukama, jedinica u izborniku berbe „parcela“, `jobend` za berbu dopisuje „očišćeno M“.
- [ ] `npm test` zelen, provjera u pregledniku (Poberi sve na polju s trulim parcelama), commit.
