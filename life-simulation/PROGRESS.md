# Napredak projekta Life Simulation

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

**Prvi igrivi prototip postoji (M3):** cijela sesija se odigra samo s botovima čije odluke ovise o osobnosti, motivima i sjećanju (`npm run sim`). Sadržaja je još malo (6 eventa), pa likovima nakon otprilike 2–4 minute ponestane eventa. Sljedeći su M4 (50+ eventa) i M5 (batch statistika).

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

### M3: botovi (`packages/bots`) i simulacijski CLI (`packages/sim`)

- Sučelje `Controller` premješteno je u `core`. Paket `bots` ovisi samo o `core`, a test provjerava da ne uvozi ništa drugo. Bot tako fizički ne može pročitati skriveno stanje (02 §8).
- Osobnost: 10 osobina 0–100 (osobina „Trust“ iz specifikacije zove se `trusting`, vidi K2). Postoji 10 arhetipova sa srednjim vrijednostima, a svaka osobina dobiva individualnu varijaciju (sd 10), pa je svaki bot jedinstven. Bot dobiva 1–2 motiva iz skupa svog arhetipa, jačine 0.4–0.9.
- Motivi:
  - vezani uz osobu (zaštiti prijatelja, sačuvaj odnos, stekni povjerenje) cilj biraju iz onoga što bot vidi;
  - osveta nastaje iz zamjerki: agresivniji bot je razvije lakše.
- Bodovanje:
  - korisnost izbora zbraja osobnu korist (iz percipiranih posljedica, s težinama po osobinama), moralnu usklađenost (tablica oznaka izbora × osobine, konfigurabilna), utjecaj na odnose i motive, a oduzima rizik (nepoznat rizik vrijedi 0.2);
  - koliko bot mari za drugog lika ovisi o naklonosti, povjerenju, sjećanju, empatiji, lojalnosti i agresivnosti.
- Slučajnost: softmax s temperaturom 0.12 + 0.45 × impulzivnost.
- Vrijeme razmišljanja: impulzivni botovi odgovaraju brže, a svi uvijek unutar roka.
- Sjećanje sesije gradi se iz botovih vlastitih obavijesti: susreti, otkriveni tuđi izbori (pomoć → zahvalnost; laž ili prijetnja → zamjerka), a neobjašnjiv gubitak budi blagu sumnju prema sudionicima.
- Svaka odluka bilježi razloge (`traces`): korisnost i vjerojatnost svakog izbora. CLI ih ispisuje s `--explain`.
- `packages/sim`: `runBotSession`, `createBotParticipants` i CLI `npm run sim` s opcijama `--players`, `--seed`, `--careers`, `--archetypes`, `--duration`, `--explain`, `--json` i `--quiet`.
- Testovi:
  - profili: deterministični i jedinstveni;
  - ponašanje prema osobnosti: principijelni govore istinu > 80 %, manipulatori < 30 %; altruisti pomažu češće od oportunista; impulzivni riskiraju češće od opreznih;
  - nijedan arhetip ne bira uvijek isto;
  - naklonost mijenja procjenu, sjećanje radi, osveta nastaje;
  - sesija samo s botovima završi bez defaulta i odbijenih odluka i ponovljiva je iz seeda.

## Zadnja automatizirana provjera

Provedeno 13. studenog 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npm run typecheck` | prolazi |
| `npm run validate` | 6 eventa, 0 grešaka, 6 upozorenja (6 karijera još nema poseban izbor, očekivano do M4); hash sadržaja `feea9c890b061482` |
| `npm test` | 74/74 testova prolazi (core 20, content 18, engine 21, bots 12, sim 3) |
| `npm run sim -- --seed demo --explain` | sesija sa 6 botova, 10 eventa, 1 nastavak; odluke su u skladu s osobnostima (npr. principijelan bot posuđuje novac i oprašta dug, manipulator laže i izbjegava vjerovnika) |
| Ručno: CLI na pokvarenoj kopiji sadržaja | izlazni kod 1; prijavljuje neispravan JSON i nepostojeći nastavak |

## Poznata ograničenja

- Sa samo 6 eventa likovi nakon otprilike 2 minute ostanu bez sadržaja i sesija čeka kraj. To se rješava s M4 (50+ eventa).
- Engineer, teacher, mechanic, psychologist, journalist i civilian još nemaju poseban izbor ni u jednom eventu (dolazi s M4).
- Kad Zod `union` padne (uvjeti), poruka greške prikazuje grananje koje je stiglo najdublje. Ponekad je zato manje jasna od poruka za efekte.
- Tagovi `technical` i `vehicle` (sposobnosti inženjera i mehaničara) još se ne pojavljuju ni u jednom eventu.

## Sljedeći koraci

1. M5 (ranije, jer pomaže pisati sadržaj): batch simulacija stotina sesija, statistika iz 07 §2 i balansni izvještaj.
2. M4: biblioteka od 50+ eventa po raspodjeli iz 03 §9 (+ Family), posebni izbori za sve karijere i lanci.
3. Replay iz zapisanih odluka.
4. M6: server.

## Handoff za novi chat

1. Projekt je u `life-simulation/`. Prvo pročitati `docs/IMPLEMENTATION_PLAN.md` i `docs/EVENT_FORMAT.md`, a za detalje `docs/spec/`.
2. `cd life-simulation && npm install && npm run check` (typecheck, validacija sadržaja, testovi); `npm run sim -- --explain` za sesiju samo s botovima.
3. Granice: engine bez I/O i bez stvarnog sata; `bots` ovisi samo o `core` tipovima, nikad o `engine`; sadržaj eventa je JSON u `packages/content`, nikad u kodu; ne mijenjati koncept igre bez dogovora s vlasnikom.
