# Napredak projekta dev-farm

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Igra je igriva u browseru. Farmer se kreće po mapi 48×32 klikovima miša i radi s alatima (ruke, sjeme, kanta, gnojivo). Može otkrivati sjeme, saditi, zalijevati, gnojiti i brati, a plodove prodaje na štandu kupcima koji dolaze cestom. Usjevi rastu po danima: dan traje 10 minuta, a rast se događa svako jutro. Kvaliteta ploda (★ do ★★★★) ovisi o zalijevanju, gnojivu i pravodobnoj berbi, a cijena o kvaliteti. Novac su zlatnici i srebrenjaci s omjerima prema stvarnim tržišnim cijenama u Hrvatskoj. Na radnom stolu se izrađuju izumi: plan bunara, prskalice s 10 razina navodnjavanja, dron, replant.py, SEO ploča i drugo polje. Mobitel služi za obavijesti i dostavu sjemena i gnojiva, a farmer u oblačiću govori što radi i što ne može. Sva grafika je pixel art generiran u kodu.

## Napravljeno 12. studenog 2026.

### v1 – prva verzija (`873b2e9`)

- igra u čistom HTML/CSS/JS (ES moduli), bez ovisnosti i build koraka; `npm start` pokreće mali Node server, `npm test` testove
- polje 3×3 s klikom na parcelu (sadi, zalij, poberi), 5 usjeva, IT izumi (water.sh, harvest-drone, replant.py, compost-cache, git clone polje)
- pravila igre izdvojena u čisti modul `src/sim.js` (bez DOM-a) i pokrivena `node --test` testovima
- spremanje u `localStorage`, naslov taba pokazuje zrele usjeve

### v2 – svijet po kojem se hoda (`36006aa`)

- mapa 48×32 (`src/world.js`): kuća, škrinja, štand, bunar, ribnjak, radni stol, dva polja po 48 parcela
- farmer hoda na klik (traženje puta), kupci dolaze cestom do štanda i kupuju
- kvaliteta ★–★★★★ prema zalijevanju, gnojivu i pravodobnoj berbi; trulež prezrelih plodova
- energija, kava, jedenje plodova; dan i noć (10 min), spavanje sprema igru, nesvjestica u 02 h
- izumi strojeva najviše daju ★★★, zlatna kvaliteta samo iz farmerovih ruku

### v3 – detaljniji pixel art (`0e21f7b`)

- grafika na 32 px po polju, generirana piksel po piksel (`src/pixel.js`, `src/art.js`): sjenčanje, dithering, selektivni obrisi, noise teksture
- organske staze, ribnjak s obalom, trskom i lopočima; kuća od brvana s crijepom, dimnjakom i škurama
- dubinsko sortiranje (farmer može iza drveta), dim, svjetlucanje vode, noćna svjetla i krijesnice, glatka kamera

### v4 – sjeme, bunar, oblačić, mobitel, zoom (`88b1163`)

- sjeme se broji i nije besplatno: ladica u kući, nalazišta na imanju (i nova svako jutro), sjeme iz plodova (2–10), dostava preko mobitela
- kupci kupuju i ★ robu, ali samo kad nema bolje; cijena ovisi o kvaliteti
- bunara nema na početku, voda je iz ribnjaka; prskalice traže bunar
- oblačić iznad farmera za njegove misli, mobitel za obavijesti i dostavu
- zoom gumbima, kotačićem i tipkama

### v5 – skupni poslovi (`41291eb`, `b531d2f`)

- Posadi ▾ / Poberi ▾ / Zalij ▾ s izbornikom (sve ili jedna vrsta); farmer sam obilazi polje, zalijevanje samo ide po vodu kad se kanta isprazni
- bunar: na radnom stolu samo plan, farmer ga zida na gradilištu (plaća se po završetku, prekida se odlaskom)
- navodnjavanje s 10 razina (4 do 56 parcela po prskalici) i prikaz dosega
- kupovno gnojivo prebačeno na mobitel (dostava u škrinju)
- glatki zoom oko farmera

### Preslagivanje repoa (`845c09f`)

- grana `claude/funny-tesla-p4jeuy` spojena u `dev` i obrisana; projekti premješteni u korijen repoa (`dev-farm/`, `pixel-runner/`)

### v6 – rast kroz dane i realne cijene (`ed75e56`)

- usjevi rastu svako jutro (cijeli dan ako su zaliveni, pola ako nisu); zemlja presuši preko noći, prskalice zalijevaju u 06 h; dovoljno je zaliti jednom dnevno
- zreo plod čeka danima: najbolji isti dan, svaki dan gubi kvalitetu, istrune četvrto jutro
- spavanje tek od 18 h (inače bi se dani preskakali)
- cijene po kg prema hrvatskim tržnicama, urod u kilogramima, novi usjevi kupus, blitva i batat
- format spremanja v4 s prijenosom starijih farmi

### v7 – ispravci (`1d2c44d`, `489c60b`)

- izbornik skupnih poslova zatvara se nakon odabira (CSS `[hidden]` bio je nadjačan)
- novac u zlatnicima i srebrenjacima (1 zl = 100 sr) s pixel novčićima u HUD-u
- kanta vraćena kao alat za zalijevanje pojedinačnih biljaka (tipka 3), gnojivo na tipki 4

### Dokumentacija napretka (`ff5e1e6`)

- dodan ovaj `PROGRESS.md`, pravilo o njemu u korijenskom `CLAUDE.md` i predložak `_template/PROGRESS.md`

### v8 – kanta s izbornikom

- kanta je razdvojeni gumb: klik na kantu uzme je za pojedinačno zalijevanje, a ▾ uz nju otvara izbornik „sve posađeno“ ili jedna vrsta (tipka Z i dalje zalije sve)
- odvojeni gumb „Zalij ▾“ uklonjen iz alatne trake
- dok zalijevanje traje, kanta pokazuje napredak („zalijeva 2/5“), a ▾ postaje ■ za prekid

### v9 – sjeme s izbornikom

- sjeme je razdvojeni gumb kao i kanta: klik na sjeme uzme ga za sadnju biljku po biljku (vrsta se bira u vrećici ispod), a ▾ uz njega posadi sve sjeme ili samo jednu vrstu (tipka P i dalje sadi sve)
- odvojeni gumb „Posadi ▾“ uklonjen; ostao je samo „Poberi ▾“
- dok sadnja traje, sjeme pokazuje napredak („sadi 3/9“), a ▾ postaje ■ za prekid

## Zadnja automatizirana provjera

Provedeno 12. studenog 2026. nakon v9:

| Provjera | Rezultat |
| --- | --- |
| `npm test` u `dev-farm/` | 32/32 testova prolazi |
| `npm start` + dohvat stranice i modula | server vraća 200 za `index.html` i `src/*.js` |
| Headless Firefox (scenariji u scratchpadu) | iscrtavanje bez JS grešaka; provjereni hodanje, škrinja, skupna sadnja, zalijevanje s odlaskom po vodu, zidanje bunara, doseg prskalice, izbornik koji se zatvara, novčići u HUD-u, izbornici sjemena i kante te prekid sadnje i zalijevanja, noć |

## Poznata ograničenja

- Tempo i ekonomija nisu isprobani stvarnim igranjem; cijene, trajanje rasta i cijene izuma su procjene u `src/data.js`.
- Prva berba stiže tek treći dan (najmanje oko 20 minuta igre).
- Ako se dvije farmerove poruke dogode istovremeno, druga zamijeni prvu u oblačiću.
- Glatkoća zooma nije provjerena automatski, samo da konačni prikaz radi.
- Dijelovi pločica ribnjaka uz uglove izgledaju kao trava, ali farmer na njih ne može.
- Ime aplikacije na mobitelu još nije odabrano (zasad „📱 Mobitel“).
- `pixel-runner` nije pokretan na ovom računalu (nema Pygame).

## Sljedeći koraci

Ideje koje su predložene, a još nisu napravljene:

1. Kiša: nasumični dani koji sami zaliju sve.
2. Malč: zemlja ostaje vlažna dva dana.
3. Obavijest u browseru kad nešto sazrije ili se štand isprazni.
4. Hladnjača: plodovi u škrinji polako gube kvalitetu, a hladnjača ih čuva.
5. Odabrati ime aplikacije na mobitelu.

## Handoff za novi chat

1. Repo je `/home/leon/Desktop/Work-Stuff/Projects` (GitHub `le0np/Projects`), radi se na grani `dev`. Projekt je u `dev-farm/`.
2. Prvo pročitati korijenski `CLAUDE.md`, `dev-farm/README.md` i ovaj dokument.
3. Pokretanje: `cd dev-farm && npm start` (http://localhost:8080). Testovi: `npm test`.
4. Arhitektura: `src/data.js` (brojke) → `src/sim.js` (čista pravila, testirana) → `src/render.js` + `src/art.js` (crtanje) i `src/ui.js` (DOM) → `src/main.js` (petlja, ulaz, poruke). Pravila ne smiju ovisiti o DOM-u.
5. Novac se u stanju čuva u srebrenjacima (cijeli brojevi), cijene se u `data.js` pišu u zlatnicima (`zl()`).
6. Format spremanja je v4 (`src/save.js`); kod promjene stanja dodati prijenos starijih spremanja.
7. Nakon svake promjene ažurirati ovaj dokument (novi odjeljak, zadnja provjera, ograničenja, sljedeći koraci).
