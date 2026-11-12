# dev-farm

2D farma za browser za ITjevce koji sanjaju o selu. Vodiš farmera po imanju klikovima miša: sadiš, zalijevaš, gnojiš i bereš, a kvalitetnu robu prodaješ na štandu ispred kuće. Navečer ideš spavati, čime se igra sprema. Kako farma raste, developer u tebi gradi izume koji preuzimaju dio posla: prskalice, dron, skripte.

**Status:** 🚧 u izradi (v4 igriva)

## Pokretanje

Treba samo [Node.js](https://nodejs.org) 20 ili noviji, bez instalacije paketa.

```bash
cd projects/dev-farm
npm start          # server na http://localhost:8080
npm test           # testovi pravila igre
```

Otvori `http://localhost:8080`. Drugi port: `PORT=3000 npm start`. Dvoklik na `index.html` ne radi jer browseri ne učitavaju JavaScript module s `file://`. Radi i bilo koji statički server, npr. `python3 -m http.server 8080` u ovoj mapi.

## Kako se igra

- **Kretanje:** klikni bilo gdje na mapi i farmer ode tamo najkraćim putem. Klik na zgradu ili parcelu znači „idi tamo i napravi nešto“.
- **Zoom:** gumbi + / − u kutu mape, kotačić miša ili tipke + i −. Odabrani zoom se pamti.
- **Alati (tipke 1–4):** ✋ ruke (berba, uzimanje), 🌱 sjeme, 🪣 kanta, 🧪 gnojivo. Klik na parcelu radi ono što farmer drži u ruci. Zrelu biljku bere bilo kojim alatom.
- **Sjeme se broji i nije besplatno.** Na početku ga nema. Vrećica ispod alata pokazuje koliko kojeg imaš. Sjeme se dobiva na tri načina:
  - **Otkrivanjem:** u ladici u kući, a na imanju rastu stara rotkvica, divlja mrkva i divlji krumpir. Svako jutro nešto novo može niknuti samo od sebe.
  - **Iz plodova** na radnom stolu: neprodani plod daje 2–10 sjemenki, nasumično. Tako jedan usjev donosi puno novih.
  - **Dostavom:** naručiš na mobitelu („Dostava sjemena“), paket od 5 sjemenki stiže sutra ujutro. Katalog se širi kako zarađuješ.
- **Kvaliteta: ★ loše, ★★ dobro, ★★★ odlično, ★★★★ zlatno.** Ovisi o tri stvari:
  - koliko je vremena rasta biljka bila zalivena (suha raste i sporije)
  - je li pognojena
  - koliko brzo je ubrana nakon što sazrije: prezrela gubi kvalitetu, a na kraju istrune

  Preko noći zreli usjevi čekaju i ne propadaju.
- **Štand ispred kuće:** stavi plodove na štand. Kupci dolaze cestom od 08 do 19 h i uvijek uzmu najbolje što vide. **Cijena ovisi o kvaliteti:** ★ 0,5×, ★★ 1×, ★★★ 1,5×, zlatno 2,2×. Loše (★) plodove kupuju samo kad na štandu nema boljih. Mogu se i pojesti za energiju, pretvoriti u gnojivo ili u sjeme.
- **Kuća:** spavanje završava dan, vraća svu energiju i **sprema igru**. Kava (15 🪙) daje +35 energije. Tko ostane budan do 02 h, zaspi na nogama i budi se s pola energije.
- **Energija:** svaki posao troši energiju (sadnja 2, zalijevanje, gnojenje i berba po 1). Hodanje je besplatno.
- **Voda:** na početku samo **ribnjak** puni kantu (12 zalijevanja, s velikom kantom 30). **Bunara nema:** kod kuće je gradilište, a bunar se zida na radnom stolu. Kad je sazidan, voda je blizu polja i postaje izvor za **navodnjavanje**: prskalice se mogu izraditi tek kad bunar postoji.
- **Škrinja** (24 mjesta) za višak. Torba ima samo 8 mjesta.
- **Radni stol (izumi):**

  | Izum | Što radi |
  | --- | --- |
  | Sjeme iz plodova | 1 plod → 2–10 sjemenki |
  | Gnojivo (kompost / kupovno) | od 2 loša proizvoda, ili za 12 🪙 |
  | Bunar | voda kod kuće, izvor za navodnjavanje |
  | Prskalica · `water.sh` | traži bunar; postavi se na parcelu, svakih 30 s zalije 8 parcela oko sebe |
  | Velika kanta | 30 zalijevanja umjesto 12 |
  | `harvest-drone` | sam bere zrele usjeve i nosi ih u škrinju |
  | `replant.py` | dron nakon berbe ponovno posadi isto, ako ima sjemena |
  | SEO ploča za štand | 60 % više kupaca |
  | `git clone polje` | otključava drugo, zaraslo polje (još 48 parcela) |

  Strojevi pomažu, ali ne mogu zamijeniti brigu: voda iz prskalice vrijedi manje od ručnog zalijevanja, a dron bere najviše ★★★. **Zlatna kvaliteta ide samo iz farmerovih ruku.**
- **Farmer govori u oblačiću:** kad nešto ne može (nema sjemena, kanta je prazna, nema snage) ili pronađe i ubere nešto, to kaže iznad glave.
- **Mobitel** skuplja sve što se ne tiče izravno farmera: kupce na štandu, dron, dostave, trulež na polju i jutarnji izvještaj. Ima i katalog dostave sjemena. (Ime appa još biramo.)
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
- **Vrijeme:** 1 sekunda = 2 minute u igri, pa dan od 06 do 02 h traje 10 minuta. Noć je tamni sloj preko mape, a prozori kuće svijetle.
- **Spremanje:** `localStorage`. Farme spremljene u starijoj verziji (v2) prenose se automatski: zadrže bunar i dobiju 10 sjemenki rotkvice. Spavanje sprema „službeno“, uz to se tiho sprema svakih 30 s i pri zatvaranju taba. Učitani podaci se provjeravaju polje po polje, a pokvaren ili stari zapis znači novu farmu umjesto rušenja.
- Žanr je inspiriran igrama poput Graveyard Keepera (farmer, poslovi, kuća, prodaja), ali grafika, likovi i svijet su originalni.
- U konzoli browsera `devFarm.state` pokazuje cijelo stanje igre, za debugiranje.

## Struktura

```
.
├── index.html        # stranica: HUD, mapa, alati, paneli
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
│   ├── ui.js         # HUD, alati, torba, paneli, terminal
│   └── main.js       # petlja, klikovi, tipke, poruke
└── tests/
    └── sim.test.js
```

## Moguća poboljšanja

- Ravnoteža brojki nakon pravog igranja: cijene, trajanje dana i potrošnja energije su procjene.
- Unutrašnjost kuće kao zasebna scena (kuhinja, krevet, nadogradnje kuće).
- Godišnja doba i vremenske prilike (kiša zalijeva sama).
- Narudžbe kupaca („treba mi 5 ★★★ mrkvi do petka“) i reputacija štanda.
- Zvukovi s gumbom za isključivanje.
- Upravljanje tipkovnicom (WASD) uz klikove.
