# Life Simulation

Kratka (6–10 min) igra života u browseru. **Od Sprinta 5 igra je „Life in chapters”:** jedan život od 18. do 33. godine u šest poglavlja. Igrač bira ime, san, manu i posao. U svakom poglavlju sam bira na što se taj dio života odnosi (3 karte fokusa), igra event s vidljivim izgledima i bacanjem, vidi „What changed”, a na kraju dolazi finale njegovog sna s popisom razloga. Tri stalna lika (najbolji prijatelj, simpatija, suparnik) pamte kako se ponašaš prema njima. Stari način (grad u stvarnom vremenu s više igrača) ostaje u kodu, ali je skriven (`LEGACY_TOWN=1`).

**Status:** 🚧 u izradi. Sprint 5a (nova jezgra za jednog igrača i botove) čeka QA i vlasnikov test; 5b donosi više igrača u poglavljima.

## Pokretanje

Potreban je Node.js 22 ili noviji.

```bash
cd life-simulation
npm install          # instalacija ovisnosti (npm workspaces)
npm run validate     # provjera sadržaja (karijere, činjenice, eventi)
npm test             # automatski testovi (Vitest)
npm run check        # typecheck + validate + test
npm run sim          # jedna sesija samo s botovima: log, profili botova, Life Recap
npm run sim:batch    # 200 sesija → statistika i balansni izvještaj u sim-output/ (stari način)
npm run sim:chapters # bot-životi u poglavljima: uspješnost svakog sna, povratni pozivi, procjena trajanja, replay
npm run start        # izgradi web klijent i pokrene server → otvori http://localhost:3000
npm run server       # samo server na :3000 (bez .env: ugrađeni PGlite u ./data/pglite)
npm run web:dev      # razvoj klijenta s hot reloadom na :5173 (uz pokrenut server)
npm run e2e          # browser testovi (Chromium/Playwright): igra na desktopu i mobitelu, strana žrtve spletke, kartice svih eventa; prije toga npm run web:build
```

Stari način igre (grad u stvarnom vremenu, „Find a life”, sobe za prijatelje) uključuje se s `LEGACY_TOWN=1 npm run start`. Za brzi probni krug starog načina: `LEGACY_TOWN=1 TIME_SCALE=6 FILL_AFTER_SECONDS=2 npm run start`. Sesija od 8 minuta tada traje oko 80 sekundi, a botovi popune prazna mjesta nakon 2 sekunde.

Server s pravim PostgreSQL-om: kopiraj `.env.example` u `.env` i postavi `DATABASE_URL=postgresql://user:pass@host:5432/lifesim`. Migracije se izvrše same pri pokretanju. `TIME_SCALE=10` ubrzava sesije za demo.

Server API:

| | |
|---|---|
| HTTP | `POST /api/register`, `POST /api/login`, `POST /api/logout`, `GET /api/me`, `PUT /api/me/avatar`, `GET /api/careers`, `GET /api/lobby`, `GET /api/sessions/:id/log`, `GET /api/health` |
| Socket.IO (token u `auth.token`) | klijent → server: `match:find {career}`, `match:cancel`, `game:decide {sessionId, instanceId, choiceId}`, `game:resume`<br>server → klijent: `lobby:state`, `match:status`, `game:started`, `game:state` (reconnect), `game:notice`, `game:feed`, `game:ended` |

Primjeri simulacije:

```bash
npm run sim -- --players 8 --seed test-001
npm run sim -- --careers doctor,lawyer,civilian --archetypes altruist,manipulator,impulsive --explain
npm run sim -- --duration 300 --json sim-output/run.json --quiet
```

`--explain` ispisuje za svaku odluku bota korisnost i vjerojatnost svakog izbora.

Batch: `npm run sim:batch -- --sessions 500 --players 2-8 --seed s1 --logs` piše `sim-output/s1.report.md` (i JSONL logove sesija s `--logs`). Na kraju provjerava da replay iz loga daje identičnu sesiju.

Validacija drugog direktorija sa sadržajem: `npm run validate -- <putanja>`. Ako ima grešaka, izlazni kod je 1; upozorenja ne ruše provjeru.

## Što može

**Life in chapters (Sprint 5, zadani način):**

- Stvaranje lika: ime, 6 snova (slava, bogatstvo, ljubav, gradonačelnik, vlastiti posao, obitelj), 6 mana (kukavica, ne zna čuvati tajnu, ne zna reći ne, plahovit, lijen, hvalisavac) i 10 poslova s dvije razine (npr. Junior doctor → Head of A&E).
- 6 poglavlja (18, 21, 24, 27, 30, 33), bez timera: fokus (3 karte, karta sna je uvijek ponuđena kad ima eventa) → event → bacanje (izgledi s modifikatorima mane) → „What changed”. U 27. godini gradski preokret (poplava ili nestanak struje), a u 33. finale sna s izgledima zbrojenim iz cijelog života.
- Stalni likovi (po 2 za svaku ulogu: Marko/Dora, Ana/Luka, Vera/Bruno) s odnosom −4…+4. Kad „odlučuju i oni”, prijatelj pomaže, a uvrijeđeni uzvraća.
- Laži postaju tajne s odbrojavanjem koje same izađu; „Damage control” najviše 2× po životu; osveta kad je netko neprijatelj.
- Povratni pozivi: lik na eventu „se sjeća” što ste radili ranije, tekstovi spominju ranije izbore, a u finalu ti život proleti pred očima.
- Recap: titula prema snu i životu, emoji po poglavlju, ključni trenuci, ljudi (pomogao/povrijedio), „Copy my life”, cijeli log; život se sprema u povijest i kolekciju titula.
- Sadržaj je JSON u `packages/content/chapters/` (34 eventa), a validator provjerava tokene (`{friend}`, `{crush.he}`…), tagove, uloge, tajne i pokrivenost (svaki san ≥ 2 eventa, svaka mana mijenja tekst, svaki posao ima poseban izbor u ≥ 2 eventa).

**Stari način (grad u stvarnom vremenu, `LEGACY_TOWN=1`):**

- Format eventa (verzija 1) s ulogama, privatnim informacijama, izborima koje vide samo pojedine karijere, percipiranim posljedicama, ishodima koji ovise o kombinaciji odluka, slučajnosti, odgođenim nastavcima i smrću. Opis je u [`docs/EVENT_FORMAT.md`](docs/EVENT_FORMAT.md).
- Validator koji hvata nedostajuće izbore, neispravne uvjete, pokvarene nastavke, nemoguće zahtjeve za sudionike i konfliktne ishode, s točnom putanjom do greške.
- 10 karijera s pasivnim sposobnostima i posebnim izborima te 57 eventa u svim kategorijama, uz lance poput preporuka → unaprjeđenje → dilema šefa ili nesreća s bijegom → istraga.
- Deterministički PRNG s neovisnim tokovima, virtualni sat i red timera, jezik uvjeta s evaluatorom.
- Grad gledan odozgo s animiranim likovima (stil B3) koji žive rutinu, smjenu godišnjih doba, gradske preokrete i tajne smicalice (koncept v2, `docs/spec/08_CONCEPT_V2.md`).
- Igru u browseru (desktop i mobitel):
  - prijava i registracija;
  - privatna soba za prijatelje: „Create a room”, kod i link `/r/KX4P`, čekaonica, domaćin pokreće, botovi popune prazna mjesta;
  - lobby s avatarom, statistikom, brojem igrača online, prijašnjim životima i imenom lika (s nasumičnim prijedlogom);
  - izbor karijere s opisom sposobnosti; matchmaking s odbrojavanjem do popune botovima;
  - event s javnim i privatnim tekstom, odbrojavanjem i izborima koji pokazuju percipirane posljedice (isto što vide botovi), uz posebne izbore karijere;
  - ishodi, ljudi i odnosi, javni feed, spectator nakon smrti;
  - spletke u tri koraka: plan sa šansom i rizikom, priprema s jednim pojačanjem (tragovi, čekanje, suučesnik), izvršenje; uhvaćeni krivac može dobiti osvetu;
  - Life Recap i cijeli log sesije.
- Multiplayer server: registracija i prijava, profil sa statistikom i zadnjim životima, lobby (broj igrača online), matchmaking koji nakon kratkog čekanja popunjava mjesta botovima, igra preko WebSocketa, reconnect, javni feed za spectator mode, logovi sesija, PostgreSQL.
- Batch simulaciju stotina sesija sa statistikom (smrtnost, karijere, arhetipovi, izbori, ishodi, ponavljanje, nastavci, tempo) i replay sesije iz loga.
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
- **Sprint 5 (poglavlja):** engine `ChapterLife` je čisti stroj stanja (`next`/`focus`/`choose`); sve slučajno dolazi iz seedanih `Rng` tokova, pa replay loga akcija daje identičan život. Sadržaj ima vlastiti format (`LifeEvent` u `core/src/chapters.ts`) jer su potezi i stanje života drukčiji od eventa u stvarnom vremenu; stari format i engine ostaju netaknuti. Život se drži u memoriji servera dok igrač ne ode u lobby, a gotov život se sprema kao sesija s jednim sudionikom (povijest, titule i log rade kao prije). Tekstovi i oblikovanje slijede QA-ov prototip (`prototype/index.html`).
- **Klijent** je Vite + React SPA (odluka D4) koji poslužuje sam server, pa je sve na jednoj adresi i pokreće se jednom naredbom. Klijent samo prikazuje i šalje izbore; sve se računa na serveru.
- **Server** je modularni monolit: Fastify za HTTP, Socket.IO za realtime. Engine radi u memoriji; u bazu idu korisnici, profili, odluke, rezultati i cijeli log sesije. Odluke o bazi su u planu, §8.
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
│   ├── sim/                   # sesije samo s botovima, batch, statistika, replay, CLI
│   ├── server/                # Fastify + Socket.IO, auth, lobby, matchmaking, PostgreSQL/PGlite
│   └── web/                   # Vite + React klijent (lobby, igra, Life Recap) + e2e test
│       ├── data/              # careers.json, facts.json, events/*.json
│       ├── src/
│       └── test/
├── package.json               # workspaces i skripte
├── tsconfig*.json
└── vitest.config.ts
```


## Moguća poboljšanja

- Vidi milestonee M2–M8 u planu.
