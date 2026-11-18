# bjj-fighter testna verzija — plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Igriva browser testna verzija no-gi BJJ igre: timer-treninzi poteza, aktivnosti, borba protiv AI-a s kritičnim trenucima, testni panel.

**Architecture:** Čisti ES moduli. `src/data` (podaci), `src/engine` (čista logika bez DOM-a, testira se u Nodeu), `src/render` (Canvas 2D, čita samo stanje borbe), `src/ui` (DOM, petlja, localStorage). Renderer se može zamijeniti 3D-om bez diranja enginea.

**Tech Stack:** HTML, CSS, JavaScript (ES moduli), Canvas 2D, Node 20+ (`node:test`, statički `server.js`), Playwright samo za ručnu provjeru.

**Spec:** `bjj-fighter/docs/superpowers/specs/2026-11-14-test-version-design.md`

## Global Constraints
- Bez npm ovisnosti. `npm start` → `http://localhost:8080`, `npm test` → `node --test`.
- Engine ne smije importati ništa iz `src/render` ni `src/ui` niti koristiti `window`/`document`.
- Sva slučajnost kroz injektirani `rng()` (seedable `mulberry32`) da su testovi deterministični.
- Tekst igre na hrvatskom; nazivi poteza na engleskom kako se koriste u BJJ-u.
- Razina n traje `base × 2^(n-1) × BELT_FACTOR[belt]`; BELT_FACTOR = {white:1, blue:0.8, purple:0.55, brown:0.35, black:0.15}; MAX_LEVEL = 10.
- Šanse: seminar 0.9, open mat uniformno 0.10–0.20, natjecanje 0.05.
- Borba: 3 runde × 180 s igraćeg sata; sat ide 3x brže od stvarnog (× testno ubrzanje). Bodovi: takedown 2, sweep 2, kneeOnBelly 2, pass 3, mount 4, back 4; dodjela nakon 3 s držanja.
- Kritični trenutak: točno 5 opcija, ≥1 točna i ≥1 kriva; rok 10 s stvarnog vremena.

## Review Focus
1. Reload stranice usred treninga → napredak dok je igra bila zatvorena se uračuna (s ubrzanjem spremljenim u stanju). Test u Task 3.
2. Promjena ubrzanja usred treninga → preostalo vrijeme se ne „preskoči” ni ne vrati. Test u Task 3.
3. Pokvaren ili stari zapis u localStorage → nova igra umjesto rušenja. Test u Task 3 (`deserialize`).
4. Igrač ne odabere ništa u kritičnom trenutku → tretira se kao pasivnost (napad protivnika uspijeva / prilika propada). Test u Task 4.
5. Kartica preglednika u pozadini tijekom borbe → veliki `dt` se ograniči, borba ne „preskoči” rundu. Test u Task 4 (`stepFight` s dt > 1 s dijeli na manje korake).

---

### Task 1: Podaci o potezima i pojasevima
**Files:** Create `src/data/moves.js`, `src/engine/rng.js`; Test `tests/data.test.js`
**Interfaces — Produces:** `BELTS` (niz id-eva white…black), `BELT_NAMES`, `MOVES` (niz `{id, name, category, belt, base}`; `base` u sekundama), `MOVE_BY_ID`, `CATEGORIES`; `mulberry32(seed) → () => number`.
- [ ] Test: id-evi jedinstveni; svaki `belt` ∈ BELTS; svaki `category` ∈ CATEGORIES; bijeli pojas ima sve poteze iz IDEJE.md popisa (shrimp, upa, technicalStandUp, sprawl, guardPosture, doubleLeg, singleLeg, snapDown, guardPull, closedGuard, halfGuard, butterflyGuard, hipBump, scissor, flower, butterflySweep, underhookSweep, openClosedGuard, kneeSlice, toreando, overUnder, sideControl, kneeOnBelly, mount, backControl, northSouth, sideToMount, sideToKob, mountToBack, mountUpa, elbowKnee, sideShrimp, sideUnderhook, backEscape, kobEscape, rnc, guillotine, triangle, armbar, kimura, americana, straightAnkle, guillotineDefense, triangleDefense, armbarDefense, rncDefense); bijeli `base` ∈ [5, 60]; postoje napredni potezi viših pojaseva uključujući heelHook.
- [ ] Implementacija, testovi prolaze, commit.

### Task 2: Graf pozicija i akcija
**Files:** Create `src/data/positions.js`; Test `tests/positions.test.js`
**Interfaces — Produces:** `POSITIONS` `{id: {name, scoring?: 'kneeOnBelly'|'mount'|'back'}}`; `ACTIONS` niz `{id, move, from, role: 'top'|'bottom'|'neutral', kind: 'takedown'|'sweep'|'pass'|'transition'|'escape'|'sub'|'pull', to?: {pos, actorTop: boolean}, defenses: [moveId], mistakes: [mistakeId]}`; `MISTAKES` `{id: {text, effect: 'threat'|'tap'|'pos'|'counter'|'penalty', to?, counterAction?}}`; `OPPORTUNITY_MISTAKES` `{ 'pos:role': [mistakeId] }`; `actionsFor(posId, role)`.
- [ ] Test: svaki `move`/`defenses` postoji u MOVE_BY_ID; svaki `to.pos` postoji; svaka `sub` akcija ima ≥1 obranu i ≥2 greške; svaka pozicija+uloga u kojoj netko može napasti ima ≥2 `OPPORTUNITY_MISTAKES`; iz `standing` su sve pozicije dohvatljive; `counterAction` pokazuje na postojeću akciju.
- [ ] Implementacija, testovi, commit.

### Task 3: Napredak (trening, aktivnosti, pojasevi, spremanje)
**Files:** Create `src/engine/progression.js`; Test `tests/progression.test.js`
**Interfaces — Consumes:** Task 1. **Produces:** `createState({test=true}) → state` (`{gameTime, lastReal, speed, unlockAll, belt, money, levels:{moveId:n}, wins, losses, training:null|{moveId, toLevel, endsAt}, activity:null|{type, endsAt, chance}, log:[]}`); `learnTime(moveId, level, belt) → s`; `effectiveLevel(state, moveId)`; `canTrain(state, moveId) → {ok, reason}`; `startTraining(state, moveId)`; `startActivity(state, 'seminar'|'openMat', rng)`; `advance(state, realNowMs, rng) → events[]` (pomiče gameTime za `(realNow-lastReal)/1000 × speed`, završava trening/aktivnost); `setSpeed(state, s, realNowMs)` (1–10, prvo `advance`); `rollCompetitionLearn(state, rng) → moveId|null`; `promotionStatus(state)`; `promote(state)`; `serialize(state)`/`deserialize(str, realNowMs) → state` (nevaljano → `createState()`).
- [ ] Testovi: `learnTime('shrimp',1,'white') === base`, razina 3 = 4×base, crni = 0.15×; trening završi točno kad gameTime ≥ endsAt; `setSpeed` usred treninga čuva preostalo igraće vrijeme; `deserialize` nakon 60 s stvarnog vremena uz speed 10 dodaje 600 s; `deserialize('{bad')` vraća novo stanje; seminar s rng 0.5 nauči nepoznat potez, open mat s rng 0.99 ne; `effectiveLevel` = max(1, lvl) kad je unlockAll; bez unlockAll ne može se trenirati potez višeg pojasa koji nije naučen.
- [ ] Implementacija, testovi, commit.

### Task 4: Engine borbe
**Files:** Create `src/engine/fight.js`, `src/engine/opponent.js`; Test `tests/fight.test.js`
**Interfaces — Consumes:** Task 1–2, `effectiveLevel`. **Produces:** `makeOpponent(belt, rng) → fighter`; `fighterFromState(state) → fighter` (`{name, belt, levels}`); `createFight(player, opponent, rng) → fight` (`{round, clock, pos, playerTop, score:{p:{pts,adv,pen},o:{…}}, pending:null|{scoring, who, at}, critical:null|{kind, text, options:[{label, correct, moveId?}], deadline}, ended:null|{winner:'p'|'o', method:'sub'|'points'|'decision', detail}, events:[]}`); `stepFight(fight, gameDt)` (unutar dijeli na korake ≤0.25 s; ne napreduje dok je `critical` otvoren); `chooseOption(fight, index|null)` (null = isteklo vrijeme); konstante `ROUND_SECONDS=180`, `ROUNDS=3`, `CLOCK_SPEED=3`.
- [ ] Testovi: dodjela bodova tek nakon 3 s u poziciji; promjena pozicije prije 3 s poništava; uspješan `sub` završava borbu s `method:'sub'`; nakon 3 runde pobjednik po bodovima pa prednostima pa kaznama; kritični trenutak uvijek ima 5 opcija s ≥1 točnom i ≥1 krivom; `chooseOption(null)` kod obrane od submissiona igrača može predati; 200 simuliranih borbi (auto-izbor nasumičan) — prosjek 8–12 kritičnih trenutaka; `stepFight(f, 30)` ne preskoči kraj runde (runda završi točno na 180).
- [ ] Implementacija, testovi, commit.

### Task 5: 2D prikaz
**Files:** Create `src/render/poses.js`, `src/render/renderer2d.js`
**Interfaces — Consumes:** stanje borbe iz Task 4 (samo čitanje). **Produces:** `createRenderer(canvas) → {draw(fight, realDt, {slowmo}), flash(text)}`. Poze po poziciji za gornjeg i donjeg borca (11 zglobova), interpolacija pri promjeni pozicije (~0,5 s), disanje, boje: igrač plavi rashguard, protivnik crveni; slow-motion vinjeta tijekom kritičnog trenutka.
- [ ] Provjera: Playwright snimka svake pozicije (`?debugPose=<id>`), pregled da su borci čitljivi; commit.

### Task 6: UI, petlja, spremanje
**Files:** Create `index.html`, `style.css`, `src/ui/app.js`
**Interfaces — Consumes:** sve iznad. Ekrani: Klub (potezi po kategorijama, razina, trajanje sljedeće razine, gumb Treniraj, traka napretka), Aktivnosti (seminar 50 €, open mat), Borba (sparing, natjecanje 3 borbe; 5 % učenja), Testni panel (ubrzanje 1–10x, sve otključano, pojas, +novac, reset). Borba: canvas, sat/runda/bodovi, 5 gumba s rokom 10 s, komentar. Spremanje svake 2 s i na `visibilitychange`.
- [ ] Provjera: Playwright — trening završi uz 10x, odigra se borba do kraja birajući opcije, reload zadrži stanje; mobitel 390 px bez horizontalnog scrolla; commit.

### Task 7: Dokumentacija
**Files:** Create `README.md`, `PROGRESS.md`; Modify korijenski `README.md` (tablica, struktura), `IDEJE.md` (makni ideju, prenesi u README projekta).
- [ ] `npm test` i `npm start` isprobani, naredbe u README točne; commit i push na `dev`.
