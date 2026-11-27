# Napredak projekta Life Simulation

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

**MVP je funkcionalno kompletan (M1–M7)**, a koncept v2 je proveden do M11: grad odozgo, likovi B3, vrijeme i dob, rutina, preokreti i smicalice. Rad je **pauziran 15. studenog 2026.** na zahtjev vlasnika.

### Povratna informacija vlasnika (15. 11. 2026.) — prvo riješiti ovo

Vlasnik je igrao trenutnu verziju i javio:

1. **Igra je previše monotona.**
2. **Vrijeme za odgovor je prekratko.** Rokovi su 10–40 s vremena sesije; uz `TIME_SCALE=6`, kojim je vlasnik igrao, to je u stvarnosti samo 2–7 s. Treba provjeriti i rokove na normalnoj brzini (`TIME_SCALE=1`).
3. **Smicalice su prejednostavne.** Sada je to jedan klik (meta + vrsta) i jedan skriveni event kasnije.
4. Od ranije otvoreno: vlasnik igru **i dalje doživljava kao kartice** (tekstualni paneli dominiraju, a grad je pozadina). Postavljeno je pitanje „kad se tvom liku nešto dogodi, što bi volio vidjeti na ekranu i kako bi birao?”, a odgovor još nije stigao.

Prijedlog za sljedeći razgovor: pitati vlasnika što bi igru učinilo zanimljivijom, prije pisanja koda. Točke 1, 3 i 4 su vjerojatno isti problem: igrač samo reagira na tekst i nema razloga gledati grad. Točka 2 je brz popravak konfiguracije (rokovi i `TIME_SCALE` za demo), ali i nju treba potvrditi s vlasnikom.

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

### M10: kaos

- **Gradski preokreti** (`upheavals.json`: oluja, gripa, pad burze, festival, nestanak struje):
  - 2–3 po sesiji, raspoređeni po sredini sesije, svaki najviše jednom;
  - svakog lika pogode s vlastitom vjerojatnošću i porukom („A flying wheelie bin hits you.”);
  - dok traju, vrijedi činjenica grada koja otključava 5 novih eventa (×4 težina): stablo na autu, „pacijent nula”, panična prodaja (s nastavkom), natjecanje u pitama, svijeće u mraku.
- **Smicalice** (`mischief.json`: trač, anonimna pritužba šefu, ispuhane gume, ukradena ideja):
  - svaki lik ima 2 po sesiji; čovjek ih šalje kroz `game:mischief`, a bot nakon eventa prema osobnosti (sebičnost i agresivnost više, empatija manje, zamjerka bira metu);
  - posljedica je skriveni nastavak u kojem je krivac `aware: false`; žrtva ga može otkriti (`found_out`), a Life Recap otkriva sve (`secrets`).
- **Efekt leptira:** vjerojatnost nastavaka ×1.25 (`chaos.followUpBoost`).
- **Popravljena curenja tajne** (otkrivena pisanjem testova):
  - žrtva je vidjela krivca na popisu sudionika;
  - zajednički event ih je pretvarao u „poznanike”, što je vidljivo na popisu ljudi;
  - krivac je bio „zauzet” dok je trajao event žrtve, pa je 851 smicalica propala.
  Uloge `aware: false` sada nisu vidljive drugima, ne mijenjaju odnose i ne zaključavaju lika.
- **Web (privremeno, do M11):** traka s aktivnim preokretom, kartica „Pranks” (meta i smicalica, broj preostalih), „Secrets revealed” u recapu.
- **Testovi:** preokret (učinak na sve, trajanje, otključani eventi), smicalice (naboji, neispravna meta, tajnost, recap), botovi koriste smicalice i replay ih ponavlja, 2–3 preokreta po sesiji.
- **Batch (200 sesija):**
  - 2,5 preokreta i 5,1 smicalica po sesiji; 93 % smicalica stigne do žrtve; zahvaćeno je 53 % likova;
  - smrtnost 4,9 %; izvještaj je u `docs/reports/m10.report.md`.

### M11: prikaz grada i likova B3

- `web/src/town/renderer.ts`:
  - **mapa po godišnjim dobima:** boja trave i drveća, proljetni cvjetovi, jesensko lišće, snijeg na krovovima i tlu; prozori svijetle u tamnom načinu;
  - **likovi u stilu B3** iz odobrene skice: oči kao lukovi, debele obrve, velika usta, obrub u boji lika;
  - odjeća ovisi o karijeri (kuta, kapa, kombinezon, kravata, kaciga, naočale), a koža i kosa su stalne po liku; sijede s godinama, a umrli i zatvoreni su blijedi s „x” očima.
- `web/src/town/Town.tsx`:
  - canvas koji crta grad s animacijom od 8 sličica u sekundi;
  - likovi hodaju po rutama koje računa server, a klijent ih samo interpolira;
  - „!” iznad sudionika eventa; promjene tvojih atributa iskoče iznad glave; tvoj lik ima prsten i zeleno ime.
- **Ekran igre:** mapa je u sredini, panel s izborima je u desnom dijelu mape (na mobitelu ispod nje), a ishod se kratko prikaže u kutu mape. Ljudi, smicalice i vijesti su sa strane.
- **Važno otkriće u e2e:**
  - zaustavljanje servera ugasilo je samo `npx`, a stari server je ostao raditi na portu 3399;
  - zato su **e2e provjere za M9 i M10 zapravo išle protiv starog servera** (iz vremena M8);
  - unit i integracijski testovi to ne pogađa, jer pokreću vlastiti server;
  - popravak: e2e pokreće server u vlastitoj grupi procesa i gasi cijelu grupu, a odbija krenuti ako je port zauzet;
  - nakon popravka e2e prolazi na stvarnom kodu, na desktopu i na mobitelu.

### Popravak: datoteke sadržaja koje nisu bile u gitu (15. studenog 2026.)

- Pravilo `data/` u `.gitignore`, namijenjeno lokalnoj bazi, hvatalo je i `packages/content/data/`. Zato `map.json`, `upheavals.json`, `mischief.json` i 10 novih eventa nikad nisu bili commitani, a na vlasnikovom računalu server se nije mogao pokrenuti.
- Pravilo je sada `/data/` (samo baza u korijenu projekta), a datoteke su commitane.
- **Nova provjera prije završetka posla:** svjež `git clone` s GitHuba u scratchpad, pa `npm install`, `validate`, testovi, build i pokretanje servera. Prošlo je: 67 eventa, 97/97 testova, server poslužuje mapu.

## Napravljeno 27. studenog 2026.

### QA/PM pregled i plan poboljšanja

- Na projektu sada rade dva agenta: **QA/PM** (testira, istražuje, piše zadatke) i **developer** (implementira). Komuniciraju kroz [`INSTRUCTIONS_FOR_AGENT.md`](INSTRUCTIONS_FOR_AGENT.md); zadaci su tamo, u tri sprinta.
- QA je igrao u browseru na normalnoj brzini i analizirao batch izvještaj m10. Glavni nalazi: 74 % eventa je solo, svaki lik dobije istih 7 svakodnevnih eventa, rokovi se skraćuju s `TIME_SCALE` (uz 6× ostane 2–3 s), kartica eventa prekriva pola mape. Detalji i istraživanje sličnih igara: [`docs/reports/qa-research-2026-11-27.md`](docs/reports/qa-research-2026-11-27.md).
- Kod nije mijenjan.

### T1: rok za odluku u stvarnim sekundama (developer)

- **Uzrok:** rokovi su bili u vremenu sesije, pa ih je `TIME_SCALE` dijelio (uz 6× ostane 2–3 s).
- **Rješenje:** nova opcija enginea `humanPacing` (`engine/src/config.ts`). Postavlja je samo `LiveSession` na serveru, s vlastitim `timeScale`; simulacija i batch je nemaju, pa su sesije samo s botovima nepromijenjene (test to provjerava).
  - Ako u eventu odlučuje čovjek, rok je `8 s + 0,25 s po riječi` (javni + privatni tekst + izbori), ograničeno na 15–35 s (važni najmanje 25 s), +10 s ako odlučuje više ljudi. Računa se u stvarnim sekundama i pretvara u vrijeme sesije (× `timeScale`).
  - Odmor čovjeka nakon eventa je također u stvarnim sekundama (5–9 s, nakon važnog 10–14 s); dovršava se u T3.
  - Konfiguracija se zapisuje u `session_started`, pa je replay i dalje identičan.
- **Odmah razrješavanje:** kad svi ljudi u eventu odluče, botovi koji još „razmišljaju” odgovore odmah (`LiveSession.flushBotsIfHumansDone`, `Session.undecided`).
- `PACE_SCALE` (samo za testove) skraćuje sva stvarna trajanja za ljude; serverski test koristi 0,05.
- **Testovi:** `engine/test/pacing.test.ts` (rokovi uz 1× i 6×, bot-only nepromijenjen, determinizam) i `server/test/pacing.test.ts` (prvi rok uživo uz 6× i 1×, razrješenje u istom trenutku kad čovjek odluči, i s dva čovjeka). Provjereno da test pada kad se odmah razrješavanje isključi.

### T2: manje istih solo eventa, više eventa s drugim ljudima (developer)

- **Uzrok monotonije:** solo eventi su bili ograničeni samo po liku (`maxPerCharacter`), pa ih je dobio svaki lik, a eventi s više ljudi po sesiji (`maxPerSession: 1`), pa su se brzo potrošili.
- **Sadržaj:**
  - 4 od 7 „obaveznih” solo eventa sada imaju 2 uloge u kojima drugi lik odlučuje o tebi (verzija 2): Missed Bus (vozač te poveze ili se pravi da te ne vidi), Scratch in the Car Park (vlasnik auta traži snimku kamere ili prijavi policiji), Too Much Change (blagajnik te zove natrag, pokrije manjak ili ga krive), Annual Review (kolega te pohvali ili ti potkopa povišicu).
  - Svi solo eventi: najviše jednom po liku, težina ×0,6. Od starih 7 solo su ostali samo Overtime, Side Gig i Tax Refund, pa ih lik dobije najviše 3.
  - Eventi s više ljudi (osim kritičnih i onih vezanih uz preokret): `maxPerCharacter: 1`, `maxPerSession: 3`.
  - `critical_heart_attack`: najviše jednom po liku.
- **Direktor** (`config.director`):
  - ×3 težina ako je u eventu netko s kim lik ima pravi odnos (kolega, obitelj, partner, prijatelj, suparnik, neprijatelj ili par-činjenica poput duga, usluge, tajne), ×1,3 za poznanike;
  - takvi ljudi su pri popunjavanju uloga „bliži” za 10 polja;
  - solo eventi imaju težinu ×0,6.
- **Pragovi odnosa:** prijatelj od prosječne naklonosti 25 (bilo 40), suparnik od −15 (bilo −25). Bez toga je bilo premalo pravih odnosa, pa direktor nije imao koga birati.
- **Smicalice:** ista smicalica ne može dvaput pogoditi istu metu (engine je odbija, a bot pamti što je kome napravio). To je bio jedini izvor ponovljenih solo eventa.
- **Batch izvještaj:** novi redovi „Shared events” (udio eventa lika u kojima odlučuje još netko, udio eventa s ≥ 2 lika koji odlučuju, udio zajedničkih eventa s nekim s kim imaš odnos) i „Solo events” (po liku i ponavljanja).
- **Rezultat (200 sesija, `docs/reports/t2.report.md`)**, prije → poslije:

  | Mjera | Prije | Poslije |
  | --- | --- | --- |
  | Eventi lika u kojima odlučuje još netko | 47,4 % | 73,2 % |
  | Eventi s ≥ 2 lika koji odlučuju | 30,3 % | 57,4 % |
  | Zajednički eventi s nekim s kim imaš odnos | 23,2 % | 29,8 % |
  | Solo eventi po liku | 11,2 | 5,4 |
  | Ponovljeni solo event istom liku | 1980 | 0 |
  | Ponavljanje predloška | 9,1 % | 1,3 % |
  | Smrtnost | 6,9 % | 4,0 % |

- **Testovi:** `sim/test/sim.test.ts` (40 sesija: ≥ 55 % zajedničkih eventa, ponavljanje ≤ 5 %, nijedan solo event dvaput, najviše 3 stara solo eventa), engine test za istu smicalicu na istoj meti.

### T3: krivulja napetosti i finale (developer)

- **Faze** (`config.story`, `storyTimeline`): upoznavanje (0–15 %), rast, vrhunac (od 60 %), predah (30 s prije finala), finale (75 s prije kraja, najkasnije na 80 %). Za kratke sesije predah je najviše 8 % trajanja.
  - U logu: `phase_changed` (u tekstualnom logu „STORY: … phase”), a svaki `event_started` ima polje `phase`. Javni feed dobije `{ kind: "phase" }`.
  - Upoznavanje: nema kritičnih ni važnih eventa, svakodnevni i društveni ×1,5, solo eventi još manje vjerojatni. Vrhunac: kritični ×2, važni ×1,5. Predah: nema kritičnih, važni ×0,3.
  - Zadnji preokret je vrhunac na 62–70 % sesije; ostali preokreti su u fazi rasta (20–55 %).
- **Finale:** nova vrsta eventa `trigger: "finale"` (shema, validator, `docs/EVENT_FORMAT.md`). Kad dođe finale, novi eventi i smicalice više ne počinju; kad nitko živ nije u eventu i ljudi su odmorili, počinje jedan finale event za **sve žive likove**, a nakon njega sesija završava (`endReason: "finale"`).
  - 3 finala: **Fire on Market Street** (požar, netko je zarobljen), **A Wedding in the Park** (vjenčanje dvoje prijatelja/partnera), **The Last Town Meeting** (park ili tržnica; predsjedavajući može namjestiti glasanje).
  - Raniji odnosi se vide kroz izbore koji postoje samo uz odnos: „Run in: {trapped} was there for you once” (dug, usluga, spašen život), „Run in for your friend”, „Hold back” (suparnik), „I object!” (suparnik ili poznata tajna), „Pay for the party: you still owe them”, „Stand up for your friend / Heckle {chair}”.
  - Na serveru, kad dođe finale, botovi koji još „razmišljaju” odgovore odmah (inače bi ljudi čekali tuđe evente).
- **Pauza između eventa za čovjeka** (stvarne sekunde): odmor 6,5–10 s (nakon važnog 11–14 s); čovjek koji čeka više od 10 s dobije i solo event iako mu je kvota potrošena; direktor za ljude ponovno traži svake 2 s; čovjeku se mogu pridružiti botovi koji odmaraju. Izmjereno (10 sesija, odgovor za 4 s): uz 1× medijan 12 s (p10 9 s, p90 16 s, iznad 20 s oko 1 %), uz 6× medijan 9 s (7,6–13,5 s).
- **Sadržaj:** Overtime, Side Gig i Tax Refund najviše 3 puta po sesiji (prije su ih dobili svi), solo težina ×0,5.
- **Batch (200 sesija, `docs/reports/t3.report.md`):** sve sesije završe finalom; 64,4 % eventa ima ≥ 2 lika koji odlučuju (79,3 % po liku), ponavljanje 1,0 %, smrtnost 3,5 %, replay identičan. Sesija samo s botovima traje u prosjeku 432 s, jer botovi finale odluče brzo; s ljudima finale traje koliko i njihov rok.
- **Testovi:** `engine/test/pacing.test.ts` (faze redom, finale za sve žive, ništa kritično u upoznavanju, vrhunac 60–72 %, medijan pauze 8–15 s uz 1× i 6×, najviše 3 % iznad 20 s ili ispod 6 s), `server/test/pacing.test.ts` (uživo: do finala čovjek čeka < 5 s).
  - Ograničenje testa: s tim seedom u trenutku finala nijedan bot-only event nije bio u tijeku, pa test provjerava razmak, ali ne nužno i to da botovi odgovore odmah (provjereno isključivanjem: test i dalje prolazi). Logika je jednostavna (`flushAllBots`), ali nije izravno pokrivena.

### T4: popravci sučelja (developer)

- **B1, kartica eventa:** na 1280×800 kartica je zauzimala 334 od 696 px mape, a izbori su se skrolali unutar kartice (do 282 px). Sada:
  - ekran igre je širi (do 1240 px), mapa je 856×571, kartica je široka 300 px (najviše 38 % mape);
  - kartica je stupac: priča (naslov, tekstovi) se smanji i skrola ako je baš duga, a **izbori su uvijek cijeli vidljivi**; oznake posljedica su manje i stoje uz izbor;
  - na mobitelu je kartica fiksni „sheet” na dnu ekrana (do 82 % visine), pa je uvijek na ekranu, bez skrolanja stranice;
  - izmjereno skriptom na 4 eventa po uređaju: 0 izbora izvan ekrana, 0 px skrolanja kartice. `npm run e2e` to sada provjerava za svaki event (desktop i iPhone 13).
- **B2, „People” kasni:** potvrđeni uzrok nije redoslijed u engineu (`relations.meet` je prije poruka), nego klijent, koji je odnose osvježavao samo iz nove ponude eventa (`view.others`), a poruka ishoda ih nije nosila. Poruka `resolved` sada nosi `others` (odnosi nakon eventa), a klijent ih odmah prikaže, i nakon reconnecta. Test: `engine/test/ui-bugs.test.ts` (padao je prije popravka).
- **B3, „Around town”:** prikazuje samo evente s više ljudi, početak preokreta, smrti, bolnicu i zatvor te najavu finala (`isNewsworthy` u `web/src/format.ts`, test `web/test/feed.test.ts`). Smrt od starosti i u preokretu sada se objavljuje javno (prije se nije).
- **B4, ime lika:** u lobbyju je polje „Your character's name” s nasumičnim prijedlogom (🎲) i pamćenjem u pregledniku. Server prima `name` u `match:find` (2–16 slova, razmak, apostrof, crtica; inače `invalid_name`); bez imena ostaje korisničko ime. Botovi nikad ne dobiju isto ime kao igrač. Testovi: server (ime u rosteru, neispravna imena odbijena), engine (30 sesija bez duplih imena), e2e (ime u zaglavlju igre).

### QA prihvatio Sprint 1; T4b: sitnice iz QA igranja (developer)

- QA je Sprint 1 prihvatio (vidi `INSTRUCTIONS_FOR_AGENT.md`, Odgovori QA/PM) i dodao T4b i T7b.
- **N1:** „Only you know” je uvijek cijeli: u kartici se smije skrolati samo javni tekst; naslov, privatni tekst, „With” i izbori su fiksni. `npm run e2e` to provjerava za svaki event.
- **N2:** kartica ide na stranu mape suprotnu od mjesta eventa (kad se kartica otvori, tvoj lik već stoji na mjestu eventa, pa se strana određuje iz njegove pozicije).
- **N3:** tijekom finala sat pokazuje „Finale” umjesto „8:09 / 8:00”.
- **N4:** popis imena u tekstu: „Filip, Clara, Ana, Lana and Maja” (`listNames` u engineu; test).
- Provjereno skriptom u browseru na finalu (desktop i iPhone 13): sat „Finale”, privatni tekst cijeli, kartica na suprotnoj strani, gomila na mapi vidljiva.

### T5: event počinje na mapi (developer)

- **Najava:** kad event krene, sudionici dobiju poruku `coming` (naslov, mjesto, polje, `offerAt`, sudionici). Mjesto na mapi pulsira (tvoje jako, tuđi eventi slabije; javni event sada ima `tile`), sudionici hodaju s „!”, a iznad mape piše „{event} at {mjesto} — everyone is on the way…”.
- **Kartica** se otvara kad svi stignu (`offerAt`), **uz mjesto eventa**: 2,2 polja od mjesta, na strani mape gdje ima više mjesta, vertikalno poravnata s mjestom (zamjenjuje privremeni N2). Ponuda sada ima `tile`.
- **Mobitel:** kad event krene, stranica se pomakne na mapu, a mapa se zumira (1,9×) na mjesto eventa; kartica je i dalje sheet na dnu.
- **Nakon odluke:** 2,2 s **istovremenog otkrivanja**: kartice svih koji su odlučivali okrenu se odjednom (izbor se vidi ako ga ishod otkriva, inače „🤐 kept it to themselves”). U isto vrijeme likovi na mapi reagiraju: radost (skok, ruke gore), ljutnja (obrve u V, tresu se), tuga (suza), šok (velike oči, usta „O”). Tek onda dolazi tekst ishoda. Poruka `resolved` za to nosi `deciders` i `reactions`.
- **Testovi:** `engine/test/sprint2.test.ts` (najava prije ponude na istom polju, `deciders` i `reactions`, javni eventi s poljem). Provjereno skriptom u browseru (desktop: 3 eventa, kartica ne prekriva sudionike, otkrivanje pa ishod; iPhone 13: zum i sheet), bez grešaka u konzoli.

### T6: raspoloženje, odnosi i osobine na mapi (developer)

- **Raspoloženje:** engine svakom liku vodi raspoloženje (`content`, `happy`, `angry`, `sad`, `shocked`, `in_love`, `in_debt`, `sick`, `stressed`) iz reakcije na zadnji event i stanja (novi partner, dug, zdravlje ispod 30, psiha ispod 30). Promjena se objavljuje javno (`{ kind: "mood" }`), a snapshot ima `moods`. Na mapi je emoji iznad imena (😄 😠 😢 😱 😍 💸 🤒 😩; za „content” ništa).
- **Linije odnosa:** kad mišem prijeđeš preko lika (ili ga dodirneš), od tvog lika do njega ide linija u boji odnosa: prijatelj zeleno, suparnik/neprijatelj crveno, novac žuto (isprekidano), partner roza, obitelj ljubičasto, kolega plavo. Preko sebe vidiš linije do svih; za vrijeme zajedničkog eventa linije idu do sudionika. Legenda je u kartici „People”. `others` sada ima `debt` (`owes_you`, `you_owe`, `both`).
- **Osobina uz ime:** botovi je dobiju iz osobnosti (najizraženija osobina, npr. „Cheapskate”, „Hothead”, „Gullible”, i kombinacije „Hero Complex” i „Gossip”; 21 oznaka, najčešća je 12 %), a ljudi iz karijere („Silver Tongue”, „Nosy”…). Prikazuje se u popisu „People” i u imenu na mapi kad prijeđeš preko lika.
- Canvas ima `data-people` (pozicije likova na ekranu) za testove i za T9.
- **Testovi:** engine (raspoloženja se mijenjaju i objavljuju, dug vidljiv s obje strane), bots (osobine se razlikuju). Provjereno u browseru: preko sebe plava linija do kolegice i crvena do neprijateljice, osobina u imenu, 😠 nakon ispuhanih guma.

### T5b: sitnice iz QA T5 (developer)

- **R1:** navodnici oko oznake izbora se ne udvostručuju ako oznaka već počinje navodnikom (`quoted()` u `web/src/format.ts`, svugdje u igri i recapu; test).
- **R2:** nakon eventa u kojem je čovjek, svi sudionici ostaju na mjestu 5 stvarnih sekundi (otkrivanje kartica, reakcije i početak teksta ishoda), tek onda nastavljaju (timer `release` u engineu, `humanPacing.lingerSeconds`). Sesije samo s botovima su nepromijenjene. Test: nitko iz eventa ne krene prije isteka (pada kad je zadržavanje 0).
- **R3:** potvrđeni uzrok: klijent je atribute, kalendar, dob i odnose uzimao samo iz zadnje ponude u povijesti, koja je na početku prazna; početni odnosi (npr. partner iz seeda) zato su se vidjeli tek uz prvi event. Snapshot (`game:started`, `game:state`) sada nosi `me` (`Session.selfView`): atribute, kalendar, dob i sve odnose. Testovi: server (prvi snapshot) i e2e (zaglavlje puno prije prvog eventa).

### T6b: sitnice iz QA T6 (developer)

- **M1, previše tužnih lica:** batch izvještaj sada mjeri udio vremena u svakom raspoloženju (`runSession` ima `onPublic`, `BotSessionRun.moods`). Prije: tužno 40 % vremena. Uzroci: neutralan ishod je ostavljao staro raspoloženje (tuga „ostaje”), a i mali gubici (−5) su davali tugu. Sada neutralan ishod vraća mir, tuga traži gubitak od barem 8, radost dobitak od barem 6. Mir se na mapi prikazuje kao 🙂. Batch (200 sesija, `docs/reports/t6b.report.md`): mir 62 %, sreća 13 %, tuga 12 %, ljutnja 4 %. Test: tuga ≤ 30 %, mir najčešći.
- **M2, javni tekst odrezan:**
  - na desktopu kartica smije prijeći ispod mape (do dna ekrana), široka je 340 px (do 40 % mape), razmaci i oznake izbora su manji, redak „With” se ne prikazuje (sudionici su označeni na mapi), napomena o zadanom izboru je u jednom retku („If time runs out: …”, cijela u tooltipu);
  - na mobitelu sheet do 90 % visine, isto zbijeno;
  - skraćen javni tekst i nekoliko oznaka izbora u 11 eventa (privatni tekst nije diran);
  - **nova provjera `packages/web/e2e/card-fit.mjs`** (dio `npm run e2e`): s ugrađenim CSS-om iscrta karticu **svakog eventa i uloge** (109) s dugim imenima i najviše izbora koje jedan igrač može vidjeti, na 1280×800 i 390×664. Prije: 61 od 109 kartica je skrolalo; sada 0. Igra u e2e još provjerava i da se javni tekst ne skrola.
- **M3, agresivni zadani izbori:** validator upozorava ako zadani izbor ima oznaku `risk`, `lie` ili `threaten` (test). Ispravljeno 17 uloga: 12 ih sada ima postojeći miran izbor kao zadani (npr. Charity Drive „Hand in every cent”, Chest Pain „Book a doctor's appointment”), a 5 je dobilo novi pasivan izbor („Wait in the dark for the lights”, „Keep your head down and wait”, „Say nothing until you have a lawyer”, „Smile and change the subject”, „Laugh and drop it”). Pasivno odbijanje ili ignoriranje (koje hladi odnos) ostaje dopušteno kao zadani izbor.
- Smrtnost u batchu je 3,0 % (donja granica raspona 3–8 %), jer su zadani izbori sada sigurniji.

## Zadnja automatizirana provjera

Provedeno 27. studenog 2026. (nakon Sprinta 1, T1–T4):

| Provjera | Rezultat |
| --- | --- |
| Svjež `git clone` grane `dev` s GitHuba → `npm install`, `npm run check` | typecheck čist; 70 eventa, 0 grešaka, 0 upozorenja; **114/114 testova** |
| Svjež klon: `npm run web:build`, server + curl | build čist (94 kB gzip); `/api/health`, `/api/careers` i web stranica rade |
| `npm run e2e` | ✓ desktop 1280×800 i ✓ iPhone 13: cijela sesija s finalom, recap, log, lobby; za svaki event svi izbori na ekranu bez skrolanja; ime lika iz lobbyja |
| `npm run sim:batch -- --sessions 200 --seed t3` | sve sesije završe finalom; 64,4 % eventa s ≥ 2 lika koji odlučuju; ponavljanje 1,0 %; smrtnost 3,5 %; replay 3/3 identičan (`docs/reports/t3.report.md`) |
| Skripta u browseru (TIME_SCALE=6, 4 eventa po uređaju) | 0 izbora izvan ekrana, kartica 300 px na mapi od 856 px |
| Ranije (13. 11.): PostgreSQL 16 | nije ponovljeno u ovom sprintu (nema promjena u bazi) |

## Poznata ograničenja

- Oko 40 % zakazanih nastavaka ne stigne se aktivirati jer im rok pada nakon kraja sesije (`session_ended`). To su odgođene posljedice koje se „dogode poslije“. U Life Recapu se još ne prikazuju.
- Pojedini eventi su rijetki jer ovise o prethodnim događajima (kriza veze, istraga nesreće); to je namjerno.
- Botovi odlučuju u dijelu roka, pa je tempo u simulaciji gušći nego što će biti s ljudima. Tempo (rokovi, odmor između eventa) treba podesiti s pravim igračima.
- Nakon kraja sesije log otkriva sve tuđe odluke. To je namjerno „otkrivanje“ nakon igre, ali vlasnik možda želi drukčije.
- Restart servera prekida sesije u tijeku (označe se kao `cancelled`).
- Nema prijevoda sučelja; tekstovi igre su na engleskom (odluka D5).
- Engineer, teacher, mechanic, psychologist, journalist i civilian još nemaju poseban izbor ni u jednom eventu (dolazi s M4).
- Prije finala čovjek čeka da svi ostali završe svoje evente. Botovi tada odgovore odmah, ali ako je drugi čovjek u eventu, čekanje može trajati do njegovog roka (do 35–45 s).
- Pravih odnosa (prijatelj, suparnik, partner, dug…) u zajedničkim eventima je ~31 %. Eventi koji traže partnera (Jealousy, Crisis Talk) i dalje su rijetki, jer se partneri malo stvaraju.
- Sesija samo s botovima traje ~432 s umjesto 480, jer botovi finale odluče odmah; s ljudima finale traje koliko i njihov rok.
- Kad Zod `union` padne (uvjeti), poruka greške prikazuje grananje koje je stiglo najdublje. Ponekad je zato manje jasna od poruka za efekte.

## Sljedeći koraci

1. **QA testira Sprint 1** (`INSTRUCTIONS_FOR_AGENT.md`). Nakon njegove povratne informacije: Sprint 2 (T5–T9: event počinje na mapi, raspoloženje i odnosi na mapi, trajni tragovi, spletke u 3 koraka, pogađanje dok čekaš), pa Sprint 3 (T10–T12).
2. Nakon toga, po planu §9: M12 Sadržaj (humorističan ton, životne faze) i M13 Balans.

## Handoff za novi chat

1. Projekt je u `life-simulation/`. Prvo pročitati `docs/IMPLEMENTATION_PLAN.md` i `docs/EVENT_FORMAT.md`, a za detalje `docs/spec/`.
2. `cd life-simulation && npm install && npm run check` (typecheck, validacija sadržaja, testovi); `npm run sim -- --explain` za sesiju samo s botovima; `npm run start` za igru u browseru na http://localhost:3000; `npm run e2e` za browser test.
3. Granice: engine bez I/O i bez stvarnog sata; `bots` ovisi samo o `core` tipovima, nikad o `engine`; sadržaj eventa je JSON u `packages/content`, nikad u kodu; ne mijenjati koncept igre bez dogovora s vlasnikom.
