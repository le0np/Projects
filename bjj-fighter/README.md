# bjj-fighter

Browser igra u kojoj gradiš no-gi BJJ borca od bijelog pojasa. Potezi se uče i usavršavaju na timer, kao u igrama tipa Clash Royale, pa ne moraš stalno igrati. Boriš se protiv AI protivnika, a u kritičnim trenucima borba se uspori i biraš jednu od pet opcija. Neke su točne, a neke te koštaju pozicije, bodova ili borbe.

**Status:** 🚧 u izradi (testna verzija)

Cijeli dogovoreni koncept je u [`docs/KONCEPT.md`](docs/KONCEPT.md).

## Pokretanje

Treba samo [Node.js](https://nodejs.org) 20 ili noviji, bez instalacije paketa.

```bash
cd bjj-fighter
npm start          # server na http://localhost:8080
npm test           # testovi pravila igre (44 testa)
```

Otvori `http://localhost:8080`. Drugi port: `PORT=3000 npm start`. Dvoklik na `index.html` ne radi jer preglednici ne učitavaju JavaScript module s `file://`. Radi i bilo koji statički server, npr. `python3 -m http.server 8080` u ovoj mapi.

Alat za provjeru izgleda svih poza boraca: `http://localhost:8080/tools/poses.html`.

## Kako se igra

- **Klub:** popis poteza po skupinama (kretanje, rušenja, gardovi, sweepovi, prolazi, gornje pozicije, prijelazi, bijegovi, submissioni, obrane). Svaki potez ima razine 1–10. „Nauči” ili „Treniraj” pokreće trening. Istovremeno ide jedan trening, a traka gore pokazuje koliko je ostalo.
  - Razina n traje `osnovno vrijeme × 2^(n−1)`. Prvi potezi traju 5–60 s, napredni potezi viših pojaseva nekoliko minuta.
  - Viši pojas uči brže od bijelog: plavi 20 %, ljubičasti 45 %, smeđi 65 %, crni 85 %.
  - Potez višeg pojasa koji još ne znaš ne može se trenirati u klubu.
- **Aktivnosti:** idu usporedno s treningom, jedna po jedna.
  - Seminar: 50 €, 2 min, 90 % šanse za nasumičan novi potez.
  - Open mat: besplatan, 1 min, 10–20 % šanse.
  - Novi potez može biti i višeg pojasa, npr. heel hook.
- **Borbe:**
  - Sparing: pobjeda donosi 10 €.
  - Natjecanje: kotizacija 20 €, četvrtfinale, polufinale i finale. Zlato 100 €, srebro 40 €, bronca 15 €, uz 5 % šanse da pokupiš novi potez.
  - Promocija u viši pojas traži dovoljno naučenih poteza i pobjeda.
- **Borba:**
  - Traje 3 runde po 3 minute ili do submissiona. Sat ide 3x brže od stvarnog, a testno ubrzanje ga dodatno ubrzava.
  - Bodovanje: takedown 2, sweep 2, knee on belly 2, prolaz garda 3, mount 4, leđa 4. Bodovi se dobivaju tek nakon 3 s držanja pozicije.
  - Bez bodova pobjeđuje onaj s više prednosti (A), zatim onaj s manje kazni (K).
  - Heel hookovi su dopušteni.
- **Kritični trenuci:**
  - Uvijek kad te protivnik napada submissionom, a ponekad i kod sweepa, prolaza ili tvoje prilike.
  - Vrijeme se uspori i biraš jednu od 5 opcija klikom ili tipkama 1–5. Imaš 20 sekundi.
  - Ako ne odabereš ništa, to se računa kao pasivnost.
  - Kriva opcija može odmah otvoriti novu opasnost, npr. ruka unutra u gardu otvara triangle.
- **Test:**
  - ubrzanje vremena 1–10x (vrijedi za treninge, aktivnosti i sat borbe)
  - „Sve otključano”: svi potezi su barem na razini 1 i svi se mogu trenirati
  - izbor pojasa, +500 € i brisanje napretka

Napredak se sprema u preglednik (`localStorage`) i teče i dok je igra zatvorena, uz zadnje odabrano ubrzanje.

## Kako je napravljeno

- **Čisti JavaScript moduli i Canvas 2D, bez paketa i build koraka**, kao dev-farm. Pokretanje je jednostavno, a testovi rade izravno u Nodeu. Phaser ili React bi donijeli ovisnosti i build, a borci su ionako proceduralno crtani.
- **Logika je potpuno odvojena od prikaza.** `src/engine` ne zna za DOM ni Canvas, a renderer samo čita stanje borbe (pozicija, tko je gore, kritični trenutak). Zato se 2D prikaz kasnije može zamijeniti 3D-om bez diranja pravila.
- **Pozicije su graf.** Svaka akcija (`src/data/positions.js`) ima potez, poziciju, ulogu (gore, dolje ili stojeći), ciljnu poziciju, obrane i tipične greške. Kritični trenutak slaže 5 opcija od točnih obrana ili napada i od grešaka za tu situaciju.
- **Uspjeh ovisi o razinama.** Šansa raste s razinom tvog poteza u odnosu na najbolju obranu protivnika, uz slučajnost. Konstante su podešene simulacijom: igrač koji bira dobro ima prosječno oko 10 kritičnih trenutaka po borbi i pobjeđuje u oko 60 % borbi protiv bijelog pojasa.
- **Sva slučajnost u engineu ide kroz zadani `rng`**, pa su testovi deterministični.
- **Borci** su 2D figure sa zglobovima u rashguardu i šorcu: igrač je plavi, protivnik crveni. Svaka pozicija ima ključnu pozu, a između njih se glatko prelazi. Kamera prati borce, a slow-motion i zatamnjenje rubova označavaju kritični trenutak.

## Struktura

```
.
├── index.html, style.css     # sučelje
├── server.js                 # mali statički server (npm start)
├── src/
│   ├── data/moves.js         # potezi i pojasevi
│   ├── data/positions.js     # graf pozicija, akcije, greške za kritične trenutke
│   ├── engine/progression.js # treninzi na timer, aktivnosti, pojasevi, spremanje
│   ├── engine/fight.js       # borba: bodovanje, runde, kritični trenuci
│   ├── engine/opponent.js    # AI protivnici i igrač kao borac
│   ├── engine/rng.js         # seedable slučajnost
│   ├── render/               # Canvas 2D prikaz (poze, renderer)
│   └── ui/app.js             # ekrani, petlja igre, localStorage
├── tests/                    # node --test
├── tools/poses.html          # pregled svih poza
└── docs/                     # koncept, dizajn i plan izrade
```

## Moguća poboljšanja

- Prava (ne-testna) verzija bez testnog panela, s početnim stanjem bez naučenih poteza.
- Kondicija i umor kao dio borbe.
- Više poza i animacija za same tehnike (sada se tehnika vidi kao udar prema protivniku i prijelaz u novu poziciju).
- Klub koji se nadograđuje, karijera s rang-listom, MMA, PvP i računi.
