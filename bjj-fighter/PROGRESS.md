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

### 2. krug, korak 1: pravila borbe
Dizajn: `docs/superpowers/specs/2026-11-14-round2-step1-fight-rules-design.md`, plan: `docs/superpowers/plans/2026-11-14-round2-step1-fight-rules.md`.
- Potez za potez: inicijativa se strogo izmjenjuje, a propali potez predaje red drugome.
- Oba borca griješe po pojasu i razini poteza: bijeli 25 %, plavi 18 %, ljubičasti 12 %, smeđi 8 %, crni 5 %, uz −1,5 postotna boda po razini iznad 1 i najmanje 2 %. Greška protivnika daje igraču kritični trenutak „pogriješio je — prilika”.
- Odluka se traži u oko 30 % razmjena (70/30), a razmjene idu svakih 6–9 s.
- Odgovor u prvoj trećini roka daje +10 % šanse.
- Kartice opcija u bojama: napad crveno, obrana plavo, kontrola zeleno, pozicija žuto. Iznad opcija je legenda.
- Cijeli log borbe sa scrollom, rundom i satom. Bodovi su razloženi (npr. „Flower sweep 2 + mount 4”). U logu su i ponuđene opcije (točne s ✔) i tvoj izbor. Gumb „Kopiraj log” kopira sve s rezultatom.
- Simulacija: igrač s 75 % točnih odabira pobjeđuje u oko 60 % sparinga.

### Tipka za trenutno učenje (test)
- Svaki potez u klubu u testnoj verziji ima tipku „⚡ +1” koja odmah podigne potez za jednu razinu, bez čekanja (do razine 10). Ako taj potez trenutno trenira, trening se poništi jer je razina već dobivena.

### Greške protivnika i precizniji log
- Prikazana šansa greške u postocima: uz ime borca na semaforu („greška 18 %”) i u prvom retku loga, prema pojasu i prosječnoj razini poteza.
- Svaka greška u logu navodi koliko je bila vjerojatna („Marko griješi: Toreando mu ne sjeda (šansa greške 24 %)”).
- Kad protivnik nadjača dobar izbor ili obrani tvoj automatski potez, log kaže „nadjačao” i navodi razine i šansu („razina 3 protiv tvoje obrane razine 1 (šansa obrane bila je 70 %)”). Isto u narančastoj poruci nakon odluke.
- Bodovi su precizni u dva koraka: odmah „Flower sweep +2, mount +4 = +6 (boda ako zadrži 3 s)”, zatim „+6 boda: Ti (Flower sweep +2, mount +4)”. Svaka prednost ima svoj redak s razlogom („+1 prednost: Ti (skoro Knee slice)”), a kazna „+1 kazna”.

## Zadnja automatizirana provjera

Provedeno 14. studenog 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 63/63 prolazi |
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

1. Korak 2 drugog kruga: pobjede samo s natjecanja za promociju, granice razina po pojasu, novi seminari (instruktori 1–5 ★, 40–90 %, trening pauziran). Korak 3: stil borbe, energija, ozljede.
2. Vlasnik isproba testnu verziju i javi što treba podesiti (učestalost kritičnih trenutaka, težina, trajanja).
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
