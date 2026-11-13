# Napredak projekta Life Simulation

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

M2 je gotov: engine izvrti cijelu sesiju bez grafike, s paralelnim eventima, rokovima, ishodima, nastavcima, završecima, logom i Life Recapom. Za sada odluke donosi nasumični testni kontroler. Sljedeći je M3 (botovi).

## Napravljeno 13. studenog 2026.

### Pregled specifikacije i plan (M0)

- Spremljeno 7 dokumenata specifikacije + pregled (globalna pravila, kriteriji prihvaćanja) u `docs/spec/`.
- Napisan `docs/IMPLEMENTATION_PLAN.md`: 14 nedosljednosti (K1–K14) s prijedlozima, 10 tehničkih odluka, arhitektura (npm workspaces: core, content, engine, bots, sim, server, web), model lika, skica sheme eventa, direktor, bot, milestonei M0–M8, redoslijed i rizici.
- Ključne odluke: engine je čista deterministička biblioteka (seedani PRNG s odvojenim tokovima, apstraktni `Clock`, log domenskih događaja); botovi i ljudi dijele isto `Controller` sučelje i dobivaju istu projekciju stanja (`CharacterView`); izbori imaju odvojene „percipirane“ posljedice od stvarnih efekata.

### Odluke vlasnika

- D1–D5 su potvrđene u preporučenom obliku: paralelni eventi, samo narativni NPC-ovi, početni odnosi iz seeda, Vite + React umjesto Next.js, tekstovi igre na engleskom.

### M1: temelji i format sadržaja

- Monorepo s npm workspaces (`packages/*`); paketi se pokreću izravno iz `.ts` (tsx, Vitest), bez builda. TypeScript 5.9 strict s `noUncheckedIndexedAccess`.
- `core`:
  - konstante (atributi, tipovi odnosa, statusi, kategorije, oznake izbora);
  - `Rng` (sfc32 + cyrb128, `fork(name)` za neovisne tokove);
  - `VirtualClock` i `TimerQueue` (FIFO kod jednakih vremena);
  - reference (`self`, `role:x`, `session`);
  - DSL uvjeta s evaluatorom i walkerom;
  - Zod sheme za evente, karijere i činjenice.
- `content`:
  - `careers.json` (10 karijera, 2–3 sposobnosti s modifikatorima `effect_multiplier`, `selection_weight` i `start_bonus`);
  - `facts.json` (registar činjenica sa scopeom character, pair ili session);
  - 6 eventa: `everyday_missed_bus` (solo), `career_coworker_mistake` → `career_retaliation` (lanac, skriveni nastavak), `health_collapse_street` (pasivna uloga, uloga s 1–2 člana, posebni izbori liječnika i policajca, `insight`, smrt kao posljedica tuđih odluka), `financial_loan_request` → `financial_loan_due` (dug kao pair fact, nastavak koji poziva sam sebe s odgodom).
- Validator: strukturalne greške s točnom putanjom te provjere referenci, scopea činjenica, redoslijeda uvjeta uloga, defaulta, nedostižnih ishoda, konflikata, kardinalnosti nastavaka, trenutnih petlji i dostižnosti `followup_only` eventa iz direktorskih eventa.
- Odluke o semantici zapisane su u `docs/EVENT_FORMAT.md`:
  - ishodi se provjeravaju redom i primjenjuje se prvi koji odgovara;
  - efekti izbora primjenjuju se jednom za svakog lika koji ga odabere;
  - uvjet nad višečlanom ulogom vrijedi samo ako vrijedi za svakog člana;
  - uvjeti uloge smiju se pozivati samo na ranije deklarirane uloge;
  - nemapirane ciljne uloge nastavka popunjava engine.
- Test je otkrio grešku: event koji poziva sam sebe smatrao se dostižnim. Dostižnost se sada računa obilaskom grafa nastavaka od direktorskih eventa.

### M2: engine (`packages/engine`)

- `core/view.ts`: `CharacterView`, `Notice` i `LifeRecap` su zajednički tipovi. Bot i klijent dobivaju samo `CharacterView`, tj. projekciju stanja koju lik smije vidjeti, pa je fer ponašanje botova osigurano strukturom koda.
- `Session` je čisti stroj stanja (INITIALIZING → ACTIVE → COMPLETED/CANCELLED) koji vodi domaćin:
  - `start()`, `submitDecision()`, `processTimers()` i `nextWakeAt()`;
  - poruke likovima idu kroz `onNotice`, a sve se bilježi u `log`.
- Direktor:
  - eventi teku paralelno (D1), svaki lik je u najviše jednom eventu;
  - uloge se dodjeljuju pohlepno, redom deklaracije, uz provjeru uvjeta uloge, karijere, `maxPerCharacter` i uvjeta eventa;
  - težina eventa ovisi o modifikatorima karijere, kazni za ponavljanje (×0.35 po pojavljivanju), raznolikosti kategorija, povijesti odnosa (×1.5) i rastu kritičnih eventa kroz sesiju;
  - nakon eventa lik se odmara 4–12 s, a početak sesije je stupnjevan;
  - postoji jedan zajednički lanac ponovnih pokušaja, jer je u prvoj verziji svaki event stvarao novi lanac (7381 → 480 pokušaja po sesiji).
- Odluke:
  - validacija vrijedi za sve: event postoji i nije razriješen, lik odlučuje, nije već odlučio, izbor mu je ponuđen;
  - nakon roka primjenjuje se default.
- Razrješenje:
  - efekti izbora primjenjuju se za svakog lika koji ga je odabrao, zatim prvi ishod koji odgovara (uz vjerojatnost);
  - modifikatori karijere skaliraju efekte;
  - zajednički event pretvara strance u poznanike;
  - zdravlje 0 znači smrt, a mentalno stanje 0 slom i hospitalizaciju;
  - nastavci se zakazuju s odgodom i preslikanim ulogama.
- Odnosi:
  - naklonost i povjerenje su smjerni, a tip je simetričan i izvodi se iz prosječne naklonosti (≥40 prijatelj, ≤-25 rival, ≤-60 neprijatelj);
  - obitelj, partner i tipovi koje postavi event su zaključani;
  - kolege mogu postati prijatelji ili rivali. Ovo je promijenjeno nakon što je test pokazao da zaključani „kolega“ ne može prerasti u prijateljstvo.
- Nastavak koji čeka zauzete sudionike čeka najviše 90 s. Odbacuje se ako sudionik više nije aktivan ili uvjet ne vrijedi; svi razlozi se broje u statistici.
- Kraj sesije nastupa kad istekne vrijeme, kad su sve priče završile ili kad je priča razriješena (`endsSession`). Eventi koji su već u tijeku pritom se dovrše.
- Početni odnosi (D3): round(n × 0.25) parova kolega, 30 % šanse za obitelj, 25 % za partnere. Atributi su bazni ± 8, uz bonuse karijere.
- Life Recap sadrži:
  - ishode (status, ozljedu, promjene karijere i novca, stečene i izgubljene odnose, žrtvu);
  - ključne trenutke, likove koji su utjecali na sudbinu i interni `lifeScore`.
  Oznake iz činjenica određuje sadržaj kroz `facts.json`, polje `recap` (npr. `saved_by` → spasitelj dobiva `saved_another`).
- `formatLog` daje čitljiv kronološki log kao u 07 §4. `runSession` pokreće sesiju u virtualnom vremenu sa sinkronim kontrolerima. `RandomController` služi za testiranje enginea neovisno o botovima.
- Testovi:
  - determinizam;
  - invarijante preko 40 nasumičnih sesija s 2–8 likova: sve završi, svaki event se razriješi točno jednom, odluka najviše jednom, nitko nije u dva eventa, nitko ne dobiva evente nakon kraja priče, nema eventa nakon roka, atributi u rasponu, smrt moguća ali ne obavezna;
  - skrivanje privatnih informacija;
  - validacija odluka, timeout i default, kombinacije simultanih odluka, otkrivanje izbora, modifikatori karijera;
  - nastavci s odgodom, odbačeni nastavci, smrt i `all_ended`, `endsSession`, oznake u recapu, početni odnosi.

## Zadnja automatizirana provjera

Provedeno 13. studenog 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npm run typecheck` | prolazi |
| `npm run validate` | 6 eventa, 0 grešaka, 6 upozorenja (6 karijera još nema poseban izbor, očekivano do M4); hash sadržaja `feea9c890b061482` |
| `npm test` | 59/59 testova prolazi (core 20, content 18, engine 21) |
| Ručno: CLI na pokvarenoj kopiji sadržaja | izlazni kod 1; prijavljuje neispravan JSON i nepostojeći nastavak |

## Poznata ograničenja

- Odluke su zasad nasumične (bez botova).
- Sa samo 6 eventa likovi nakon otprilike 2 minute ostanu bez sadržaja i sesija čeka kraj. To se rješava s M4 (50+ eventa).
- Engineer, teacher, mechanic, psychologist, journalist i civilian još nemaju poseban izbor ni u jednom eventu (dolazi s M4).
- Kad Zod `union` padne (uvjeti), poruka greške prikazuje grananje koje je stiglo najdublje. Ponekad je zato manje jasna od poruka za efekte.
- Tagovi `technical` i `vehicle` (sposobnosti inženjera i mehaničara) još se ne pojavljuju ni u jednom eventu.

## Sljedeći koraci

1. M3, paket `bots`:
   - osobnosti, 10 arhetipova i skriveni motivi;
   - utility bodovanje iz `perceived` i oznaka izbora, softmax odabir i sjećanje sesije;
   - CLI `npm run sim`.
2. M4: biblioteka od 50+ eventa.
3. M5: batch simulacija, statistika i replay.

## Handoff za novi chat

1. Projekt je u `life-simulation/`. Prvo pročitati `docs/IMPLEMENTATION_PLAN.md` i `docs/EVENT_FORMAT.md`, a za detalje `docs/spec/`.
2. `cd life-simulation && npm install && npm run check` (typecheck, validacija sadržaja, testovi).
3. Granice: engine bez I/O i bez stvarnog sata; `bots` ovisi samo o `core` tipovima, nikad o `engine`; sadržaj eventa je JSON u `packages/content`, nikad u kodu; ne mijenjati koncept igre bez dogovora s vlasnikom.
