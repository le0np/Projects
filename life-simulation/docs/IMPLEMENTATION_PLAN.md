# Pregled specifikacije i plan implementacije

Verzija 1 · 13. studenog 2026. · odnosi se na [Game Development Package v1.0](spec/00_OVERVIEW.md)

Ovaj dokument je odgovor glavnog developera na specifikaciju: što je u njoj nedosljedno ili nedorečeno, kako to predlažem riješiti, kakva je arhitektura i kojim redom se gradi. Koncept igre ne mijenjam. Prijedlozi koji zadiru u dizajn označeni su s **[ODLUKA]**. Vlasnik je sve odluke (D1–D5) potvrdio 13. studenog 2026., u preporučenom obliku.

---

## 1. Nedosljednosti u specifikaciji

| # | Gdje | Problem | Prijedlog |
|---|---|---|---|
| K1 | 03 §10 i 01 §5 | Primjer eventa traži karijere `employee` i `manager`. Takve karijere ne postoje, popis ima 10 drugih. „Manager“ je zapravo položaj u odnosu na drugu osobu, a ne karijera. | `requirements.careers` smije sadržavati samo ID-eve iz popisa karijera. Položaje poput „šef“ ili „kolega“ opisuju **uloge u eventu** i **činjenice o odnosu** (`A je nadređen B`), ne karijere. |
| K2 | 01 §6 i 02 §3 | „Trust“ se pojavljuje triput, kao atribut lika, kao osobina ličnosti i kao svojstvo odnosa. Atribut „Relationships“ udvostručuje tablicu odnosa, a „Stress“ i „Mental condition“ se preklapaju. | Osobina ličnosti zove se `trusting` (sklonost vjerovanju). Povjerenje prema konkretnoj osobi je `trust`, smjerna vrijednost u odnosu A→B. Atributi lika „Trust“ i „Relationships“ se ne uvode, a „Stress“ se spaja u `mental`. Obrazloženje je u §3.3. |
| K3 | 04 §4 | Stanja WAITING i MATCHMAKING pripadaju igraču u redu čekanja, a RESOLVING pripada pojedinom eventu. Nijedno od njih nije stanje sesije. | Tri odvojena automata stanja: **ulaznica za matchmaking** (WAITING → MATCHMAKING → MATCHED/CANCELLED), **sesija** (INITIALIZING → ACTIVE → COMPLETED/CANCELLED) i **instanca eventa** (PENDING → AWAITING_DECISIONS → RESOLVING → RESOLVED/EXPIRED). |
| K4 | 05 `Sessions.current_event_id` i 01 §3 | Polje `current_event_id` (jedan event po sesiji) ne ide uz 4–8 igrača i evente s 1–3 sudionika. Kad bi se odvijao samo jedan event odjednom, većina igrača bi čekala, a 5–10 minuta ne bi bilo dovoljno. | **[ODLUKA D1]** Eventi teku paralelno: svaki lik je u najviše jednom eventu odjednom, a direktor popunjava likove bez eventa. `current_event_id` se uklanja. |
| K5 | 02 §8 i 02 §6 | Bot ne smije vidjeti interne izračune ishoda, ali bodovanje izbora traži „personal benefit, risk, health impact“. To su upravo ti izračuni. | Svaki izbor dobiva odvojeni opis **percipiranih** posljedica (`perceived`), koji vidi i čovjek, kroz tekst i ikone. Stvarni efekti ostaju skriveni. Karijera može izoštriti percepciju: liječnik vidi stvarni zdravstveni rizik, ostali samo „?“. Time karijere dobivaju upravo onu međuovisnost koju traži 01 §5. |
| K6 | 03 §9 i 03 §2 | Raspodjela 50 eventa ne pokriva kategorije Family, Hidden ni Consequence. | Hidden i Consequence nisu teme nego **tipovi**: skriveni event bira samo direktor, a consequence event nastaje samo kao nastavak. Uvode se kao zastavice (`trigger: "followup_only"`, `hidden: true`). Family dobiva 3–4 eventa iz budžeta Social/Relationships. Za to treba K7. |
| K7 | 01 §7 | Tipovi odnosa „Family member“ i „Partner“ ne mogu nastati u 5–10 minuta među strancima. | **[ODLUKA D3]** Na početku sesije generira se nekoliko početnih odnosa, na primjer 1–2 para kolega, ponekad brat ili sestra ili partner. Generira se iz seeda i vidljiv je obama likovima. |
| K8 | 03 §7 i 03 §4 | „Introduce a new participant“ i primjeri poput „kolega je već okrivio drugog zaposlenika“ traže likove koji nisu igrači (NPC). Specifikacija NPC-ove ne spominje. | **[ODLUKA D2]** Postoje samo narativni NPC-ovi: ime i uloga u tekstu eventa, bez stanja i bez odluka. Svi likovi koji odlučuju su igrači ili botovi. |
| K9 | 03 §10 | Efekt `"relationship": 10` ne kaže čiji se odnos mijenja ni prema kome. Efekti po izboru ne opisuju što se događa kad dvoje odluče različito. | Svaki efekt ima eksplicitnu metu (`self`, `role:witness`, `relation:self→role:requester` …). Ishod se računa iz **kombinacije** odluka (pravila ishoda) i ostavlja mjesto slučajnosti. Shema je u §3.4. |
| K10 | 03 §10 | Primjer ima `participants.max: 3`, a definira samo dvije uloge. Pravila dodjele uloga ne postoje. | Uloge se deklariraju s brojem mjesta (`min`/`max` po ulozi). Broj sudionika se izvodi iz uloga i ne zadaje se odvojeno. |
| K11 | 05 `SessionResults.score` | Bodovanje nije definirano, a balansni cilj „No single career dominates“ traži neku mjeru uspjeha. | Interni `lifeScore` je normalizirani zbroj atributa uz bonuse i kazne za ishode. Koristi se samo za simulacijsku analizu i ne prikazuje se kao „pobjeda“. |
| K12 | 04 §1 | Next.js je predložen za frontend, a Socket.IO uz Next.js traži custom server. Za igraću aplikaciju iza logina SSR ne donosi ništa. | **[ODLUKA D4]** Vite + React SPA koji poslužuje backend (Fastify). Tako ostaje jedan proces i jedna naredba za pokretanje. Ako je Next.js nužan, može se uvesti. Ovo dolazi tek u fazi 6. |
| K13 | 03 §8 i 07 §1 | Rokovi od 10–40 s u stvarnom vremenu bi stotine simuliranih sesija (07, faza 4) učinili nemogućima. | Engine ne čita sat izravno nego radi preko apstrakcije `Clock`. Simulacija koristi virtualni sat koji skače na sljedeći timer, pa sesija od 8 minuta traje nekoliko milisekundi. Server koristi stvarni sat. |
| K14 | 01 §1 | Jezik sadržaja igre (tekstova eventa) nije zadan. | **[ODLUKA D5]** Tekstovi igre su na engleskom, u skladu s „English for code“. Kasnije je moguć prijevod jer su tekstovi odvojeni od koda. |

## 2. Nedostajući tehnički detalji (moje odluke, ne mijenjaju dizajn)

1. **Činjenice priče (story facts).** 03 §5 traži da event ne proturječi ranijim činjenicama, ali ne kaže gdje se one čuvaju. Uvodim spremište činjenica: ključ i vrijednost po liku, po paru likova i po sesiji (`employed`, `knows_secret:<id>`, `owes_money:<charId>`, `superior_of:<charId>`). Eventi ih postavljaju, a uvjeti ih provjeravaju.
2. **Jezik uvjeta.** Uvjeti aktivacije i ishoda pišu se u malom deklarativnom JSON DSL-u: `all` / `any` / `not`, usporedbe atributa, karijera, tip i vrijednost odnosa, činjenice, prethodni eventi. Nikakav `eval`. Validator provjerava svaki uvjet.
3. **Simultane naspram sekvencijalnih odluka.** Sudionici unutar jednog eventa odlučuju istovremeno i ne znaju što su drugi odabrali. Kad netko mora reagirati na tuđu odluku („B odlučuje hoće li zaštititi A“), to je **nastavak** koji se aktivira odmah. Tako je dovoljan jedan model odluke.
4. **Zadana odluka.** Svaka uloga u eventu ima `defaultChoice`. On se primjenjuje kad istekne rok, kad se igrač odspoji ili kad lik umre. Obično je to „ignoriraj“ ili „ne čini ništa“.
5. **Što se vidi nakon razrješenja.** Svaki ishod ima tekst po ulozi. Autor eventa odlučuje otkriva li se tuđa odluka. Specifikacija traži skrivene informacije, pa se po zadanom ne otkriva sve.
6. **Odgođene posljedice.** Posljedica je zapis s uvjetom aktivacije (nakon N eventa lika, nakon T sekundi ili kad vrijedi uvjet). Aktivirana posljedica primijeni efekt ili zakaže nastavak. Uzročna veza (`parentInstanceId`) se uvijek pamti.
7. **Kraj lika i kraj sesije.** Lik ispada kad mu zdravlje padne na 0 (smrt) ili kad ishod eventa postavi završni status (`imprisoned`, `dead`, `left_town` …). Sesija završava kad istekne vremenski limit, kad su svi likovi završili ili kad event označen s `endsSession` razriješi glavnu priču. Konačni ishodi iz 01 §9 izvode se na kraju iz statusa, atributa i činjenica.
8. **Determinizam i replay.** Svaka slučajnost dolazi iz seedanog PRNG-a s odvojenim tokovima: odabir eventa, ishodi, svaki bot posebno. Promjena u botu zato ne pomiče odabir eventa. Replay = seed + hash verzije sadržaja + log odluka s vremenima. Na kraju se uspoređuje hash završnog stanja.
9. **„At most once“.** Svaka sesija ima serijski red naredbi (actor model), pa nema paralelne obrade unutar sesije. Odluka se prihvaća samo dok je instanca u stanju AWAITING_DECISIONS i samo jednom po (instanca, lik). U bazi to osigurava jedinstveni indeks.
10. **Pohrana.** Engine je čisto in-memory i nema I/O. Simulacija piše JSONL logove na disk. PostgreSQL ulazi tek u fazi 5, preko adaptera koji upisuje log domenskih događaja i rezultate.

## 3. Arhitektura

### 3.1 Načela

- **Modularni monolit u npm workspaces monorepu.** Granice modula su granice paketa, pa bot fizički ne može uvesti interne dijelove enginea.
- **Engine je čista, deterministička biblioteka** bez mreže, baze i stvarnog sata. Server i simulator su samo različiti „domaćini“ istog enginea.
- **Jedno sučelje za odluke.** Engine vidi samo `Controller`: dobije `CharacterView` (projekciju stanja koju taj lik smije vidjeti) i vrati `choiceId`. Bot, čovjek preko WebSocketa i testni kontroler implementiraju isto sučelje. Ovo strukturalno jamči i 02 §8 (fer botovi) i 04 §6.
- **Log domenskih događaja je izvor istine za povijest:** `SessionStarted`, `EventOffered`, `DecisionSubmitted`, `EventResolved`, `EffectApplied`, `ConsequenceScheduled`, `CharacterEnded`, `SessionCompleted`. Iz njega se grade Life Recap, statistika, replay i čitljivi log iz 07 §4.

### 3.2 Struktura mapa

```
life-simulation/
├── package.json              # npm workspaces, zajedničke skripte (test, sim, validate)
├── tsconfig.base.json
├── docs/
│   ├── spec/                 # izvorna specifikacija (izvor istine)
│   ├── IMPLEMENTATION_PLAN.md
│   └── adr/                  # kratki zapisi arhitekturnih odluka
├── packages/
│   ├── core/                 # zajednički tipovi, Zod sheme sadržaja, PRNG, Clock, DSL uvjeta
│   ├── content/              # SADRŽAJ: careers.json, archetypes.json, motives.json, events/*.json
│   │   └── src/validate.ts   #   učitavanje + validacija (CLI: npm run validate)
│   ├── engine/               # session lifecycle, character state, relationships, facts,
│   │                         #   director (selection), resolution, consequences, endings, recap
│   ├── bots/                 # personality, archetypes, motives, perception, utility, memory
│   ├── sim/                  # CLI: pokreni N sesija, logovi, statistika, balans, replay
│   ├── server/               # faza 5: Fastify + Socket.IO, auth, lobby, matchmaking, Postgres
│   └── web/                  # faza 6: Vite + React klijent
└── README.md / PROGRESS.md
```

Ovisnosti idu samo u jednom smjeru: `core` ← `engine` ← `sim` / `server`, `core` ← `bots` ← `sim` / `server`. `bots` ne ovisi o `engine`, nego samo o tipovima `CharacterView` iz `core`. `content` je čisti podatak i validira se shemama iz `core`.

Alati: TypeScript (strict), `tsx` za pokretanje bez builda, Vitest za testove, Zod za validaciju sadržaja. Za server Fastify i Socket.IO, za bazu `pg` i SQL migracije (bez ORM-a dok ne zatreba). Playwright je već instaliran za faze 6–7.

### 3.3 Model lika (MVP)

| Atribut | Raspon | Zašto postoji |
|---|---|---|
| `health` | 0–100 | bolest, ozljeda, smrt na 0 |
| `mental` | 0–100 | psiha i stres zajedno; niska vrijednost otključava evente slomljenosti i impulzivne izbore |
| `money` | 0–100 | financijski eventi, mito, pomoć drugima |
| `reputation` | 0–100 | javna slika; utječe na to koji eventi dolaze (posao, sumnja) |
| `career` | 0–100 | napredak u karijeri; promaknuće, otkaz |
| `status` | enum | `active`, `dead`, `imprisoned`, `hospitalized`, `left` |

Odnos A→B je smjeran: `affinity` (-100..100), `trust` (0..100), simetrična `type` oznaka (stranac … neprijatelj, izvodi se iz pragova ili je postavlja event) i `history` (ID-evi instanci eventa). Tip se izvodi iz brojki, a eventi ga mogu i eksplicitno postaviti (`partner`, `family`).

Karijera (`content/careers.json`): 2–3 pasivne sposobnosti (modifikatori percepcije i efekata, npr. liječnik ima -50 % zdravstvene štete u Health eventima i vidi zdravstveni rizik), 1–2 posebna izbora koji se pojavljuju samo toj karijeri, oznake kompatibilnosti s eventima, jake i slabe strane.

### 3.4 Shema eventa (skica, v1)

> Mjerodavan, implementiran format je u [`EVENT_FORMAT.md`](EVENT_FORMAT.md). Skica ispod je izvorni prijedlog.

```jsonc
{
  "id": "office_coworker_mistake", "version": 1, "category": "career",
  "trigger": "director",            // ili "followup_only"
  "weight": 10, "cooldown": { "perCharacter": 3, "perSession": 1 },
  "importance": "normal",           // simple | multi | important → rok iz konfiguracije
  "roles": {
    "requester": { "count": 1, "conditions": { "fact": "employed" } },
    "witness":   { "count": [1, 2], "conditions": { "relation": { "to": "requester", "typeIn": ["colleague", "friend"] } } }
  },
  "text": {
    "public": "{requester} asks you to confirm their version of an incident at work.",
    "private": { "requester": "You know you made the mistake.", "witness": "You saw what actually happened." }
  },
  "choices": {
    "witness": [
      { "id": "protect", "label": "Back their story", "default": false,
        "perceived": { "self": "+", "relation:requester": "+", "risk": "?" } },
      { "id": "truth", "label": "Tell the truth", "perceived": { "reputation": "+", "relation:requester": "-" } },
      { "id": "stay_out", "label": "Stay out of it", "default": true },
      { "id": "legal_angle", "label": "Point out the legal exposure", "careers": ["lawyer"] }
    ],
    "requester": [ /* ... */ ]
  },
  "outcomes": [
    { "when": { "anyRole": "witness", "chose": "truth" }, "chance": 1.0,
      "effects": [ { "target": "role:requester", "career": -15 },
                   { "target": "relation:requester->role:witness", "affinity": -20, "trust": -10 } ],
      "facts":   [ { "set": "exposed_mistake", "on": "role:requester" } ],
      "followUps": [ { "event": "office_retaliation", "delay": { "events": 2 }, "roles": { "victim": "witness", "aggressor": "requester" } } ],
      "text": { "requester": "...", "witness": "..." } },
    { "when": "otherwise", "effects": [ /* ... */ ] }
  ]
}
```

Validator provjerava: postojanje izbora i `default` po ulozi, ispravnost uvjeta (poznati atributi, karijere, činjenice), postojanje nastavaka i mapiranje uloga u nastavku, ostvarivost uloga (min ≤ max ≤ 8), pokrivenost ishoda (postoji `otherwise`, nema dva bezuvjetna) i ciklus nastavaka bez cooldowna.

### 3.5 Direktor (odabir eventa)

Na svakom „ticku“, za svakog slobodnog aktivnog lika:

1. Prvo se gledaju **dospjeli nastavci i posljedice**. Imaju prednost, ali čekaju dok svi njihovi sudionici ne budu slobodni.
2. Inače se grade kandidati (predložak + dodjela uloga) čiji su svi uvjeti zadovoljeni i čiji sudionici su slobodni i aktivni.
3. Težina = osnovna težina × kompatibilnost karijere × relevantnost odnosa (eventi s ljudima s kojima postoji povijest dobivaju bonus) × kazna za ponavljanje × dramaturški faktor (kritični eventi postaju vjerojatniji kasnije u sesiji i nakon nagomilanih posljedica).
4. Bira se ponderiranim slučajnim odabirom iz toka `selection`.
5. Ako nema dobrog kandidata, lik je kratko u pauzi. Eventi se ne izmišljaju samo da popune vrijeme (03 §8).

Svaki odbijeni kandidat se broji po razlogu („invalid event selections“ iz 07 §2).

### 3.6 Bot

1. Ulaz je samo `CharacterView` (javno, privatno, vlastiti atributi, vlastita sjećanja i odnosi, ponuđeni izbori s `perceived` oznakama) uz vlastiti profil i motive.
2. Svaka komponenta izbora daje vrijednost u [-1, 1]: osobna korist, rizik, moralna usklađenost (iskrenost, empatija), utjecaj na odnos (pomnožen s afinitetom i lojalnošću prema toj osobi), karijera, zdravlje, motivi.
3. `utility = Σ w_i(personality) · c_i`. Težine se izvode iz osobina, a tablica težina je u konfiguraciji, ne u kodu.
4. Odabir ide softmaxom s temperaturom koja ovisi o impulzivnosti. Zato dva slična bota ne biraju uvijek isto.
5. Sjećanje sesije čine zapisi „X mi je pomogao / izdao me / obećao / znam tajnu o X“. Ti zapisi utječu na afinitet u bodovanju i na izbore poput osvete.
6. Bot simulira i vrijeme razmišljanja (u virtualnom satu), da log i tempo izgledaju realno.

## 4. Milestonei

| M | Faza spec. | Sadržaj | Gotovo kad |
|---|---|---|---|
| **M0** | 1 | Ovaj pregled; potvrda odluka D1–D5 | vlasnik potvrdi ili ispravi odluke |
| **M1** | 2 | Monorepo kostur, `core` (tipovi, Zod sheme, PRNG, Clock, DSL uvjeta), `content` (10 karijera, ~6 testnih eventa) i validator CLI | `npm run validate` prolazi i hvata namjerno pokvarene evente; testovi prolaze |
| **M2** | 2 | `engine`: kreiranje likova, lifecycle sesije, direktor, prijem odluka, razrješenje, efekti, odnosi, činjenice, odgođene posljedice, završeci, log, Life Recap; testni kontroler s nasumičnim izborom | cijela sesija se izvrti bez grafike; testovi za smrt, timeout, simultane odluke, nastavke, „at most once“ |
| **M3** | 3 | `bots`: osobnosti, 10 arhetipova, motivi, percepcija, utility, softmax, sjećanje sesije; CLI `npm run sim -- --bots 6 --seed 42` ispisuje čitljiv log i recap | **prvi igrivi prototip: cijela sesija samo s botovima**, deterministična po seedu |
| **M4** | 2–3 | Biblioteka sadržaja: ≥ 50 eventa po raspodjeli iz 03 §9 (+ Family), lanci (barem 5 lanaca od 3+ karike), posebni izbori karijera | validator čist; svaki event se pojavi u simulacijama |
| **M5** | 4 | `sim`: batch (stotine sesija), JSONL logovi, statistika iz 07 §2, balansni izvještaj (karijere, arhetipovi, ponavljanje), replay s provjerom hasha | 500 sesija za < 1 min; izvještaj u Markdownu; replay identičan |
| **M6** | 5 | `server`: Fastify + Socket.IO, registracija i prijava, lobby, matchmaking s popunom botovima, ljudski kontroler, timeout i zadana odluka, reconnect, Postgres persistencija | čovjek preko testnog klijenta odigra sesiju s botovima |
| **M7** | 6 | `web`: izbornik, lobby, izbor karijere, matchmaking, ekran eventa, izbori s odbrojavanjem, spectator, profil, Life Recap; responzivno | Playwright prolazi na desktopu i mobilnom viewportu |
| **M8** | 7 | Balansiranje, analitika, popravci, performanse | stabilne sesije 5–10 min |

M1–M3 zajedno su prvi igrivi prototip (samo botovi). M4 i M5 se mogu djelomično preklapati jer statistika pomaže pisati sadržaj.

## 5. Što se radi prvo i zašto

1. **`core`: tipovi, sheme eventa i DSL uvjeta.** Sve ostalo ovisi o obliku podataka, a to je i dio s najviše otvorenih pitanja (K5, K9, K10). Shema se fiksira prije pisanja 50 eventa, inače se sadržaj kasnije prepravlja.
2. **PRNG i Clock.** Malo koda, a o njima ovise determinizam, replay i brza simulacija. Naknadno ih je skupo ugraditi.
3. **Validator i 5–6 testnih eventa** koji pokrivaju sve mogućnosti sheme: solo event, event s 2 uloge, posebni izbor karijere, odgođenu posljedicu, nastavak, smrt.
4. **Engine (M2)** s glupim nasumičnim kontrolerom. Tako se engine testira neovisno o botovima.
5. **Botovi (M3).** Tek tada imamo prototip.

## 6. Rizici

- **Količina sadržaja.** 50 kvalitetnih eventa s više ishoda je najveći pojedinačni posao. Zato je shema prvo fiksirana i validirana, a sadržaj dolazi u M4 u serijama, uz provjeru simulacijom.
- **Koherentnost priče.** Paralelni eventi mogu proizvesti nelogične kombinacije (lik je u bolnici, a ide na posao). To rješavaju statusi i činjenice u uvjetima, uz test koherentnosti u simulaciji.
- **Tempo.** Ako je eventa premalo, igrač čeka; ako ih je previše, nema vremena čitati. Brojke za tempo su u konfiguraciji, a podešavaju se u M5 i M8.
- **Balans karijera.** Posebni izbori lako postanu dominantni. Mjeri se kroz `lifeScore` po karijeri u batch simulaciji.

## 7. Odluke vlasnika (potvrđene 13. 11. 2026.)

| ID | Pitanje | Odluka |
|---|---|---|
| D1 | Teku li eventi paralelno (svaki lik u svom eventu) ili jedan po jedan za cijelu sesiju? | ✅ paralelno |
| D2 | Smiju li eventi spominjati NPC-ove (likove koji nisu igrači)? | ✅ da, samo narativni (bez stanja i odluka) |
| D3 | Smiju li neki likovi počinjati s postojećim odnosom (kolege, obitelj, partner)? | ✅ da, generirano iz seeda |
| D4 | Frontend: Vite + React SPA umjesto Next.js? | ✅ Vite + React |
| D5 | Jezik tekstova u igri? | ✅ engleski |

## 8. Odluke donesene tijekom implementacije

Ove odluke nisu mijenjale koncept igre. Zapisane su ovdje jer odstupaju od doslovne specifikacije ili je dopunjuju.

| Tema | Odluka | Zašto |
|---|---|---|
| Baza (05) | Logički model je sveden na 9 tablica. `Characters` + `BotProfiles` + `SessionParticipants` → `session_participants`. `Events` → `content_versions` (cijeli validirani sadržaj po hashu). `SessionEvents`, `EventParticipants`, `Consequences`, `Relationships` i `CharacterHistory` izvode se iz domenskog loga (`session_logs`). | Spec traži „avoid storing unnecessary duplicate data“ i „support deterministic replay“. Log + verzija sadržaja + odluke su dovoljni za replay; duple tablice bi se mogle razići s logom. `decisions` ima PK (sesija, event, lik), tj. „at most once“ i u bazi. |
| PostgreSQL u razvoju | Bez `DATABASE_URL` server koristi PGlite (PostgreSQL u WebAssemblyju, unutar procesa); s `DATABASE_URL` koristi pravi PostgreSQL. SQL i migracije su isti. | Pokretanje bez ikakve pripreme; testovi su provjereni i na PostgreSQL 16. |
| Lozinke | scrypt iz `node:crypto` | Bez nativnih ovisnosti (bcrypt/argon2 traže kompilaciju). |
| Prijava | Nasumični bearer token, u bazi se čuva samo njegov SHA-256 hash, rok 30 dana; odjava ga briše | Jednostavnije od JWT-a i omogućuje opoziv. |
| Uloge `aware: false` | Lik je uključen u event (o njemu se trača, prisluškuju ga) bez obavijesti; dobije samo tekst ishoda. Takav event mora biti `hidden`. | Skrivene informacije iz GDD-a; bez ovoga bi lik iz poruke ili javnog teksta saznao tajnu. |
| Javni feed | Neskriveni eventi i krajevi priča šalju se svima u sesiji, pa i likovima čija je priča završila (spectator). | Spectator mode iz GDD §3. |
| Odspojeni igrač | Mjesto u sesiji ostaje; za njegove odluke vrijedi default kad istekne rok; pri ponovnom spajanju dobiva cijelo stanje. Odspojeni igrač se miče iz reda za matchmaking. | 04 §5: „configurable timeout and default decision policy“. Rok eventa je ujedno i timeout. |
| Restart servera | Sesije koje su bile u tijeku označe se kao `cancelled` (`server_restart`). | Stanje sesije je u memoriji. Nastavak nakon restarta (replay iz loga) moguć je kasnije, ali nije potreban za MVP. |
| Ubrzanje vremena | `TIME_SCALE` ubrzava sesiju za demo i testove; engine to ne zna (vidi samo `Clock`). | Testovi cijele multiplayer sesije traju nekoliko sekundi. |
