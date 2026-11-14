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

### Za promociju se broje samo pobjede na natjecanjima

- Uvjet „pobjede” za promociju (npr. plavi pojas: 20 poteza, 5 pobjeda) sad broji samo pobjede na natjecanjima. Svaka pobijeđena borba na turniru (četvrtfinale, polufinale, finale) vrijedi jednu pobjedu. Sparing se i dalje upisuje u ukupni omjer pobjeda i poraza, ali ne vodi do promocije.
- Novo polje `compWins` u spremljenoj igri. Stare spremljene igre nemaju to polje, pa se izračuna iz medalja: zlato 3, srebro 2, bronca 1 pobjeda. Ispadanje u četvrtfinalu nema pobjeda, pa je izračun točan za sve završene turnire.
- U kartici promocije piše „Pobjede na natjecanjima: X / Y”, kartica Karijera ih prikazuje posebno, a kartica Sparing kaže da se ne računa za promociju.
- Bilježenje rezultata borbe prebačeno je u `recordFight` u `progression.js` da se može testirati bez DOM-a.

### Kartice prema poziciji i naučenim potezima
- Kartice u kritičnom trenutku nude samo poteze koje igrač zna (razina ≥ 1; uz „sve otključano” to su svi).
- Krive opcije su naučeni potezi iz iste situacije: potezi druge strane u toj poziciji, obrane te pozicije i potezi iste uloge u susjednoj poziciji. Stojeće tehnike (double leg, single leg, guard pull, sprawl) se ne nude na podu, a parterne tehnike se ne nude u stavu.
- Ako igrač ne zna nijednu obranu ili nema nijedan drugi naučeni potez za tu situaciju, odluke nema: napad se odigra prema razinama, a log napiše „ne znaš obranu” i šansu.
- Zbog toga kartica može biti manje od 5 (najmanje 2).

### Natjecateljski tempo (manje odluka, više razmjena)
Vlasnik: previše odluka, borci se previše negiraju; cilj je stil turnira poput ADCC-a, CJI-ja, UFC BJJ-a i Flo Grapplinga.
- Razmjene svakih 4–7 s (prije 6–9 s), a između dvije odluke prođe najmanje 20 s borbe.
- Odluka se traži u oko 10 % razmjena (prije 30 %): protivnikov sweep, prolaz ili rušenje 12 %, njegov submission 60 %, tvoja prilika 10 %, njegova greška 40 % (inače +1 prednost).
- Automatske razmjene češće prolaze: pozicijski potez kod jednakih razina 60 % (prije 30 %), +7 postotnih bodova po razini razlike, 25–90 %. Submission sam od sebe rijetko uspije (5 %, +3 po razini, najviše 30 %), a borci ga rjeđe biraju.
- Tvoj submission iz prilike: 20 % kod jednakih razina (prije 35 %), +5 po razini.
- Kriva obrana od submissiona završi borbu u 60 % slučajeva. Inače se izvučeš, a protivnik dobije prednost. Bez odgovora i dalje tapkaš.
- Simulacija 300 sparinga (igrač bira točno u 75 % slučajeva): ~6 odluka i ~58 razmjena po borbi, ~22 uspjela poteza prema ~17 obranjenih, ~35 bodova ukupno, ~69 % borbi završi submissionom, prosječno 5,4 min, ~60 % pobjeda.

### Nova igra počinje od nule
- Vlasnik ne želi da igrač od početka ima razinu 1 u svim vještinama. Nova igra sad počinje bez ijednog poteza, a „sve otključano” u testnom panelu je isključeno (može se uključiti).
- Stari save zadržava svoju postavku. Za početak od nule treba „Nova igra” ili isključiti „sve otključano”.
- Bez naučenih poteza igrač u borbi ne napada i nema odluka (nema obrana), pa prvo treba trenirati.

### Bijeli pojas griješi puno češće
- Vlasnik: bijeli pojas treba griješiti puno više od 25 %. Šansa greške bijelog pojasa je sad 40 % na razini 1 (−1,5 postotna boda po razini iznad 1). Ostali pojasevi ostaju: plavi 18 %, ljubičasti 12 %, smeđi 8 %, crni 5 %.
- Simulacija bijeli protiv bijelog: ~24 greške po borbi (prije ~15), ~18 uspjelih poteza, ~6–7 odluka, ~64 % pobjeda uz 75 % točnih odabira.

### Povratne informacije 14. 11. navečer: greške, sparing partneri, grafika, zaglavljena borba
Vlasnik: bijeli pojas griješi barem 60 %, bijeli i plavi rade puno grešaka koje se smanjuju razinom; više dinamike; sparing je u dvorani s nasumičnim partnerima od bijelog do plavog pojasa; poruka „pogriješio je — prilika” ne kaže za što; očekuje se bolja grafika; testni sparing je zaglavio do druge runde.
- **Greške:** na razini 1 bijeli 60 %, plavi 42 %, ljubičasti 25 %, smeđi 13 %, crni 6 %. Svaka razina iznad 1 množi šansu s 0,88 (bijeli: razina 3 → 46 %, razina 5 → 36 %, razina 10 → 19 %), najmanje 2 %.
- **Dinamika:** kad netko pogriješi, drugi u pola slučajeva odmah kontrira pozicijskim potezom (+10 % šanse, bez submissiona). Za tvoju grešku kontrira protivnik, za njegovu ti (odluka u 25 % slučajeva, inače automatski).
- **Zaglavljena borba:** uzrok je bio što nijedan borac nije znao nijedan potez iz pozicije (npr. ti dolje u mountu bez bijega, protivnik bez napada iz mounta), pa se do kraja runde ništa nije događalo. Sad borac bez naučenog poteza radi na instinkt (bijeg, sweep, prolaz ili rušenje razine 0, nikad submission), a log piše „bez naučene tehnike, na instinkt”.
- **Prilika nakon greške:** tekst kaže što se dogodilo i što napraviti: „Marko je zeznuo Kimura — kazni ga! Izaberi napad iz pozicije: zatvoreni gard.” Obična prilika: „Prilika za napad! Izaberi tehniku iz pozicije: …”.
- **Kartice:** krive opcije su samo iz iste pozicije (potezi druge strane i obrane te pozicije), više ne iz susjednih. Prije se znao ponuditi rear naked choke iz zatvorenog garda.
- **Sparing partneri:** uvijek u dvorani, nasumičan partner: 55 % bijeli, 45 % plavi pojas, razine tipične za pojas (bijeli 1–3, plavi 3–5), a zna nasumičan dio poteza svog pojasa (35–90 %).
- **Odluke:** između dvije odluke najmanje 30 s borbe. ~6 odluka po borbi (~7 % razmjena).
- **Grafika:** sparing u dvorani (prozori, transparenti kluba, stalak s pojasevima, parovi koji treniraju u pozadini, plavi tatami), natjecanje u areni (publika, reflektori, crna strunjača). Borci se stalno gibaju (stav, njihanje, borba za hvat), napadi imaju animaciju po vrsti (rušenje nisko naprijed, sweep diže kukove, prolaz gura oko nogu, bijeg je shrimp unazad, submission stiskanje, a napadnuti se otima), promašaj se vidi kao posrtanje, a prijelaz pozicije kao kratki scramble. Iznad borca izleti ime tehnike (zeleno ✔, crveno ✘, žuto … dok se čeka odluka), a na dnu slike ide komentar zadnja dva retka loga.
- Favicon (nema više 404 u konzoli).
- Simulacija 300 sparinga (sve otključano, 75 % točnih odabira): ~81 razmjena, ~6 odluka, ~26 uspjelih poteza, ~37 grešaka, ~45 bodova ukupno, ~61 % submissiona, prosječno 6 min, ~52 % pobjeda. Fuzz 3000 borbi s nasumičnim potezima: nijedna ne zastane ni ne pukne.

## Zadnja automatizirana provjera

Provedeno 14. studenog 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 72/72 prolazi |
| `npm start` | server odgovara 200 na `/` i module |
| Playwright e2e (1100 px) | sparing (dvorana) i natjecanje (arena) odigrani do rezultata uz „sve otključano”, 0 grešaka u konzoli |
| Playwright mobitel (iPhone 13) | nema horizontalnog scrolla ni u karijeri ni u borbi |
| Simulacija 300 sparinga | ~6 odluka po borbi (~11 % razmjena), ~60 % pobjeda uz 75 % točnih odabira |

## Poznata ograničenja

- Postoji samo testna verzija (testni panel, ubrzanje, ⚡ +1).
- Animacije su po vrsti tehnike (rušenje, sweep, prolaz, bijeg, submission), ne za svaku tehniku posebno. Poze su ključne poze po poziciji, 2D.
- Reload usred borbe prekida borbu bez upisa rezultata.
- Dok je uključeno „sve otključano”, igrač zna sve poteze pa se nude svi potezi iz pozicije.
- Igrač bez poteza bori se samo na instinkt (male šanse); nema upozorenja prije sparinga.
- Nema kondicije ni umora.
- Nakon ponovnog otvaranja igre nema obavijesti o treningu ili aktivnosti koji su završili dok je igra bila zatvorena.

## Sljedeći koraci

1. Korak 2 drugog kruga: granice razina po pojasu, novi seminari (instruktori 1–5 ★, 40–90 %, trening pauziran). Korak 3: stil borbe, energija, ozljede.
2. Vlasnik isproba testnu verziju i javi što treba podesiti (učestalost kritičnih trenutaka, težina, trajanja).
2. Prava verzija: početak bez otključanih poteza, bez testnog panela.
3. Animacije pojedinih tehnika i više poza (npr. zasebne poze za trokut, armbar, leg lockove).
4. Kondicija, klub koji se nadograđuje, karijera.

## Handoff za novi chat

1. Kod je u `bjj-fighter/` na grani `dev`. Prvo pročitaj `README.md`, `docs/KONCEPT.md` i ovaj dokument.
2. Pokretanje: `npm start` (http://localhost:8080). Testovi: `npm test`. Poze: `tools/poses.html`.
3. Granice arhitekture:
   - `src/engine` i `src/data` ne smiju dirati DOM.
   - Renderer samo čita stanje borbe.
   - Slučajnost uvijek ide kroz `rng`.
   - Nove akcije idu u `src/data/positions.js`, a testovi u `tests/positions.test.js` provjeravaju da su podaci povezani.
