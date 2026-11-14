# dev-farm

2D farma za browser za ITjevce koji sanjaju o selu. Vodiš farmera po imanju klikovima miša: sadiš, zalijevaš, gnojiš i bereš, a kvalitetnu robu prodaješ na štandu uz cestu i na tržnici u gradu. Navečer ideš spavati, čime se igra sprema. Kako farma raste, developer u tebi gradi izume koji preuzimaju dio posla: prskalice, dron, skripte.

**Status:** 🚧 u izradi (v14 igriva)

## Pokretanje

Treba samo [Node.js](https://nodejs.org) 20 ili noviji, bez instalacije paketa.

```bash
cd dev-farm
npm start          # server na http://localhost:8080
npm test           # testovi pravila igre
```

Otvori `http://localhost:8080`. Drugi port: `PORT=3000 npm start`. Dvoklik na `index.html` ne radi jer browseri ne učitavaju JavaScript module s `file://`. Radi i bilo koji statički server, npr. `python3 -m http.server 8080` u ovoj mapi.

## Kako se igra

- **Kretanje:** klikni bilo gdje na mapi i farmer ode tamo najkraćim putem. Klik na zgradu ili parcelu znači „idi tamo i napravi nešto“.
- **Zoom:** gumbi + / − u kutu mape, kotačić miša ili tipke + i −. Zoom je gladak i uvijek oko farmera. Odabrani zoom se pamti.
- **Torba i mobitel su dio igre:** ikone ispod zooma (ili tipke **T** i **M**) otvaraju ih preko mape, desno. Kad je otvorena zgrada kojoj treba torba (škrinja, štand, kokošinjac, radni stol, parkiralište), torba se sama pokaže uz nju. Esc zatvara sve. Dok je mobitel zatvoren, nove poruke nakratko iskoče u donjem lijevom kutu mape, a na ikoni mobitela piše koliko ih nisi pročitao. Nova farma počinje s otvorenim mobitelom i uputama.
- **Skupni poslovi (▾ uz alat, ili tipke B, P, Z, G):** farmer sam obiđe polje, red po red. Sadnja troši sjeme, berba na kraju kaže koliko je čega po kvaliteti, zalijevanje kad se kanta isprazni samo ode po vodu (bunar ili ribnjak) i nastavi, a gnojenje pognoji onoliko biljaka koliko ima vreća gnojiva. Posao staje kad ponestane sjemena, gnojiva, energije ili mjesta u torbi. Klik na mapu ili Esc ga prekida.
- **Alati (tipke 1–6): ✋ ruke, 🌱 sjeme, 🪣 kanta, 🧪 gnojivo, 🎣 pecaljka, 🪵 malč.** Svaki alat ima dva dijela. Klik na sam alat radi jednu po jednu biljku: ruke beru, sjeme sadi (vrsta se bira u vrećici uz alate), kanta zalijeva (piše koliko je vode u njoj), gnojivo gnoji. ▾ uz alat radi isto na svim parcelama ili samo za jednu vrstu, a dok posao traje ▾ postaje ■ za prekid. Zrelu biljku ruke beru, a i bilo koji alat je bere klikom. Pecaljka (tipka 5) se pojavi kad je izradiš, a malč (tipka 6) kad ga imaš u torbi.
- **Sjeme se broji i nije besplatno.** Na početku ga nema. Vrećica ispod alata pokazuje koliko kojeg imaš. Sjeme se dobiva na tri načina:
  - **Otkrivanjem:** u ladici u kući, a na imanju rastu stara rotkvica, divlja mrkva i divlji krumpir. Svako jutro nešto novo može niknuti samo od sebe.
  - **Iz plodova** na radnom stolu: neprodani plod daje 2–10 sjemenki, nasumično. Tako jedan usjev donosi puno novih.
  - **Dostavom:** naručiš na mobitelu („Dostava“), paket od 5 sjemenki stiže sutra ujutro. Katalog se širi kako zarađuješ. Ondje se naručuje i gnojivo ★★ (6 zl za vreću od 10 doza), koje stiže u škrinju.
- **Šuma:** uz rub šume svako jutro nikne nekoliko stvari: gljive i kupine (prodaju se na štandu ili jedu), grane (drva), kamenje i ponekad odbačeni dijelovi (komad crijeva ili prskalica). Drva i kamenje su materijal za radni stol.
- **Navodnjavanje se slaže iz dijelova:** vodena pumpa (montira se na bunar klikom na bunar), crijevo (10 m po prskalici) i prskalice. Dijelovi se naručuju na mobitelu (pumpa 70 zl, crijevo 10 m 9 zl, prskalica 8 zl) ili nađu u šumi. Prskalica se postavlja na **križanje četiri parcele**, pa ne zauzima nijednu, i svako jutro u 6 h zalije parcele oko tog križanja. Klik na postavljenu prskalicu vraća nju i crijevo u torbu.
- **Kokošinjac:** gradi se kao bunar: na radnom stolu se skicira plan popravka, a farmer ga popravlja na licu mjesta (25 zl, 10 drva, 4 kamena). Popravljen je prazan: kokoši se naručuju na mobitelu jedna po jedna (12 zl, najviše 9). Kokoši šeću oko njega i svako jutro snesu jaje ako je u hranilici bilo hrane: kokoš pojede oko 200 g na dan, pa 1 kg ploda nahrani 5 kokoši (hranilica drži 20 kg), idealno loši (★) plodovi. Hrani se klikom na plod u torbi dok je kokošinjac otvoren, a jaja se skupe klikom na kokošinjac i prodaju na štandu (40 sr po komadu) ili pojedu (+10 ⚡ po jajetu).
- **Pecanje (idle):** pecaljka se izradi na radnom stolu (2 drva i 4 zl za najlon i udicu). Uzmi je (tipka 5) i klikni ribnjak: farmer sjedne uz vodu i peca sam cijeli dan, dok ga ne pozoveš (klik drugdje ili Esc) ili dok ne padne mrak u 22 h. Pecanje nije naporno: troši samo 1 ⚡ na sat. Ulov je nasumičan: svako jutro ribnjak ima svoju sreću za taj dan (0–5 riba), pa farmer nekad upeca nekoliko riba, a nekad nijednu. Ribe su šaran (1–3 kg, 4 zl 50 sr/kg), linjak (1–2 kg, 7 zl/kg) i rijetka štuka (2–4 kg, 9 zl/kg), nasumične kvalitete ★ do ★★★. Ulov ide u torbu i prodaje se na štandu i tržnici ili pojede. Pecanje se nastavlja i nakon ponovnog učitavanja stranice.
- **Honorarci (mobitel → Poslovi):** svako jutro stigne 1–3 ponude poput „Susjedi Mari ne radi WiFi“ ili „Web stranica za OPG Horvat“. Prihvaćeni posao farmer radi kod kuće za laptopom (1–4 sata u igri, troši energiju) i odmah je plaćen (4–28 zl). Ako ga pozoveš van, napredak ostaje.
- **Usjevi rastu po danima, ne po sekundama.** Svako jutro biljka naraste jedan dan ako je dan prije bila zalivena, a pola dana ako nije. Zemlja ostaje vlažna cijeli dan i presuši preko noći, pa je **dovoljno zaliti jednom dnevno**. Ostatak dana tab može mirno stajati sa strane. Rast se vidi ujutro.
- **Kvaliteta ploda ima pet klasa, kao na tržnici: ★ škart, ★★ II. klasa, ★★★ I. klasa, ★★★★ ekstra, ★★★★★ za sajam** (plod koji osvaja nagrade na seoskom sajmu). Ovisi o tri stvari:
  - koliko je dana rasta biljka bila zalivena
  - je li pognojena i kojim gnojivom: bez gnojiva najviše ★★★, uz ★ ili ★★ gnojivo ★★★★, a **★★★★★ samo uz ★★★ gnojivo**
  - koliko je dana prošlo otkad je sazrela: najbolja je isti dan, svaki dan čekanja joj oduzima kvalitetu, a četvrto jutro istrune
- **Gnojivo:** jedna vreća ima 10 doza, dosta za 10 parcela, a u torbi se broji u dozama. Gnojivo ima kvalitetu ★ do ★★★: kompost na radnom stolu pravi se od 5 kg jedne vrste ploda i iste je kvalitete kao plod (škart daje ★, II. klasa ★★, I. klasa i bolje ★★★), a kupovno gnojivo je ★★. Gnoji se tipkom 4 ili ▾ uz gnojivo (G), a prvo se troši najbolje gnojivo iz torbe.

- **Novac: zlatnici (zl) i srebrenjaci (sr), 1 zl = 100 sr.** U igri se umjesto „zl“ i „sr“ uz cijene crtaju pixel novčići: u panelima, na mobitelu, u priručniku, oblačiću i iznad štanda kad kupac plati. Zlatnik nosi sunce, a srebrenjak mjesec, oba s nazubljenim rubom (odabrano između 5 skica). Cijene prate stvarne tržišne cijene u Hrvatskoj: 1 zlatnik vrijedi otprilike koliko 1 € na tržnici.
- **Usjevi i cijene** (po kilogramu, za ★★):

  | Usjev | Raste | Urod po parceli | Cijena/kg | Paket sjemena (5 kom) |
  | --- | --- | --- | --- | --- |
  | Rotkvica | 1 dan | 1 kg | 3 zl 50 sr | 1 zl 50 sr |
  | Mrkva | 1 dan | 4 kg | 90 sr | 60 sr |
  | Krumpir | 2 dana | 6 kg | 1 zl | 70 sr |
  | Kupus | 2 dana | 5 kg | 1 zl 25 sr | 80 sr |
  | Blitva | 3 dana | 3 kg | 3 zl 90 sr | 1 zl 80 sr |
  | Rajčica | 3 dana | 4 kg | 3 zl | 2 zl |
  | Batat | 4 dana | 4 kg | 3 zl 30 sr | 2 zl 40 sr |
  | Bundeva | 4 dana | 9 kg | 1 zl 60 sr | 1 zl |

  **Sjeme nikad nije skuplje od ploda:** paket od 5 sjemenki uvijek košta manje od 1 kg tog ploda, a jedna sjemenka najviše desetinu onoga što njezina parcela donese. Zato svaka parcela zaradi otprilike 3–4 zl na dan (★★, sjeme plaćeno), bez obzira na usjev. U Dostavi uz svako sjeme piše po čemu se plod prodaje i koliko kg daje parcela. Što parcela više vrijedi, to dulje raste. Rotkvica i mrkva posađene danas zrele su sutra ujutro, pa se od drugog dana svaki dan ima što prodati, a skuplji usjevi traže više strpljenja. Bez zalijevanja sve raste upola sporije (i rotkvici tada trebaju dva dana).

  Skuplji usjevi pojavljuju se u katalogu dostave kako ukupno zarađuješ. Igra počinje s 30 zlatnika.
- **Štand uz cestu:** stavi plodove na štand. Kupci dolaze cestom od 08 do 19 h i uvijek uzmu najbolje što vide. Kupuju 1–4 kg odjednom. **Cijena ovisi o kvaliteti:** ★ pola cijene, ★★ tržišna cijena, ★★★ +30 %, ★★★★ +60 %, ★★★★★ dvostruko. Škart kupuju samo kad na štandu nema boljeg. Plodovi se mogu i pojesti za energiju, pretvoriti u kompost ili u sjeme.
- **Tržnica u gradu:** uz cestu je parkiralište s putokazom „GRAD“. Ondje se jednom zakupi klupa na tržnici (25 zl za cijelu sezonu). Grad je 1 h vožnje cestom na sjever, a tržnica radi 07–13 h: kupaca je puno više nego na štandu, uzimaju po 2–6 kg, a cijene su iste. Farmer nosi robu iz **torbe**: sa „Idi na tržnicu s torbom“ ode cestom i nestane s mape, prodaje dok ne proda sve ili dok se tržnica ne zatvori, pa se vrati (najkasnije oko 14 h). Za to vrijeme farma radi bez njega, a u gornjoj traci piše koliko je prodao. Klik na tu oznaku (🧺 … ↩) ga vraća ranije.
- **Kombi i zaposlenik:** na parkiralištu se kupi rabljeni kombi (800 zl) i zaposli vozač Joža. Robu utovariš u kombi (klik na plod u torbi dok je parkiralište otvoreno, 12 mjesta). Joža svako jutro u 6 h sam odveze sve što je u kombiju na tržnicu i vrati se oko 14 h s novcem. Dnevnica je 30 zl i plaća se samo na dane kad vozi: prazan kombi ostaje doma i ništa ne košta. Kombi se može poslati i tijekom dana („Pošalji sad“), ako stigne prije zatvaranja. Neprodano ostaje u kombiju i ide opet sutra.
- **Kuća:** spavanje (od 18 h) završava dan, vraća svu energiju i **sprema igru**. Ranije se ne može, inače bi se spavanjem preskakali dani rasta. Kava (1 zl 50 sr) daje +35 energije. Tko ostane budan do 02 h, zaspi na nogama i budi se s pola energije.
- **Energija:** svaki posao troši energiju (sadnja 2, zalijevanje, gnojenje i berba po 1). Hodanje je besplatno.
- **Voda:** na početku samo **ribnjak** puni kantu (12 zalijevanja, s velikom kantom 30). **Bunara nema:** kod kuće je gradilište. Na radnom stolu se skicira plan, a onda farmer ode na gradilište i zida (nekoliko sekundi, 150 zl, 12 kamena, 6 drva i 30 energije; plaća se tek kad je gotovo, a ako farmer ode, zidanje stane). Kad je sazidan, voda je blizu polja i postaje izvor za **navodnjavanje** (vidi gore).
- **Škrinja** (24 mjesta) za višak. Torba ima samo 8 mjesta. Plodovi u škrinji polako gube kvalitetu (svako jutro 40 % šanse da hrpa padne za klasu); **hladnjača** s radnog stola (150 zl, 8 kamena) to zaustavlja i škrinja postane plava.
- **Kiša i prognoza:** otprilike svaki peti dan pada kiša i ujutro zalije sve posađeno (i ono što se posadi tog dana), kao ručno zalijevanje. Po kiši dolazi manje kupaca. Prognoza za sutra stiže svako jutro na mobitel i piše uz sat u gornjoj traci (☀️/🌧️). Uz sat je i dan u tjednu.
- **Malč:** malčirana zemlja ostaje vlažna dva dana, pa je dovoljno zalijevati svaki drugi dan. Radi se na radnom stolu (2 drva → 10 doza) ili naručuje (3 zl za 10 doza); stavlja se alatom 6 ili ▾ na sve parcele i ostaje do berbe.
- **Narudžbe kupaca:** ponekad se ujutro javi kupac („8 kg mrkve ★★★ ili bolje do petka“), najviše tri odjednom. Predaju se na štandu iz torbe i plaćaju 50 % više; ako se ne predaju do roka, propadnu. Popis je i na mobitelu (Poslovi).
- **Otkup:** na mobitelu (Dostava → Otkup) se višak dijelova, gnojiva, malča i ukrasa prodaje za pola cijene, prvo iz škrinje pa iz torbe.
- **Pčele i med:** košnica s radnog stola (10 zl, 6 drva) postavi se na travu (najviše 5). Svaki drugi dan napuni 1 kg meda (najviše 6 kg), koji se skupi klikom i prodaje po 10 zl/kg ili pojede.
- **Uređenje farme:** na mobitelu (Dostava → Uređenje farme) se naručuju kamena staza, ograda, cvjetna gredica, klupa, vrtni patuljak i lampion (noću svijetli). Iz torbe se postave na travu („Postavi na travu“, pa klik, više komada zaredom), a uklanjaju se gumbom „Ukloni košnicu ili ukras“. Ograda, klupa i košnica zaprečuju prolaz, ali igra ne dopušta da zatvore put do kuće, polja, zgrada ili ceste.
- **Ljubimac:** pas Šarko ili mačka Maca iz skloništa (5 zl, Dostava → Ljubimac) prati farmera i sjedne kad stane; klik na ljubimca je maženje, a jednom na dan daje +5 ⚡.
- **Obavijesti u browseru** (⚙ postavke): kad igra nije u fokusu, browser javi da je nešto sazrelo, da je štand prazan, da se kombi vratio ili da je stigla narudžba kupca.
- **Radni stol (izumi):**

  | Izum | Što radi |
  | --- | --- |
  | Sjeme iz plodova | 1 plod → 2–10 sjemenki |
  | Kompost | 5 kg ploda → vreća gnojiva (10 doza) iste kvalitete, najviše ★★★ |
  | Plan popravka kokošinjca | skica; kokošinjac popravlja farmer na licu mjesta |
  | Plan bunara | skica; bunar zida farmer na gradilištu |
  | Navodnjavanje v1–v10 (25–450 zl) | 10 razina za sve prskalice: 4, 12, 16, 24, 32, 44, 52, 60, 68 pa 80 parcela po prskalici |
  | Pecaljka (2 drva, 4 zl) | peti alat: pecanje na ribnjaku |
  | Malč (2 drva) | vreća malča, 10 doza |
  | Košnica (10 zl, 6 drva) | med svaki drugi dan |
  | Hladnjača (150 zl, 8 kamena) | plodovi u škrinji ne gube kvalitetu |
  | Velika kanta (15 zl) | 30 zalijevanja umjesto 12 |
  | `harvest-drone` (600 zl) | sam bere zrele usjeve i nosi ih u škrinju |
  | `replant.py` | dron nakon berbe ponovno posadi isto, ako ima sjemena |
  | SEO ploča za štand (80 zl) | 60 % više kupaca |
  | `git clone polje` (400 zl) | otključava drugo, zaraslo polje (još 48 parcela) |

  Strojevi pomažu, ali ne mogu zamijeniti brigu: voda iz prskalice vrijedi manje od ručnog zalijevanja, a dron bere najviše ★★★. **Najbolji plodovi idu samo iz farmerovih ruku.**
- **Farmer govori u oblačiću:** kad nešto ne može (nema sjemena, kanta je prazna, nema snage) ili pronađe i ubere nešto, to kaže iznad glave.
- **Mobitel** skuplja sve što se ne tiče izravno farmera: kupce na štandu, dron, dostave, trulež na polju i jutarnji izvještaj. Ima i katalog dostave sjemena. (Ime appa još biramo.)
- **📖 Priručnik (mobitel → Priručnik):** kako se što radi i pravi: gnojivo, sjeme, bunar, navodnjavanje, kokošinjac, šuma, energija, prodaja, tržnica, honorarci, svi izumi s radnog stola i tipke. Tražilica na vrhu (npr. „gnojivo“) otvori najbolju temu, a radni stol ima gumb „Kako se što radi“. Sve brojke u priručniku čitaju se iz `src/data.js`, pa su uvijek iste kao u igri.
- **Dostava:** na vrhu kartice je popis „Stiže sutra ujutro“ sa svime što je naručeno, a uz artikl u katalogu piše „naručeno N“. Do jutra se svaka narudžba može otkazati (paket po paket) i novac se vraća u cijelosti. Vodena pumpa se ne može naručiti dvaput: bunar treba samo jednu, pa je gumb zaključan kad je pumpa naručena, u torbi ili škrinji, ili već na bunaru.
- **Gradnja (bunar, kokošinjac):** cijena piše na kartici plana, a nakon skiciranja radni stol pokazuje popis s kvačicama (novac, drva, kamen, snaga): što imaš, a što još fali. Ako farmer pokuša graditi bez svega, kaže točno što mu fali.
- **Prebacivanje:** kad je otvorena škrinja, štand, kokošinjac ili kombi na parkiralištu, uz torbu biraš koliko jedan klik prebacuje: po 1, po 5 ili sve.
- **⚙ Postavke:** „Vrijeme teče i kad igra nije na ekranu“ (zadano isključeno) i brisanje farme.
- **Uz posao:** naslov taba pokazuje koliko je usjeva zrelo (`🌾 3 za berbu`). Dok je tab skriven, vrijeme stoji, pa ništa ne istrune dok si na sastanku. Igra se tiho sprema i kad zatvoriš tab, pa ne gubiš napredak ni bez spavanja.

## Kako je napravljeno

- **Čisti HTML, CSS i JavaScript (ES moduli)**, bez frameworka, build koraka i ovisnosti.
- **Sva pravila su u `src/sim.js`** kao čiste funkcije nad jednim objektom stanja, bez DOM-a: kretanje, rast, kvaliteta, kupci, dron, spavanje. Zato se testiraju izravno iz Nodea (`node --test`), a browser samo crta i prosljeđuje klikove.
- **Mapa (48×32 polja) se gradi u kodu** (`src/world.js`) od pravokutnika i deterministički raspoređenog drveća. Svaki put ista, a lako se mijenja.
- **Traženje puta:** Dijkstra po mreži. Farmer ide najkraćim putem, a kupci preferiraju cestu i stazu i ne gaze po poljima.
- **Pixel art se generira u kodu, piksel po piksel** (`src/pixel.js` + `src/art.js`), bez ijedne slike. Polje je 32×32 piksela, likovi 24×32, kuća 208×192. Za izgled se brinu:
  - sjenčanje kao da svjetlo pada odozgo lijevo, pa svaki oblik ima volumen
  - ditherani prijelazi između tonova
  - obrisi u tamnijoj nijansi susjedne boje umjesto crne linije
  - noise za travu, zemlju, koru i crijep

  Teren (organski rubovi staza, obala ribnjaka, trska, cvijeće) iscrta se jednom u veliki pozadinski canvas. Drveće, zgrade, ograde i likovi crtaju se po dubini, pa farmer može stati iza drveta.
- **Atmosfera:** dim iz dimnjaka, svjetlucanje vode, prskanje prskalice, a noću zaseban sloj svjetla: prozori i lampioni bacaju toplu svjetlost, uz krijesnice.
- Grafika se skalira samo cijelim brojevima piksela (ovisno o ekranu), pa pikseli ostaju oštri.
- **Grad je izvan mape:** farmer i kombi odlaze cestom na sjever i nestaju s ruba mape, a prodaja na tržnici se simulira u `src/sim.js` (isti kupci kao na štandu, samo češće i veće količine). Tako nije trebalo graditi drugu scenu, a putovanje se ipak vidi: farmer hoda cestom, kombi izlazi s parkirališta, vozi se i vraća (pixel art iz tri kuta: sa strane, straga i sprijeda).
- **Vrijeme:** 1 sekunda = 2 minute u igri, pa dan od 06 do 02 h traje 10 minuta. Usjevi rastu jednom dnevno, u jutarnjem koraku simulacije (`newDay` u `src/sim.js`). Noć je tamni sloj preko mape, a prozori kuće svijetle.
- **Novac** se u stanju igre čuva u srebrenjacima (cijeli brojevi), da nema grešaka zaokruživanja. Cijene se u `src/data.js` pišu u zlatnicima.
- **Spremanje:** `localStorage`. Farme iz starijih verzija prenose se automatski: stare kovanice se pretvaraju u nove (1 stara kovanica = 40 sr), a v2 farme zadrže bunar i dobiju 10 sjemenki rotkvice. Spavanje sprema „službeno“, uz to se tiho sprema svakih 30 s i pri zatvaranju taba. Ako je farmer ili kombi u gradu kad se tab zatvori, putovanje se nastavlja nakon učitavanja. Učitani podaci se provjeravaju polje po polje, a pokvaren ili stari zapis znači novu farmu umjesto rušenja.
- Žanr je inspiriran igrama poput Graveyard Keepera (farmer, poslovi, kuća, prodaja), ali grafika, likovi i svijet su originalni.
- U konzoli browsera `devFarm.state` pokazuje cijelo stanje igre, a `devFarm.skip(30)` premota 30 sekundi (1 sat u igri) s porukama, za debugiranje.

## Struktura

```
.
├── index.html        # stranica: HUD, mapa s gumbima i pločama (zgrada, torba, mobitel), alati
├── style.css         # tamna "IDE" tema
├── server.js         # mali statički server za npm start
├── package.json
├── src/
│   ├── data.js       # brojke: usjevi, cijene, vremena, recepti
│   ├── world.js      # mapa, zgrade, gdje se stoji da se nešto koristi
│   ├── path.js       # traženje puta (Dijkstra)
│   ├── sim.js        # pravila igre (čista logika)
│   ├── save.js       # spremanje i provjera učitanog
│   ├── pixel.js      # alat za pixel art: oblici, svjetlo, dithering, obrisi
│   ├── art.js        # sva grafika: teren, zgrade, likovi, usjevi, ikone
│   ├── render.js     # kamera, svijet, likovi, noć, efekti
│   ├── ui.js         # HUD, alati, torba, paneli, mobitel
│   ├── guide.js      # priručnik na mobitelu (teme s brojkama iz data.js, tražilica)
│   └── main.js       # petlja, klikovi, tipke, poruke
└── tests/
    ├── sim.test.js
    └── guide.test.js
```

## Moguća poboljšanja

- Ravnoteža brojki nakon pravog igranja: cijene, trajanje dana i potrošnja energije su procjene.
- Unutrašnjost kuće kao zasebna scena (kuhinja, krevet, nadogradnje kuće).
- Grad kao vlastita scena po kojoj se hoda (tržnica, trgovina, drugi prodavači).
- Godišnja doba i vremenske prilike (kiša zalijeva sama).
- Narudžbe kupaca („treba mi 5 ★★★ mrkvi do petka“) i reputacija štanda.
- Zvukovi s gumbom za isključivanje.
- Upravljanje tipkovnicom (WASD) uz klikove.
