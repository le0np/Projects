# Napredak projekta Life Simulation

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

**MVP je funkcionalno kompletan (M1–M7).** Vlasnik je 14.–15. studenog 2026. dopunio koncept (`docs/spec/08_CONCEPT_V2.md`): grad gledan odozgo, vrijeme i starenje od 18 godina, kaos (gradski preokreti, smicalice, efekt leptira), humorističan ton i likovi u stilu B3. Rad se nastavlja po planu za koncept v2 (`docs/IMPLEMENTATION_PLAN.md` §9). **M8 (vrijeme i dob) i M9 (grad i rutina) su gotovi**; sljedeći je M10 (kaos).

### Kriteriji prihvaćanja (00_OVERVIEW)

| Kriterij | Stanje | Kako je provjereno |
|---|---|---|
| Registracija i ulazak u lobby | ✅ | server test (auth), e2e u browseru |
| Izbor karijere | ✅ | e2e (lobby → Doctor) |
| Matchmaking stvara sesiju s botovima | ✅ | server test (2 čovjeka + 2 bota), e2e (1 čovjek + 3 bota) |
| Sesija samo s botovima | ✅ | `npm run sim`, batch od 500 sesija, testovi u `sim` |
| Dinamički odabir eventa | ✅ | direktor s težinama i uvjetima; 57 eventa, ponavljanje 7 % |
| Različite privatne informacije | ✅ | engine test „information hiding“, uloge `aware: false` |
| Odluke botova prema osobnosti | ✅ | testovi u `bots`; batch izvještaj po arhetipovima |
| Trenutne i odgođene posljedice | ✅ | efekti ishoda + nastavci s odgodom (8 lanaca) |
| Prošli eventi utječu na buduće | ✅ | činjenice, odnosi i povijest u uvjetima; lanci |
| Različiti završeci sesije | ✅ | `time_limit`, `story_resolved`, `all_ended`; 14 oznaka ishoda |
| Smrt moguća, ne obavezna | ✅ | smrt u 31 % sesija (batch); test „death is possible but not mandatory“ |
| Life Recap | ✅ | engine test, ekran u browseru |
| Pregled cijelog loga sesije | ✅ | `/api/sessions/:id/log`, gumb u recapu, `sim --json`, replay |
| Radi u modernom browseru na desktopu i mobitelu | ✅ | e2e: Chromium 1280×800 i iPhone 13, bez horizontalnog skrolanja i grešaka u konzoli |

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

### M5: batch simulacija, statistika i replay (prije M4)

- `runBatch` pokreće N sesija s nasumičnim brojem botova u zadanom rasponu, nasumičnim karijerama i arhetipovima.
- `aggregate` i `formatReport` daju sve metrike iz 07 §2 te dvije dodatne mjere tempa:
  - metrike iz specifikacije: trajanje, eventi po sesiji i po liku, smrtnost, najčešći izbori i ishodi po eventu, uspješnost karijera, ponašanje arhetipova, stopa ponavljanja, nastavci (aktivirani i odbačeni po razlogu), odluke (default, odbijene), koliko puta direktor nije našao event, eventi koji se nikad ne pojave;
  - mjere tempa: udio vremena u eventima i vrijeme zadnje aktivnosti.
- `replaySession` rekonstruira sesiju iz loga (seed, konfiguracija, hash sadržaja, odluke s vremenima) i provjerava da je log identičan. Ako se verzija sadržaja ne poklapa, javlja grešku.
- CLI `npm run sim:batch` piše Markdown izvještaj (i JSONL logove s `--logs`) i na kraju provjerava replay.
- Polazni izvještaj prije M4: `docs/reports/baseline.report.md` (200 sesija, 4–8 botova):
  - samo 6 eventa: likovi su u eventima 5 % vremena, zadnja aktivnost dolazi u prosjeku 93 s nakon početka, 2,6 eventa po liku;
  - smrtnost 1,7 %, karijere 55,9–61,1 life score;
  - manipulatori lažu u 64 % odluka, a principijelni nikad ne umiru.
  Glavni cilj za M4 je zato ispuniti sesiju: ~12+ eventa po liku i aktivnost do kraja.

### M4: biblioteka eventa

- **57 eventa:**

  | Kategorija | Broj | Napomena |
  |---|---|---|
  | everyday | 12 | |
  | social | 10 | od toga 1 nastavak |
  | career | 9 | od toga 2 nastavka |
  | relationships | 6 | |
  | family | 3 | |
  | financial | 6 | od toga 2 nastavka |
  | health | 5 | |
  | critical | 7 | od toga 2 nastavka |

  Ukupno je 8 eventa koji nastaju samo kao nastavci.
- **Lanci:**
  - preporuka za posao → unaprjeđenje → dilema šefa (lanac iz 03 §6; šef može zaštititi, ignorirati ili otpustiti);
  - natjecanje za unaprjeđenje → dilema šefa;
  - tračanje → sukob oko glasina;
  - poruka na telefonu → razgovor o krizi veze;
  - zajednički kafić → nestali novac (zatvor);
  - bol u prsima → srčani udar (u koji ulazi novi sudionik);
  - nesreća s bijegom → istraga (policajac ili novinar);
  - posudba → dug, uz produljenje.
- Svaka karijera ima posebne izbore, a tagovi `technical`, `vehicle` i `secret` koriste se kroz više eventa.
- Nova mogućnost formata: uloga s `"aware": false`, kad je lik uključen, a ne zna to (trač, prisluškivanje, žrtva u istrazi). Dodana je u shemu, engine i validator, uz test.
- Novi test čuva zahtjeve biblioteke: barem 50 eventa, minimalna raspodjela po kategorijama, barem 5 nastavaka i nula upozorenja validatora.
- **Balansiranje kroz batch (500 sesija po krugu):**
  1. Prvi krug pokazao je tri problema:
     - 73 % sesija završavalo je požarom, pa je jedan kritični event postao gotovo obavezan završetak;
     - smrt se događala u 53 % sesija, a srčani udar ubijao je i kad je netko pomagao;
     - novac je sustavno padao (medijan -16).
  2. Popravci:
     - srčani udar je smrtonosan samo ako nitko ne pomogne;
     - kolaps na ulici događa se tek kad je zdravlje ≤ 55, sa 30 % šanse za smrt;
     - požar dolazi tek u zadnjih 30 % sesije, uz manju težinu, i završava sesiju samo kad je priča razriješena;
     - dodana su 2 eventa s prihodom (honorarni posao, godišnja ocjena).
  3. Rezultat (`docs/reports/m4.report.md`):
     - 22,8 eventa po liku, 42 % vremena u eventima, zadnja aktivnost na 457 s od 480;
     - smrt kod 5,7 % likova i u 31 % sesija; razrješenje priče u 11 % sesija;
     - medijan promjene novca +6;
     - karijere i arhetipovi u razumnom rasponu.
- Odmor između eventa produljen je s 4–12 s na 6–15 s, jer ljudski igrač mora stići pročitati ishod. Ovo je parametar za podešavanje u M8.

### M6: multiplayer server (`packages/server`)

- **HTTP (Fastify):** registracija (validacija preko Zoda), prijava korisničkim imenom ili emailom, odjava, profil (statistika i zadnjih 5 Life Recapa), avatar, karijere, lobby, log sesije (samo za sudionike, kao JSON i kao čitljiv tekst), health.
- **Socket.IO:**
  - autentifikacija tokenom, praćenje tko je online, broj igrača u lobbyju;
  - matchmaking: `match:find` i `match:cancel`;
  - igra: `game:decide` (s potvrdom), `game:notice`, `game:feed`, `game:ended`;
  - ponovno spajanje: `game:state` odmah pri spajanju i `game:resume` na zahtjev.
- **`LiveSession`:**
  - engine radi u stvarnom vremenu (`TIME_SCALE` ga može ubrzati); botovi i ljudi koriste isto `submitDecision`;
  - za odspojenog igrača primjenjuje se default kad istekne rok;
  - snapshot za ponovno spajanje sadrži trenutnu ponudu, povijest i feed.
- **Matchmaker:** sesija kreće kad je u redu `MAX_HUMANS` igrača ili nakon `FILL_AFTER_SECONDS`; ostala mjesta do `SESSION_SIZE` popunjavaju botovi. Odspojeni igrač se miče iz reda.
- **Baza:**
  - migracija `001_init.sql` s 9 tablica (odluke o modelu su u planu, §8);
  - driver `pg` za PostgreSQL ili PGlite bez ikakve pripreme;
  - pri pokretanju se sesije prekinute restartom označe kao `cancelled`.
- **Engine:** dodan javni feed (`onPublic`). Validator zahtijeva da event s ulogama `aware: false` bude `hidden`; to je popravljeno u `social_gossip` i `critical_accident_investigation`, jer bi inače javni tekst otkrio trač samoj meti.
- **Testovi:**
  - auth (registracija, duplikati, neispravan unos, prijava, odjava, socket bez tokena);
  - cijela sesija s 2 čovjeka i 2 bota preko pravih WebSocket klijenata, 30× ubrzano, uključujući odspajanje i ponovno spajanje drugog igrača te provjeru baze (status, odluke, rezultati, profil, log, zabrana pristupa logu strancu);
  - matchmaker.
  Test sesije prolazi i na PGliteu i na pravom PostgreSQL-u 16 (`TEST_DATABASE_URL`).
- Ispravljena greška u testu, važna i za klijent: poruka poslana odmah pri spajanju može stići prije nego klijent doda slušatelja. Test zato sprema sve poruke od prvog trenutka.

### M7: web klijent (`packages/web`)

- **Arhitektura:**
  - Vite + React 19 SPA, a izgrađen klijent poslužuje sam server (`@fastify/static`, SPA fallback); `npm run start` izgradi i pokrene sve;
  - u razvoju `npm run web:dev` s proxyjem na server.
- **Ekrani:**
  - prijava i registracija;
  - lobby: avatar, statistika, broj igrača online i aktivnih sesija, izbor karijere s opisom sposobnosti, jakih i slabih strana, matchmaking s odbrojavanjem do popune botovima, prijašnji životi s recapom;
  - igra: sat sesije, atributi, event s javnim i privatnim tekstom („Only you know“), odbrojavanje, izbori s percipiranim posljedicama i uvidom karijere, poseban izbor označen kao „Your expertise“, zadani izbor naveden unaprijed, ishod s otkrivenim tuđim izborima i promjenama vlastitih atributa, priča dosad, ljudi s tipom odnosa, javni feed, banner za spectator nakon kraja priče;
  - Life Recap s gumbom za cijeli log sesije.
- **Pravednost:** čovjek vidi iste percipirane posljedice kao bot. Nepoznate posljedice se ne prikazuju ni jednima ni drugima.
- **Ponovno spajanje:** klijent se automatski vraća u sesiju iz `game:state`.
- **Stil:** tokeni za svijetli i tamni način, mobile-first, vidljiv fokus i ARIA uloge (tab, radio, meter, live regije).
- **E2E (`npm run e2e`):** pravi server (8× ubrzan, PGlite u memoriji) + Chromium, na desktopu (1280×800) i na iPhoneu 13. Prolazi registraciju, izbor karijere, matchmaking s botovima, cijelu sesiju, Life Recap, log, povratak u lobby i prijašnje živote, uz provjeru da nema horizontalnog skrolanja ni grešaka u konzoli.
- Pregledom snimki zaslona uočen je i ispravljen prikaz ID-a karijere (`police_officer`) umjesto imena.

## Napravljeno 14. studenog 2026.

### Popravak: pokretanje na svježem kloniranju

- `npm run start` je padao s `ENOENT: mkdir …/data/pglite`, jer PGlite stvara samo zadnju mapu u putanji, a `data/` ne postoji u kloniranom repou. Server sada sam napravi mapu (`mkdirSync(…, { recursive: true })`).
- Greška se nije vidjela jer su testovi i ručne provjere uvijek koristili bazu u memoriji. Provjereno je sada bez mape `data/`: prvo pokretanje stvori bazu i izvrši migraciju, drugo koristi postojeću bazu.
- Projekt je prebačen na granu `dev` (fast-forward), kako traži `CLAUDE.md`.

### Koncept v2 (dogovor s vlasnikom)

- Uz vlasnika je kroz skice i pitanja dogovoren novi smjer; zapisan je u `docs/spec/08_CONCEPT_V2.md`, a odobrene skice su u `docs/sketches/`.
- Odbačeni smjerovi, da se ne vraćamo na njih:
  - kartice bez mape;
  - pravi sandbox u kojem igrač upravlja figuricom;
  - Among Us s tajnim saboterima;
  - „svatko ima tajni cilj protiv nekoga”;
  - dug život kao glavni cilj;
  - lica nalik South Parku (stil B s velikim bijelim očima).

### M8: vrijeme i dob

- `core`:
  - `calendarAt` i `ageAt`: godina traje `yearSeconds` (zadano 30 s), a dijeli se na četiri godišnja doba;
  - novi uvjeti `{ age: { gte, lte }, of }` i `{ seasonIn: [...] }`;
  - lik vidi `calendar` (godina i godišnje doba) i svoju dob (`self.age`);
  - Life Recap ima `ageAtEnd`.
- `engine`:
  - konfiguracija `yearSeconds`, `startAge` (18) i `aging` (od 30. godine zdravlje slabi za 1 svake nove godine);
  - timer na svakoj granici godišnjeg doba upisuje `season_changed` u log, šalje ga u javni feed i na proljeće primjenjuje starenje; lik kojem zdravlje padne na 0 umire od starosti („Worn out by the years”).
- Validator hvata nemoguće dobne granice.
- Web zasad samo prikazuje godišnje doba, godinu i dob u zaglavlju te dob u recapu. Prava diorama dolazi u M11.
- Testovi: kalendar, uvjeti dobi i godišnjeg doba, slijed godišnjih doba, starenje, dob na kraju i u prikazu lika, event koji ovisi o zimi i dobi.
- Batch (200 sesija, 4–8 botova):
  - sesija od 8 minuta pokriva 16 godina, pa likovi dožive 34 godine (umrli ranije od 22);
  - godišnje doba se promijeni 63 puta po sesiji;
  - starenje do 34. godine nikoga ne ubija; smrtnost je ostala 5,6 % likova.

### M9: grad i rutina

- **Mapa kao sadržaj:** `packages/content/data/map.json` (24×16 pločica, ceste, 17 mjesta, od toga 8 kuća). `TownMap` u `core` traži puteve (BFS, s cacheom).
- **Validator mape:** vrata na hodnoj pločici, sva mjesta dostižna, barem 8 kuća, postoji radno mjesto za svaku karijeru, mjesta eventa postoje na mapi.
- **Karijere:** svaka ima `workplace` (doktor i psiholog → bolnica, inženjer, odvjetnik i novinar → ured, učitelj → škola, mehaničar → radiona, poduzetnik → kafić, civil → dućan, policajac → policija).
- **Format eventa:**
  - `location: { at: [...], of }`: vrsta mjesta, `home`, `work`, `street` ili `here`; bira se najbliža opcija;
  - efekt `{ type: "move", target, to, staySeconds }` šalje lika negdje nakon eventa.
  Svih 57 eventa dobilo je mjesto, a 11 njih i odlaske (bolnica, policija, kuća).
- **Engine:**
  - svaki lik ima kuću, radno mjesto, položaj i putovanje; brzina je 4 pločice u sekundi, a položaj u bilo kojem trenutku daje `positionAt`;
  - **rutina** u svakom godišnjem dobu: prvih 15 % je noć (kuća), do 60 % posao (za zaposlene), a ostatak slobodno vrijeme, koje bot bira prema osobnosti (impulzivni češće u bar, oprezni kod kuće);
  - **okupljanje:** sudionici prvo dođu na mjesto, tek onda se pojave izbori (`offerAt`); odluka prije okupljanja se odbija; lik s ulogom `aware: false` ostaje gdje jest;
  - direktor prednost daje likovima u blizini, a event koji odgovara mjestu gdje se lik nalazi ima veću težinu;
  - zatvoreni idu u policiju, hospitalizirani u bolnicu.
- **Log:**
  - `moved` (svako kretanje, s razlogom);
  - `leisure` (izbor slobodnog vremena; replay ga treba, a test je to otkrio: bez njega replay nije bio identičan);
  - `event_started` s mjestom i `offerAt`.
- **Server:** `GET /api/map`; snapshot sadrži položaje i kuće; kretanja idu klijentu kroz `game:feed` (prikaz dolazi u M11).
- **Testovi:** rutina (kuća, posao, slobodno vrijeme), okupljanje i ponuda tek nakon dolaska, odbijanje rane odluke, efekt kretanja, odlazak u zatvor, izbor slobodnog vremena prema osobnosti, `positionAt`.
- **Batch (200 sesija):**
  - okupljanje traje u prosjeku 1,75 s (90 % unutar 4 s);
  - po sesiji oko 500 rutinskih kretanja i 110 dolazaka na evente;
  - 21 event po liku, 48 % vremena u eventima, smrtnost 4,3 %.

## Zadnja automatizirana provjera

Provedeno 13. studenog 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npm run typecheck` | prolazi |
| `npm run validate` | 57 eventa, 0 grešaka, 0 upozorenja; hash sadržaja `8554608747611859` |
| `npm test` | 94/94 testova prolazi |
| `TEST_DATABASE_URL=… npx vitest run packages/server` | 4/4 na PostgreSQL 16 (privremeni lokalni klaster); u bazi: sesija `completed`, 40 odluka igrača i 1 default (dok je igrač bio odspojen), 4 rezultata |
| `npm run server` + curl | health, registracija, validacijske poruke, karijere rade |
| `npm run typecheck` (uključuje web) i `npm run web:build` | čisto; bundle 88 kB gzip |
| `npm run e2e` | ✓ desktop (12 odluka) i ✓ iPhone 13 (11 odluka): cijela sesija, recap, log, lobby |
| `npm run sim:batch -- --sessions 500 --seed m4` | 500 sesija; replay 3/3 identičan; izvještaj u `docs/reports/m4.report.md` |
| `npm run sim -- --seed demo --explain` | sesija sa 6 botova, 10 eventa, 1 nastavak; odluke su u skladu s osobnostima (npr. principijelan bot posuđuje novac i oprašta dug, manipulator laže i izbjegava vjerovnika) |
| Ručno: CLI na pokvarenoj kopiji sadržaja | izlazni kod 1; prijavljuje neispravan JSON i nepostojeći nastavak |

## Poznata ograničenja

- Oko 40 % zakazanih nastavaka ne stigne se aktivirati jer im rok pada nakon kraja sesije (`session_ended`). To su odgođene posljedice koje se „dogode poslije“. U Life Recapu se još ne prikazuju.
- Pojedini eventi su rijetki jer ovise o prethodnim događajima (kriza veze, istraga nesreće); to je namjerno.
- Botovi odlučuju u dijelu roka, pa je tempo u simulaciji gušći nego što će biti s ljudima. Tempo (rokovi, odmor između eventa) treba podesiti s pravim igračima.
- Nakon kraja sesije log otkriva sve tuđe odluke. To je namjerno „otkrivanje“ nakon igre, ali vlasnik možda želi drukčije.
- Restart servera prekida sesije u tijeku (označe se kao `cancelled`).
- Nema prijevoda sučelja; tekstovi igre su na engleskom (odluka D5).
- Engineer, teacher, mechanic, psychologist, journalist i civilian još nemaju poseban izbor ni u jednom eventu (dolazi s M4).
- Kad Zod `union` padne (uvjeti), poruka greške prikazuje grananje koje je stiglo najdublje. Ponekad je zato manje jasna od poruka za efekte.

## Sljedeći koraci

1. ~~M8 Vrijeme i dob~~ → ~~M9 Grad i rutina~~ (gotovo) → M10 Kaos → M11 Prikaz → M12 Sadržaj → M13 Balans (plan §9).

## Handoff za novi chat

1. Projekt je u `life-simulation/`. Prvo pročitati `docs/IMPLEMENTATION_PLAN.md` i `docs/EVENT_FORMAT.md`, a za detalje `docs/spec/`.
2. `cd life-simulation && npm install && npm run check` (typecheck, validacija sadržaja, testovi); `npm run sim -- --explain` za sesiju samo s botovima; `npm run start` za igru u browseru na http://localhost:3000; `npm run e2e` za browser test.
3. Granice: engine bez I/O i bez stvarnog sata; `bots` ovisi samo o `core` tipovima, nikad o `engine`; sadržaj eventa je JSON u `packages/content`, nikad u kodu; ne mijenjati koncept igre bez dogovora s vlasnikom.
