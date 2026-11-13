# Life Simulation

Kratka (5–10 min) multiplayer društvena simulacija života u browseru. Igrači i botovi s različitim karijerama prolaze kroz svakodnevne situacije i odlučuju jedni o drugima kroz unaprijed zadane izbore. Prva verzija radi samo s botovima.

**Status:** 🚧 u izradi. Postoji prvi igrivi prototip: sesije samo s botovima (M1–M3). Slijede veća biblioteka eventa i batch statistika.

## Pokretanje

Potreban je Node.js 22 ili noviji.

```bash
cd life-simulation
npm install          # instalacija ovisnosti (npm workspaces)
npm run validate     # provjera sadržaja (karijere, činjenice, eventi)
npm test             # automatski testovi (Vitest)
npm run check        # typecheck + validate + test
npm run sim          # jedna sesija samo s botovima: log, profili botova, Life Recap
```

Primjeri simulacije:

```bash
npm run sim -- --players 8 --seed test-001
npm run sim -- --careers doctor,lawyer,civilian --archetypes altruist,manipulator,impulsive --explain
npm run sim -- --duration 300 --json sim-output/run.json --quiet
```

`--explain` ispisuje za svaku odluku bota korisnost i vjerojatnost svakog izbora.

Validacija drugog direktorija sa sadržajem: `npm run validate -- <putanja>`. Ako ima grešaka, izlazni kod je 1; upozorenja ne ruše provjeru.

## Što može

- Format eventa (verzija 1) s ulogama, privatnim informacijama, izborima koje vide samo pojedine karijere, percipiranim posljedicama, ishodima koji ovise o kombinaciji odluka, slučajnosti, odgođenim nastavcima i smrću. Opis je u [`docs/EVENT_FORMAT.md`](docs/EVENT_FORMAT.md).
- Validator koji hvata nedostajuće izbore, neispravne uvjete, pokvarene nastavke, nemoguće zahtjeve za sudionike i konfliktne ishode, s točnom putanjom do greške.
- 10 karijera s pasivnim sposobnostima te 6 testnih eventa, od kojih su 2 dio lanaca.
- Deterministički PRNG s neovisnim tokovima, virtualni sat i red timera, jezik uvjeta s evaluatorom.
- Botove s osobnošću (10 osobina, 10 arhetipova), skrivenim motivima i sjećanjem sesije. Odlučuju preko bodovanja korisnosti i kontrolirane slučajnosti, a vide isto što bi vidio čovjek.
- Engine koji izvrti cijelu sesiju bez grafike, s paralelnim eventima, rokovima i zadanim odlukama, ishodima, nastavcima, smrću, čitljivim logom i Life Recapom. Ista sesija s istim seedom uvijek daje isti rezultat.

## Kako je napravljeno

- Specifikacija vlasnika je izvor istine: [`docs/spec/`](docs/spec/00_OVERVIEW.md). Pregled specifikacije, arhitektura i milestonei su u [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).
- **TypeScript + npm workspaces** (modularni monolit): granice modula su granice paketa, pa botovi ne mogu uvesti interne dijelove enginea.
- **Paketi se pokreću izravno iz `.ts` izvora** (tsx, Vitest), bez build koraka, jer je to jednostavnije dok nema produkcijskog deploya.
- **Zod** za validaciju sadržaja: jedna definicija daje i TypeScript tipove i provjeru JSON datoteka.
- **Sadržaj je JSON**, jedan event po datoteci, odvojen od koda. Novi event ne traži promjenu enginea.
- **Uvjeti su deklarativni JSON** (bez `eval`), pa ih validator može u potpunosti provjeriti.
- **Botovi su rule-based s težinama** (bez vanjskog AI API-ja): brzo, besplatno, ponovljivo i objašnjivo. Tablica „oznaka izbora × osobina“ i težine su konfiguracija, ne kod.
- **Ishodi su poredani i primjenjuje se prvi koji odgovara**, uz opcionalnu vjerojatnost. To je jednostavno za pisanje, a pokriva kombinacije odluka i neizvjesnost.
- Odluke vlasnika: eventi teku paralelno, NPC-ovi su samo narativni, neki likovi počinju s postojećim odnosom, frontend je Vite + React, a tekstovi igre su na engleskom.

## Struktura

```
.
├── docs/
│   ├── spec/                  # izvorna specifikacija v1.0
│   ├── IMPLEMENTATION_PLAN.md # pregled, arhitektura, milestonei, odluke
│   └── EVENT_FORMAT.md        # mjerodavan opis formata sadržaja
├── packages/
│   ├── core/                  # konstante, PRNG, Clock/TimerQueue, DSL uvjeta, Zod sheme
│   │   ├── src/
│   │   └── test/
│   ├── content/               # sadržaj + loader + validator + CLI
│   ├── engine/                # sesija, direktor, razrješenje, nastavci, log, Life Recap
│   ├── bots/                  # osobnost, arhetipovi, motivi, sjećanje, bodovanje
│   └── sim/                   # sesije samo s botovima + CLI
│       ├── data/              # careers.json, facts.json, events/*.json
│       ├── src/
│       └── test/
├── package.json               # workspaces i skripte
├── tsconfig*.json
└── vitest.config.ts
```

Planirani paketi: `server` (M6) i `web` (M7).

## Moguća poboljšanja

- Vidi milestonee M2–M8 u planu.
