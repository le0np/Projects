# bjj-fighter

Browser igra u kojoj gradiš no-gi BJJ borca od bijelog pojasa. Potezi se uče i usavršavaju na timer, kao u igrama tipa Clash Royale, pa ne moraš stalno igrati. Boriš se protiv AI protivnika, a u kritičnim trenucima borba se uspori i biraš jednu od pet opcija. Neke su točne, a neke te koštaju pozicije, bodova ili borbe.

**Status:** 🚧 u izradi (testna verzija)

Cijeli dogovoreni koncept je u [`docs/KONCEPT.md`](docs/KONCEPT.md).

## Pokretanje

Treba samo [Node.js](https://nodejs.org) 20 ili noviji, bez instalacije paketa.

```bash
cd bjj-fighter
npm start          # server na http://localhost:8080
npm test           # testovi pravila igre i efekata (97 testova)
```

Otvori `http://localhost:8080`. Drugi port: `PORT=3000 npm start`. Dvoklik na `index.html` ne radi jer preglednici ne učitavaju JavaScript module s `file://`. Radi i bilo koji statički server, npr. `python3 -m http.server 8080` u ovoj mapi.

Alat za provjeru izgleda svih poza boraca: `http://localhost:8080/tools/poses.html`.

Prototip low-poly 3D stila (Three.js): `http://localhost:8080/tools/lowpoly.html`. Three.js 0.170 (MIT) je spremljen lokalno u `vendor/three/`, bez CDN-a i bez build alata.

Pregled pravog 3D modela u BJJ pozicijama (stav, zatvoreni gard, mount, leđa, side control): `http://localhost:8080/tools/model.html`. Model je „Universal Base Characters” od Quaterniusa (CC0, `assets/models/fighter/LICENSE.txt`).

## Kako se igra

- **Dvorana odozgo:** na vrhu ekrana je animirani pogled na klub iz ptičje perspektive. Usred tatamija ti (plava majica) drilaš potez koji treniraš s partnerom (rušenja stojeći, sve ostalo u parteru), uz naziv poteza, razinu i traku napretka. Fizička priprema je u teretani ili na traci za trčanje, a dok si na seminaru ili open matu stoji natpis kod izlaza. Bez treninga sjediš na klupi. Ostali članovi kluba sparaju, a trener šeta oko tatamija. Uz smanjeno kretanje u sustavu slika miruje.
- **Početak priče:** nova igra počinje uvodom u tri kartice („First day at the club”), a zatim te trener (Coach Mirko) vodi kroz zadatke: šest osnova (Shrimp, Bridge (upa), Closed guard, Guard posture, Elbow-knee escape, Hip bump sweep), prvi sparing, seminar ili open mat, prvo natjecanje i plavi pojas. Panel trenera stoji iznad stanja, a u dvorani odozgo trener ima oblačić. Vodič se može preskočiti.
- **Klub:** popis poteza po skupinama (kretanje, rušenja, gardovi, sweepovi, prolazi, gornje pozicije, prijelazi, bijegovi, submissioni, obrane). Svaki potez ima razine 1–10. „Learn” ili „Train” pokreće trening. Igrač radi jednu stvar u isto vrijeme (potez, teretana, kardio, seminar ili open mat), a traka gore pokazuje koliko je ostalo.
  - Razina n traje `osnovno vrijeme × 2^(n−1)`. Prvi potezi traju 5–60 s, napredni potezi viših pojaseva nekoliko minuta.
  - Viši pojas uči brže od bijelog: plavi 20 %, ljubičasti 45 %, smeđi 65 %, crni 85 %.
  - Potez višeg pojasa koji još ne znaš ne može se trenirati u klubu.
- **Aktivnosti:** dok si na aktivnosti ne treniraš u klubu, i obrnuto.
  - Seminar: 50 €, 1 h stvarnog vremena (ne ubrzava se i teče i dok je igra zatvorena), 90 % šanse za nasumičan novi potez.
  - Open mat: besplatan, 1 min, 10–20 % šanse.
  - Novi potez može biti i višeg pojasa, npr. heel hook.
- **Borbe:**
  - Fizička priprema: teretana (snaga) i kardio (kondicija), razine 1–10, kao i trening tehnike zauzima te dok traje. Snaga dodaje 3 % šanse po razini razlike u svakom napadu i obrani, a kondicija određuje koliko brzo se umaraš u borbi.
  - Sparing: uvijek u tvojoj dvorani, s nasumičnim partnerom od bijelog do plavog pojasa i nasumičnim znanjem. Pobjeda donosi 10 €.
  - Natjecanje: kotizacija 20 €, četvrtfinale, polufinale i finale, protiv protivnika tvog pojasa s vještinom tipičnom za taj pojas (svaka runda malo jača). Zlato 100 €, srebro 40 €, bronca 15 €, uz 5 % šanse da pokupiš novi potez.
  - Promocija u viši pojas traži dovoljno naučenih poteza i pobjeda na natjecanjima (svaka pobijeđena borba na turniru, sparing se ne računa).
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
- **Tijek borbe:** borci igraju potez za potez. Oba borca ponekad pogriješe, rjeđe što je pojas i razina poteza viša, a protivnikova greška tebi daje priliku. Šansa greške oba borca (u postocima) piše uz ime na semaforu i na početku loga, a log za svaki potez navodi razine, šansu i točne bodove (npr. „Scissor sweep +2, mount +4 = +6”). Tempo je natjecateljski (ADCC, CJI, UFC BJJ): razmjene idu svakih 4–7 s i većina se odigra sama prema razinama, a odluka se traži u oko 10 % razmjena (5–7 po borbi, najviše jedna u 20 s). Brz odgovor (u prvoj trećini roka) daje +10 % šanse. Kartice su obojene u tri boje: napad, sweep i obrana. Kod prilike se nude samo tehnike koje znaš za svoju poziciju i ulogu, svaka s tvojom razinom. Od plavog pojasa kartica nudi i „osjećaj” („Your gut says”, savjet koju karticu odabrati), koji je pouzdaniji što je pojas viši i razina tehnika veća.
- **Semafor i efekti:** semafor je TV traka preko slike borbe: portret u okviru boje pojasa, ime, bodovi, A/K, energija u 10 segmenata i sat na jantarnoj pločici. Uspješna tehnika dobiva natpis preko slike (TAKEDOWN!, SWEEP!, PASS!, MOUNT!, BACK!, a submission TAP!), upisani bodovi značku „+2” uz semafor, a rušenje i sweep kratko protresu sliku. Uz smanjeno kretanje u sustavu efekti se samo pojave i nestanu.
- **Log borbe:** cijeli log je ispod borbe. „Copy log” kopira ga s rezultatom, pa ga možeš zalijepiti u chat.
- **Test:**
  - ubrzanje vremena 1–10x (vrijedi za treninge, aktivnosti i sat borbe)
  - „Unlock everything”: svi potezi su barem na razini 1 i svi se mogu trenirati
  - izbor pojasa, +500 € i brisanje napretka
  - u klubu tipka „⚡ +1” uz svaki potez: odmah jedna razina više, bez odbrojavanja

Napredak se sprema u preglednik (`localStorage`) i teče i dok je igra zatvorena, uz zadnje odabrano ubrzanje.

## Kako je napravljeno

- **Sav tekst u igri je na engleskom**, prema odluci vlasnika. Imena protivnika su hrvatska, a dokumentacija ostaje na hrvatskom.
- **Čisti JavaScript moduli i Canvas 2D, bez paketa i build koraka**, kao dev-farm. Pokretanje je jednostavno, a testovi rade izravno u Nodeu. Phaser ili React bi donijeli ovisnosti i build, a borci su ionako proceduralno crtani.
- **Logika je potpuno odvojena od prikaza.** `src/engine` ne zna za DOM ni Canvas, a renderer samo čita stanje borbe (pozicija, tko je gore, kritični trenutak). Zato se 2D prikaz kasnije može zamijeniti 3D-om bez diranja pravila.
- **Pozicije su graf.** Svaka akcija (`src/data/positions.js`) ima potez, poziciju, ulogu (gore, dolje ili stojeći), ciljnu poziciju, obrane i tipične greške. Kritični trenutak slaže do 5 opcija samo od poteza koje igrač zna: točnih obrana ili napada i drugih poteza iz iste pozicije (ili susjedne), nikad stojećih tehnika na podu. Ako igrač ne zna obranu, odluke nema i napad se riješi po razinama.
- **Uspjeh ovisi o razinama.** Šansa raste s razinom tvog poteza u odnosu na najbolju obranu protivnika, uz slučajnost. Konstante su podešene simulacijom: igrač koji bira dobro ima prosječno oko 10 kritičnih trenutaka po borbi i pobjeđuje u oko 60 % borbi protiv bijelog pojasa.
- **Sva slučajnost u engineu ide kroz zadani `rng`**, pa su testovi deterministični.
- **3D borci su pravi model s kosturom, ne likovi iz koda.** Low-poly likovi složeni od valjaka izgledali su kao štapići, pa je odabran besplatan CC0 model (Quaternius, Standard verzija, atletska građa, oko 13 tisuća trokuta). U repou je samo ono što se koristi (muški model, dvije boje kože, dvije frizure, brada; teksture smanjene na 1024 px, ukupno oko 1,5 MB). Model nema odjeću, pa se rashguard i hlačice boje u shaderu prema težinama kostiju (prsa i nadlaktice, kukovi i bedra). Poze su 3D ciljevi (`src/render/poses3d.js`: kukovi, smjer trupa, šake, stopala), a ruke i noge postavlja IK s dvije kosti s pravim duljinama kostiju modela (`src/render/fighter3d.js`). Prijelazi miješaju rotacije kostiju (slerp).
- **HUD i efekti su HTML preko canvasa**, ne dio crteža. Logiku „što prikazati” (`src/ui/fightFx.js`) čini skup čistih funkcija nad stanjem borbe, pa HUD i efekti ostaju isti kad 2D prikaz zamijeni 3D. Font je Barlow Condensed (SIL OFL, `assets/fonts/OFL.txt`) spremljen u projekt, pa igra radi bez interneta.
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
│   ├── render/               # Canvas 2D prikaz (poze, renderer borbe, dvorana odozgo) i 3D model (fighter3d.js, poses3d.js)
│   ├── ui/app.js             # ekrani, petlja igre, localStorage
│   ├── ui/fightFx.js         # natpisi, značke s bodovima i energija za HUD (bez DOM-a)
│   └── ui/gymScene.js        # gdje si u dvorani i što radiš, za pogled odozgo (bez DOM-a)
├── tests/                    # node --test
├── assets/fonts/             # Barlow Condensed (woff2) i licenca OFL
├── assets/models/fighter/    # 3D model boraca (Quaternius, CC0), teksture 1024 px
├── tools/poses.html          # pregled svih poza
├── tools/lowpoly.html        # prototip low-poly 3D stila
├── tools/model.html          # pregled 3D modela u BJJ pozicijama
├── vendor/three/             # Three.js (MIT) i GLTFLoader, lokalno
└── docs/                     # koncept, dizajn i plan izrade
```

## Moguća poboljšanja

- Prava (ne-testna) verzija bez testnog panela, s početnim stanjem bez naučenih poteza.
- 3D borba u stilu bliskom MMA Manageru: Three.js i besplatan humanoidni model, poze iz igre na kosturu modela. Portreti na semaforu tada postaju prikaz glave modela.
- Klub kao izometrijska dvorana sa stanicama za trening i odbrojavanjem iznad njih.
- Klub koji se nadograđuje, karijera s rang-listom, MMA, PvP i računi.
