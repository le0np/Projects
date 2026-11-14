# Napredak projekta bjj-fighter

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Testna verzija je igriva u pregledniku, na računalu i mobitelu:
- treninzi poteza na timer
- seminar i open mat
- sparing i natjecanje protiv AI-a s kritičnim trenucima i pravim BJJ bodovanjem
- promocija u pojas
- testni panel (ubrzanje 1–10x, sve otključano)
- spremanje u preglednik

## Napravljeno 14. studenog 2026.

### Plan i dizajn
- Ideja iz `IDEJE.md` razrađena s vlasnikom i prenesena u `docs/KONCEPT.md`.
- Dizajn testne verzije: `docs/superpowers/specs/2026-11-14-test-version-design.md`.
- Plan izrade: `docs/superpowers/plans/2026-11-14-test-version.md`.
- Vlasnik je odobrio da sat borbe ide 3x brže od stvarnog.

### Izrada (TDD, korak po korak prema planu)
1. Potezi i pojasevi: 48 bijelih i 7 naprednih poteza, uz seedable `rng`.
2. Graf pozicija (10 pozicija), akcije, obrane i greške za kritične trenutke.
3. Napredak:
   - trening s udvostručavanjem po razini i faktorom pojasa
   - seminar, open mat i natjecanje (šanse 90 %, 10–20 %, 5 %)
   - promocija
   - spremanje i učitavanje s offline napretkom; pokvaren zapis daje novu igru
4. Engine borbe:
   - runde i sat
   - bodovi tek nakon 3 s držanja
   - prednosti i kazne
   - kritični trenuci s 5 opcija i lancima protunapada
   - AI protivnici
   - odluka sucem kad je sve izjednačeno
5. Canvas 2D prikaz: poze za svaku poziciju (igrač gore i dolje), glatki prijelazi, disanje, udar akcije, kamera koja zumira i prati borce, slow-motion i tapkanje kod predaje.
6. Sučelje: klub, aktivnosti, borbe, testni panel, ekran borbe s tablicom bodova, komentarom i kritičnim trenucima (tipke 1–5).

### Odluke donesene usput
- Napravljene su na temelju zadanih smjernica; puni popis je u zapisniku izrade i u završnoj poruci.
- Faktor pojasa vrijedi za sve učenje, i za nove poteze i za više razine.
- Uz plan su dodane dvije obrane: obrana od kimure/americane i obrana od leg locka.
- Nema posebne pozicije za leg entanglement: leg lockovi idu iz otvorenog garda.
- Protunapad iz susjedne pozicije prebacuje borbu u tu poziciju.
- Borba se ne sprema: reload usred borbe je prekida bez upisa rezultata.

### Završni pregled koda i popravci
- Cijelu granu je pregledao neovisni recenzent. Kritičnih nalaza nije bilo.
- Popravljena su tri važna nalaza, svaki uz test koji je prvo pao:
  1. Djelomično pokvaren ili stari zapis u pregledniku sada se popravlja (nedostajuća polja dobiju zadane vrijednosti, neispravan trening ili aktivnost se odbaci, brojevi se ograniče). Prije je mogao srušiti igru ili tiho obrisati napredak.
  2. Prilika u borbi otvara se samo ako igrač zna barem jedan pravi napad iz te pozicije. Prije je mogla ponuditi pet krivih opcija, npr. kad igrač zna samo guard pull.
  3. Rok za odluku vezan je uz svaki kritični trenutak posebno (`src/ui/criticalTimer.js`). Protunapad koji se otvori u zadnjem trenutku prethodnog više ne istječe prije nego što ga igrač vidi.
- Odgođeni sitni nalazi:
  - Rezultat treninga ili aktivnosti koji je završio dok je igra bila zatvorena ne prikaže obavijest (napredak se ipak uračuna).
  - Bodovi koji se još nisu „držali” 3 s na samom kraju zadnje runde ne pretvore se u prednost.

## Napravljeno 14. studenog 2026. (nastavak)

### Dulji rok za odluku
- Vlasnik je javio da za pet opcija vrijeme istekne prebrzo. Rok za odluku u kritičnom trenutku podignut je s 10 na 20 stvarnih sekundi (`CRITICAL_TIME_LIMIT` u `src/engine/fight.js`), uz test.
- Rok ne ovisi o testnom ubrzanju vremena.

### Povratne informacije s testiranja (1. krug)
- Protivnik se slaže oko prosječne razine igrača (±1), jer je prije bio u prosjeku na razini 2 dok je igrač u testu na 1. Sparing je za pola razine lakši, a svaka runda natjecanja pola razine teža.
- Petlja obrane od armbara riješena: nakon uspješne obrane od submissiona iz loše pozicije igrač se izvuče u polugard, a protivnik 20 s ne može krenuti u novi submission.
- Sve opcije u kritičnom trenutku su prava imena tehnika s kratkim opisom. Krive su tehnike koje iz te pozicije ne idu.
- Kad dobar izbor ne uspije zbog razine, igra to jasno kaže (narančasta poruka s tvojom i protivnikovom razinom).
- Natjecanje traži barem po jedan potez iz napada, obrane i kontrole.

## Zadnja automatizirana provjera

Provedeno 14. studenog 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 50/50 prolazi |
| `npm start` | server odgovara 200 na `/` i module |
| Playwright e2e (1100 px) | trening uz 10x završi, sparing odigran do rezultata, reload zadrži napredak, 0 grešaka u konzoli |
| Playwright mobitel (iPhone 13) | nema horizontalnog scrolla ni u karijeri ni u borbi |
| Simulacija 300 borbi | igrač koji bira dobro: ~9,7 kritičnih trenutaka po borbi, ~62 % pobjeda |

## Poznata ograničenja

- Postoji samo testna verzija: nova igra uvijek počinje s uključenim „sve otključano”.
- Tehnike nemaju vlastite animacije. Vidi se udar prema protivniku i prijelaz u novu pozu.
- Reload usred borbe prekida borbu bez upisa rezultata.
- Opcije u kritičnim trenucima još nisu prilagođene razini igrača. Uvijek se nude sve obrane, a nepoznat potez ima malu šansu. Ostavljeno kao mogućnost iz koncepta.
- Nema kondicije ni umora.
- Nakon ponovnog otvaranja igre nema obavijesti o treningu ili aktivnosti koji su završili dok je igra bila zatvorena.

## Sljedeći koraci

1. Vlasnik isproba testnu verziju i javi što treba podesiti (učestalost kritičnih trenutaka, težina, trajanja).
2. Prava verzija: početak bez otključanih poteza, bez testnog panela.
3. Animacije pojedinih tehnika i više poza.
4. Kondicija, klub koji se nadograđuje, karijera.

## Handoff za novi chat

1. Kod je u `bjj-fighter/` na grani `dev`. Prvo pročitaj `README.md`, `docs/KONCEPT.md` i ovaj dokument.
2. Pokretanje: `npm start` (http://localhost:8080). Testovi: `npm test`. Poze: `tools/poses.html`.
3. Granice arhitekture:
   - `src/engine` i `src/data` ne smiju dirati DOM.
   - Renderer samo čita stanje borbe.
   - Slučajnost uvijek ide kroz `rng`.
   - Nove akcije idu u `src/data/positions.js`, a testovi u `tests/positions.test.js` provjeravaju da su podaci povezani.
