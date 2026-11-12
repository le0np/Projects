# dev-farm

Mala 2D farma za browser, za ITjevce koji sanjaju o selu. U pauzi između taskova sadiš, zalijevaš i bereš, a zaradu ulažeš u skripte i izume (cron za zalijevanje, dron za berbu…) koji farmu vode umjesto tebe, i dok si na sastanku.

**Status:** 🚧 u izradi (v1 igriva)

## Pokretanje

Treba samo [Node.js](https://nodejs.org) 20 ili noviji, bez instalacije paketa.

```bash
cd projects/dev-farm
npm start          # pokreće server na http://localhost:8080
npm test           # testovi pravila igre
```

Otvori `http://localhost:8080` u browseru. Drugi port: `PORT=3000 npm start`.

`index.html` se ne može otvoriti dvoklikom: browseri ne učitavaju JavaScript module s `file://`, zato postoji mali `server.js`. Radi i bilo koji drugi statički server, npr. `python3 -m http.server 8080` u ovoj mapi.

## Što može

- **Ručna igra:** klik na parcelu radi ono što ima smisla. Prazna se posadi odabranim sjemenom, suha (💧) se zalije, a zrela pobere. Zalivena biljka raste 2× brže, voda traje 30 s.
- **5 usjeva:** rotkvica, mrkva, krumpir, rajčica i bundeva. Skuplji usjevi se otključavaju ukupnom zaradom, više zarađuju, ali sporije rastu.
- **Skripte i izumi**, svaki s razinama:

  | Stavka | Što radi |
  | --- | --- |
  | `water.sh` | svakih 10 s zalije 3 → 25 suhih parcela |
  | `harvest-drone` | bere jednu zrelu parcelu svakih 8 → 1 s |
  | `replant.py` | nakon berbe odmah posadi isti usjev |
  | `compost-cache` | do +100 % brzine rasta |
  | `git clone polje` | polje 3×3 → 4×4 → 5×5 |

- **Igra se uz posao:** farma radi i kad je tab u pozadini ili zatvoren (nadoknada do 8 h). Napreduje samo onoliko koliko je automatizirana: bez drona usjevi dozore i čekaju te.
- **Naslov taba** pokazuje koliko je parcela spremno za berbu (`🌾 3 za berbu`), da vidiš bez prebacivanja.
- **Terminal** ispisuje što skripte rade. Kad se vratiš nakon pauze, javi što se dogodilo dok te nije bilo.
- Sve se automatski sprema u browser (`localStorage`). `rm -rf farma` u podnožju briše farmu.

## Kako je napravljeno

- **Čisti HTML, CSS i JavaScript (ES moduli)**, bez frameworka, build koraka i ovisnosti. Igra je mala, a ovako se pokreće bilo gdje i nema što zastarjeti.
- **Sva pravila igre su u `src/sim.js`** kao čiste funkcije nad jednim objektom stanja, bez DOM-a. Ista funkcija `advance()` pokreće živu igru, tab u pozadini i nadoknadu nakon povratka, a testovi je pozivaju izravno iz Nodea (`node --test`).
- **Pixel art je nacrtan u kodu** (`src/sprites.js`, jedan znak = jedan piksel), pa nema slika ni pitanja licenci.
- **Canvas** crta polje, a obični DOM drži panele, jer su gumbi i tekst u DOM-u pristupačniji i lakši za stiliziranje.
- **Nema zvuka**, jer se igra na poslu.
- Brojke (cijene, vremena) su u `src/data.js`. Ciljano je da se prva skripta kupi nakon minutu-dvije aktivne igre.

## Struktura

```
.
├── index.html        # stranica
├── style.css         # tamna "IDE" tema
├── server.js         # mali statički server za npm start
├── package.json
├── src/
│   ├── data.js       # usjevi, skripte, cijene, ravnoteža
│   ├── sim.js        # pravila igre (čista logika)
│   ├── save.js       # spremanje, učitavanje, provjera spremljenog
│   ├── sprites.js    # pixel art
│   ├── render.js     # crtanje polja i efekata na canvasu
│   ├── ui.js         # paneli, terminal, naslov taba
│   └── main.js       # spaja sve: petlja, klikovi, spremanje
└── tests/
    └── sim.test.js
```

## Moguća poboljšanja

- Ravnoteža brojki nakon pravog igranja (tempo je procijenjen, nije isproban satima).
- Prestige: „refaktoriraj farmu“ za trajni bonus.
- Više izuma: plašilo protiv bugova, staklenik, tržnica s cijenama koje se mijenjaju.
- Zvukovi (s gumbom za isključivanje) i animirani farmer.
- Dotjeran prikaz na mobitelu (sada radi, ali je zamišljen za desktop).
