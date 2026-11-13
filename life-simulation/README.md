# Life Simulation

Kratka (5–10 min) multiplayer društvena simulacija života u browseru: igrači i botovi s različitim karijerama prolaze kroz svakodnevne situacije i odlučuju jedni o drugima kroz unaprijed zadane izbore. Prva verzija radi samo s botovima.

**Status:** 🚧 u izradi — faza planiranja (M0), kod još ne postoji

## Pokretanje

Još nema koda za pokretanje. Prve naredbe stižu s milestoneom M1 (`npm install`, `npm test`, `npm run validate`), a igrivi bot-prototip s M3 (`npm run sim`).

## Što može

- Zasad: kompletna specifikacija i plan implementacije.

## Kako je napravljeno

- Specifikacija vlasnika je izvor istine: [`docs/spec/`](docs/spec/00_OVERVIEW.md).
- Pregled specifikacije, uočene nedosljednosti, arhitektura i milestonei: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).
- Planirani stack: TypeScript, npm workspaces (modularni monolit), Vitest, Zod; kasnije Fastify + Socket.IO, PostgreSQL i Vite + React. Engine je čista deterministička biblioteka (seedani PRNG, apstraktni sat) koju jednako koriste simulator i server.

## Struktura

```
.
├── docs/
│   ├── spec/                  # izvorna specifikacija v1.0 (7 dokumenata + pregled)
│   └── IMPLEMENTATION_PLAN.md # pregled, arhitektura, milestonei, otvorene odluke
├── README.md
└── PROGRESS.md
```

Planirana struktura paketa (`packages/core`, `content`, `engine`, `bots`, `sim`, `server`, `web`) opisana je u planu, §3.2.

## Moguća poboljšanja

- Vidi milestone M1–M8 u planu.
