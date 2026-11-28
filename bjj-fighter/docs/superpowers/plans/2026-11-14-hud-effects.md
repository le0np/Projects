# HUD borbe i efekti: plan izvedbe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semafor borbe postaje TV traka unutar slike, kartice kritičnog trenutka postaju „game” kartice, a uspješne tehnike dobivaju natpis, značku s bodovima i tresenje, sve kao HTML preko canvasa.

**Architecture:** Sva logika „što prikazati” je u novom čistom modulu `src/ui/fightFx.js` (bez DOM-a, testira se u Nodeu). `src/ui/app.js` ga poziva u petlji i samo mijenja DOM. Engine i renderer se ne diraju.

**Tech Stack:** čisti ES moduli, HTML/CSS, `node --test`, Playwright (`playwright-core` iz scratchpada) za screenshotove.

**Spec:** `docs/superpowers/specs/2026-11-14-hud-effects-design.md`

## Global Constraints

- `src/engine/` i `src/render/` se ne mijenjaju.
- Bez novih npm ovisnosti i build koraka. Font je lokalna woff2 datoteka (OFL), bez Google Fonts poveznice.
- Energija: zelena, žuta ispod 50, crvena ispod 20 (iste granice kao sad).
- Natpisi točno: `TAKEDOWN!`, `SWEEP!`, `PROLAZ!`, `MOUNT!`, `LEĐA!`, `TAP!`.
- Značka: `+N` gdje je N stvarni porast bodova (2, 3 ili 4, a moguće i zbroj poput 6).
- Uz `prefers-reduced-motion: reduce` nema tresenja ni preleta, natpis se samo pojavi i nestane.
- Bez horizontalnog scrolla na 390 px širine.
- Copy na hrvatskom, kod i imena na engleskom.

## Review Focus

- Bodovi upisani dok traje kritični trenutak ili u istom kadru kad borba završi: značka se mora pojaviti točno jednom (test u Tasku 1).
- Nova borba (sljedeća runda turnira ili novi sparing) ne smije pokazati natpis ili značku iz prethodne borbe (test u Tasku 1, memo se resetira u `openFight`).
- Predaja preko „Odustani” ne pokazuje `TAP!` (test u Tasku 1).
- Dugo ime protivnika i 390 px širina: ime se skraćuje s „…”, semafor ne prelazi širinu (Playwright u Tasku 2).
- Pet kartica s dugim nazivima tehnika na mobitelu: kartice idu jedna ispod druge i ostaju klikabilne, tipke 1–5 rade (Playwright u Tasku 3).

---

### Task 1: Logika efekata (`fightFx.js`)

**Files:**
- Create: `src/ui/fightFx.js`
- Test: `tests/fight-fx.test.js`

**Interfaces:**
- Produces:
  - `energySegments(energy: number) -> { on: number, level: 'ok'|'tired'|'spent' }`: `on = Math.ceil(clamp(energy,0,100)/10)`, `level` je `'spent'` ispod 20, `'tired'` ispod 50, inače `'ok'`.
  - `bannerFor(action, success) -> { text: string, shake: boolean } | null`: `null` ako `success !== true` ili `!action`. Redom: `kind 'takedown'` → `TAKEDOWN!` (shake), `'sweep'` → `SWEEP!` (shake), `'pass'` → `PROLAZ!`, zatim `action.to?.pos === 'mount'` → `MOUNT!`, `'back'` → `LEĐA!`, inače `null`. `kind 'sub'` vraća `null` (TAP dolazi iz kraja borbe).
  - `createFxMemo(fight) -> memo`: `{ seq: fight.lastAction?.seq ?? -1, pts: { p: fight.score.p.pts, o: fight.score.o.pts }, ended: !!fight.ended }`.
  - `nextFxEvents(memo, fight, actionById) -> { memo, events }`, gdje je event `{ type: 'banner', who: 'p'|'o', text, shake }` ili `{ type: 'badge', who, pts }`. Novi `lastAction.seq` daje banner preko `bannerFor`. Porast `score[w].pts` daje badge. Prijelaz `ended` iz false u true s `method === 'sub'` i `detail !== 'predaja'` daje `{ type: 'banner', who: ended.winner, text: 'TAP!', shake: false }`. Memo se ne mijenja na mjestu.

- [ ] **Step 1: Write the failing tests** u `tests/fight-fx.test.js`, s lažnim objektima borbe (`{ lastAction, score: { p: { pts }, o: { pts } }, ended }`) i malim `actionById` mapama:
  - `energySegments`: `100 → {on:10, level:'ok'}`, `50 → {on:5,'ok'}`, `49 → {on:5,'tired'}`, `19 → {on:2,'spent'}`, `0 → {on:0,'spent'}`, `-5 → {on:0}`, `130 → {on:10}`
  - `bannerFor`: takedown ✔ → `{text:'TAKEDOWN!',shake:true}`; sweep u mount → `SWEEP!` (vrsta ima prednost pred ciljem); transition u back → `LEĐA!`; transition u mount → `MOUNT!`; escape → `null`; sub ✔ → `null`; takedown s `success:false` ili `null` → `null`
  - `nextFxEvents`: isti `seq` → bez događaja; novi `seq` s uspješnim sweepom → jedan banner za tog borca; `p.pts` 0→6 → jedan badge `{who:'p',pts:6}`; isti porast pozvan dvaput s vraćenim memom → badge samo prvi put; `ended {winner:'o',method:'sub',detail:'Armbar'}` → `TAP!` za `'o'`; `detail:'predaja'` → bez TAP-a; `ended` već true u memu → bez novog TAP-a; `createFxMemo` na borbi s postojećim bodovima i `seq` ne daje događaje za stanje koje je već bilo.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, `Cannot find module '../src/ui/fightFx.js'`.

- [ ] **Step 3: Implement the four exports** u `src/ui/fightFx.js`. Modul ne uvozi ništa iz DOM-a ni iz `src/data` (`actionById` se predaje kao argument, da test ostane neovisan).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: svi testovi prolaze (83 postojeća + novi).

- [ ] **Step 5: Commit**

```bash
git add src/ui/fightFx.js tests/fight-fx.test.js
git commit -m "bjj-fighter: fight effect events (banners, score badges, energy segments)"
```

### Task 2: Font i TV semafor unutar slike

**Files:**
- Create: `assets/fonts/barlow-condensed-800-italic.woff2`, `assets/fonts/barlow-condensed-700-italic.woff2`, `assets/fonts/OFL.txt`
- Modify: `server.js` (MIME `.woff2` → `font/woff2`), `index.html` (blok `#fight`), `style.css` (odjeljak `/* Fight */` i mobilni `@media`), `src/ui/app.js` (`openFight`, `renderScore`)

**Interfaces:**
- Consumes: `energySegments` iz Taska 1.
- Produces: markup koji Task 3 i 4 koriste: `.stage` sadrži `.hud` (na vrhu), `#fx` (prazan sloj efekata, `pointer-events:none`, iznad canvasa, ispod `.critical` i `.result`), postojeće `#critical`, `#feedback`, `#result`. ID-ovi `sb-p`, `sb-o`, `sb-p-name`, `sb-o-name`, `sb-round`, `sb-clock` ostaju. Energija postaje `#sb-p-en` / `#sb-o-en` s 10 `<i>` segmenata. Nova CSS varijabla `--display: "Barlow Condensed", "Arial Narrow", system-ui, sans-serif`.

- [ ] **Step 1: Download font i licencu**

```bash
mkdir -p assets/fonts
curl -sA "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,700;1,800&display=swap"
# iz ispisa uzmi latin-ext i latin woff2 URL-ove za 700 i 800 (latin-ext pokriva č, ć, š, ž, đ) i preuzmi ih
curl -sL -o assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/barlowcondensed/OFL.txt
```
Ako Google za istu težinu vrati odvojene `latin` i `latin-ext` datoteke, spremi obje (`…-800-italic-latin.woff2`, `…-800-italic-latin-ext.woff2`) i prepiši njihove `unicode-range` u `@font-face`.

- [ ] **Step 2: `@font-face` u `style.css`** (`font-display: swap`, `font-style: italic`), dodaj `.woff2` u `server.js`.

- [ ] **Step 3: Semafor u `.stage`.** Premjesti `.scoreboard` u `.stage` kao `.hud` (apsolutno na vrhu, `pointer-events:none`):
  - Pločica igrača lijevo, protivnika desno (zrcalno). Svaka ima portret 56 px (silueta: inline SVG glava i ramena, okvir 3 px u boji pojasa, klase `belt-*` koje već postoje), red s imenom i pojasom (`--display` 800 italic, ellipsis), sitan red „greška · snaga · kondicija” (muted, 11 px), veliki bodovi (`--display` 34 px, `--gold`) i „A · K”, te 10 segmenata energije.
  - Sredina: nagnuta jantarna pločica (`transform: skewX(-12deg)`, tekst odnagnut) s rundom (i fazom turnira) i satom (`tabular-nums`).
  - Pozadina pločica `rgba(11,14,22,0.85)`, rub u boji strane (plava/crvena) 4 px na vanjskom rubu.
  - `#pos-label` ide ispod sata, centrirano. `#feedback` se spušta ispod HUD-a (`top` ≈ visina HUD-a + 8 px).
- [ ] **Step 4: `openFight` i `renderScore`.** `openFight` upisuje ime u `sb-*-name`, statistike u novi `sb-*-stats`, a pojas u klasu okvira portreta (`belt-white` … `belt-black` prema `state.belt` i `fight.opponent.belt`). `renderScore` za energiju poziva `energySegments` i postavlja `on` klasu na prvih `on` segmenata te `ok|tired|spent` na traku. `title="Energija N / 100"` ostaje.
- [ ] **Step 5: Mobilni prikaz (≤ 560 px).** Portret 36 px, red sa statistikama skriven, bodovi 24 px, sat 18 px. Ime se skraćuje s ellipsisom.
- [ ] **Step 6: Provjera**

Run: `npm test`, pa `npm start`. Playwright skripta u scratchpadu (`playwright-core` iz prethodne sesije): otvori `http://localhost:8080`, u Test kartici uključi „Sve otključano”, pokreni sparing, pričekaj 4 s i spremi screenshot `.stage` na 1100 px i na iPhone 13. Zatim u `localStorage` stavi save s dugim imenom protivnika, ili iz konzole postavi `sb-o-name` na 40 znakova, i ponovi screenshot.
Expected: testovi prolaze, 0 grešaka u konzoli, font se učitao (`document.fonts.check('italic 800 20px "Barlow Condensed"') === true`), `document.documentElement.scrollWidth <= innerWidth` na mobitelu, dugo ime završava s „…”.

- [ ] **Step 7: Commit**

```bash
git add assets server.js index.html style.css src/ui/app.js
git commit -m "bjj-fighter: broadcast-style fight HUD inside the stage, local Barlow Condensed font"
```

### Task 3: Kartice kritičnog trenutka

**Files:**
- Modify: `src/ui/app.js` (`renderCritical`), `style.css` (`.critical`, `.options`, `.legend`), `index.html` (legenda ostaje, `#critical-timer` ostaje)

**Interfaces:**
- Consumes: postojeći `f.critical` (`options[i].cls` ∈ `napad|obrana|sweep`, `.label`, `.level`, `.detail`, `hint.index`, `hint.accuracy`) i `fightCtx.timer`.
- Produces: gumbi i dalje `button[data-opt]` (klik i tipke 1–5 rade bez promjene).

- [ ] **Step 1: Markup kartice** u `renderCritical`: zaglavlje u boji klase s nazivom klase (`NAPAD` / `OBRANA` / `SWEEP`) i brojem tipke desno, naziv tehnike (`--display` 800 italic, 20 px, prelama se), 10 točkica razine (`.dots i.on` za prvih `level`), `detail` sitno. Kartica s `hint.index` dobiva klasu `hinted` (zlatni sjaj koji pulsira, bez pulsiranja uz reduced motion) i oznaku „osjećaj”. Redak „💭 Osjećaj ti govori …” ostaje u `#critical-text`.
- [ ] **Step 2: Odbrojavanje.** U `renderCritical` postavi klasu `low` na `#critical-timer` kad je `left / timeLimit < 1/3` (crvena traka).
- [ ] **Step 3: Tekst kritičnog trenutka** `--display` 800 italic, 22 px, velika slova nisu potrebna (tekst je rečenica).
- [ ] **Step 4: Provjera**

Run: `npm test`, `npm start`. Playwright: sparing uz „Sve otključano” i ubrzanje 10x, čekaj dok `#critical` nije vidljiv (najviše 120 s), screenshot `.stage` na 1100 px i iPhone 13, pritisni tipku `1`.
Expected: kartice imaju zaglavlje u boji klase i točkice razine, na mobitelu su jedna ispod druge i bez horizontalnog scrolla, nakon tipke `1` `#critical` je skriven i `#feedback` vidljiv, 0 grešaka u konzoli.

- [ ] **Step 5: Commit**

```bash
git add src/ui/app.js style.css index.html
git commit -m "bjj-fighter: game-style critical moment cards with level dots and low-time warning"
```

### Task 4: Natpisi, značke i tresenje

**Files:**
- Modify: `src/ui/app.js` (`openFight`, glavna petlja `frame`), `style.css` (novi odjeljak `/* Fight effects */`)

**Interfaces:**
- Consumes: `createFxMemo`, `nextFxEvents` iz Taska 1; `ACTION_BY_ID` iz `src/data/positions.js`; `#fx` i `.hud` pločice iz Taska 2.
- Produces: ništa za druge taskove.

- [ ] **Step 1: Memo po borbi.** U `openFight` postavi `fightCtx.fx = createFxMemo(fight)` i isprazni `#fx`. U `frame`, nakon `stepFight`/odluke, pozovi `nextFxEvents(fightCtx.fx, f, ACTION_BY_ID)`, spremi novi memo i za svaki događaj pozovi `showBanner(ev)` ili `showBadge(ev)`.
- [ ] **Step 2: `showBanner({ who, text, shake })`** dodaje `<div class="fx-banner p|o">` u `#fx`: jantarna (`p`) ili crvena (`o`) nagnuta traka preko sredine slike, `--display` 800 italic oko 54 px (mobitel 32 px), CSS animacija ulijeće slijeva, stoji, izleti desno, ukupno 1,4 s, a nakon `animationend` se element briše. Novi banner briše stari. `shake: true` dodaje klasu `shake` na `.stage` na 300 ms (CSS `@keyframes` s pomakom ±6 px).
- [ ] **Step 3: `showBadge({ who, pts })`** dodaje `<div class="fx-badge p|o">+N</div>` ispod bodova te strane: zelena značka s tamnim obrisom koja iskoči (scale 0 → 1,1 → 1) i odleti 30 px gore uz nestajanje, 1,6 s, a zatim se briše.
- [ ] **Step 4: Reduced motion.** U `@media (prefers-reduced-motion: reduce)` banner i značka koriste samo `opacity` (bez `transform` animacije), a `.stage.shake` nema animaciju.
- [ ] **Step 5: Provjera**

Run: `npm test`, `npm start`. Playwright: sparing uz „Sve otključano” i ubrzanje 10x. Kad se pojavi kritični trenutak, biraj tipkom `1` i tako odigraj borbu do kraja (najviše 5 min). `MutationObserver` na `#fx` broji dodane `.fx-banner` i `.fx-badge` elemente i bilježi njihov tekst. Screenshot u trenutku prvog bannera. Drugi prolaz s `page.emulateMedia({ reducedMotion: 'reduce' })`.
Expected: barem jedan banner i jedna značka, svaki tekst bannera je iz popisa u Global Constraints, `#fx` je prazan 3 s nakon zadnjeg događaja, 0 grešaka u konzoli. Uz reduced motion `.stage` nikad nema aktivnu animaciju `shake` (`getComputedStyle(stage).animationName === 'none'`).

- [ ] **Step 6: Commit**

```bash
git add src/ui/app.js style.css
git commit -m "bjj-fighter: technique banners, score badges and screen shake over the fight"
```

### Task 5: Dokumentacija i završna provjera

**Files:**
- Modify: `README.md` (Kako se igra: semafor i efekti; Kako je napravljeno: HUD je HTML preko slike i preživljava 3D, font lokalan pod OFL; Struktura: `assets/fonts/`, `src/ui/fightFx.js`; Moguća poboljšanja: 3D borba s CC0 modelom, klub kao izometrijska dvorana), `PROGRESS.md` (novi odjeljak „HUD borbe i efekti” s odlukom vlasnika o 3D smjeru u stilu MMA Managera; osvježi Zadnju provjeru, Poznata ograničenja, Sljedeće korake), korijenski `../README.md` samo ako se status mijenja (ne mijenja se)

- [ ] **Step 1: Ažuriraj dokumente** prema popisu iznad. Broj testova u README-u postavi na stvarni broj iz `npm test`.
- [ ] **Step 2: Završna provjera.** `npm test` i ponovno Playwright skripte iz Taskova 2–4 (desktop i iPhone 13), uz jednu borbu do kraja na natjecanju (arena).
Expected: svi testovi prolaze, 0 grešaka u konzoli, nema horizontalnog scrolla, rezultati upisani u tablicu Zadnje provjere u `PROGRESS.md`.
- [ ] **Step 3: Pregled diffa** (`git diff main...dev -- bjj-fighter` za ovaj krug): bez debug koda, bez promjena u `src/engine` i `src/render`.
- [ ] **Step 4: Commit**

```bash
git add README.md PROGRESS.md
git commit -m "bjj-fighter: document fight HUD and effects"
```
