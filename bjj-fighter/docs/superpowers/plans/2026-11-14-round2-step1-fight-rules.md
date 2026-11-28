# 2. krug, korak 1: pravila borbe — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox syntax.

**Goal:** Potez za potez, greške protivnika po pojasu i razini, 70/30 odluke, razloženi i kopirljivi log, kartice u bojama, bonus za brzinu.
**Spec:** `bjj-fighter/docs/superpowers/specs/2026-11-14-round2-step1-fight-rules-design.md`

## Global Constraints
- Engine ostaje bez DOM-a; sva slučajnost kroz `f.rng`.
- `errorChance(belt, level)`: {white .25, blue .18, purple .12, brown .08, black .05} − 0.015·(level−1), min 0.02.
- Razmjena svakih 6–9 s; bonus za brzinu +0.10.

## Review Focus
1. Protivnik bez poteza u poziciji → red ipak prelazi na igrača (nema zaglavljivanja).
2. Greška protivnika kad igrač ne zna nijedan napad → bez praznog kritičnog trenutka, igrač dobiva prednost.
3. Kopiranje loga kad `navigator.clipboard` nije dostupan → rezervni način (označi tekst).
4. Razloženi bodovi kad se pozicija izgubi prije 3 s → u logu ne piše da su bodovi dodijeljeni.

### Task 1: Engine — red, greške, bodovi u logu, bonus brzine, klase opcija
Files: `src/engine/fight.js`, `src/data/moves.js`; Test `tests/fight.test.js`, `tests/data.test.js`
Produces: `errorChance(belt, level)`, `MOVE_CLASS[moveId]` ∈ napad|obrana|kontrola|pozicija, `option.cls`, `f.history[{who, actionId, ok, error}]`, `chooseOption(f, index, {fast})`, log stavke `{round, clock, text, who}`, `formatLog(f)`.
- [ ] Testovi: izmjena reda u `history`; vrijednosti `errorChance`; greška protivnika otvara priliku s tekstom „pogriješio”; udio kritičnih trenutaka 25–35 % razmjena (dobar igrač); log „sweep 2 + mount 4”; `fast` pretvara neuspjeh u uspjeh na rubu; svaka opcija ima `cls`.
- [ ] Implementacija, svi testovi, commit.

### Task 2: UI — cijeli log s kopiranjem, boje kartica, brzina
Files: `src/ui/app.js`, `index.html`, `style.css`
- [ ] Playwright: borba do kraja, log ima >5 stavki i scroll, „Kopiraj log” radi, kartice imaju klase boja; mobitel bez horizontalnog scrolla; commit, push.
