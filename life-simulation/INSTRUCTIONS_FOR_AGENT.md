# Upute za developera (od QA/PM agenta)

Ovo je kanal između **QA/PM agenta** (piše zadatke, testira) i **developer agenta** (implementira). Oba radimo na grani `dev`.

## Kako komuniciramo

1. Zadaci su ispod, poredani po prioritetu. Radi ih **redom, sprint po sprint**.
2. Kad završiš zadatak: commit + push na `origin dev`, pa u ovoj datoteci označi `[x]`, upiši hash commita i kratku napomenu u **Dnevnik developera** (na dnu).
3. Pitanja piši u odjeljak **Pitanja za QA/PM**. Odgovaram u istoj datoteci (odjeljak **Odgovori QA/PM**). Ako pitanje nije blokirajuće, nastavi s razumnom pretpostavkom i zapiši je.
4. Ne briši tuđe unose; samo dopisuj. Moje izmjene ćeš prepoznati po commit porukama `life-simulation: QA ...`.
5. Pravila iz `CLAUDE.md` i `PROGRESS.md` i dalje vrijede: engine ostaje deterministički (replay mora biti identičan), botovi i ljudi koriste isto sučelje, sadržaj je JSON u `packages/content`, nakon svake promjene `npm run check` + `npm run e2e` i novi odjeljak u `PROGRESS.md`.
6. **Odbačeni smjerovi (ne vraćati):** sandbox s upravljanjem figuricom, Among Us s tajnim saboterima, „svatko ima tajni cilj protiv nekoga”, dug život kao glavni cilj, lica nalik South Parku.

Podloga (mjerenja i istraživanje): [`docs/reports/qa-research-2026-11-27.md`](docs/reports/qa-research-2026-11-27.md).

## Dijagnoza u 4 rečenice

Vlasnik je javio: (1) monotono, (2) premalo vremena za odgovor, (3) smicalice prejednostavne, (4) i dalje izgleda kao kartice. QA mjerenje pokazuje da je **74 % eventa solo** i da **svaki lik u svakoj sesiji dobije istih 7 svakodnevnih eventa** — zato je monotono i zato drugi igrači ne utječu na tvoj život. Rokovi se računaju u vremenu sesije, pa ih `TIME_SCALE` skraćuje (uz 6× ostane 2–3 s), a i na 1× su na granici za tekst od 50–90 riječi. Mapa ne nosi informaciju: sve bitno je u tekstu, a kartica prekriva pola grada.

---

## Sprint 1 — tempo i raznolikost (najveći učinak, najmanji trud)

### [x] T1. Rok za odluku u stvarnim sekundama, prema duljini teksta
- Rok za **ljudskog igrača** računaj u stvarnim (wall-clock) sekundama, neovisno o `TIME_SCALE`. Npr. u `LiveSession` pomnoži rok s `timeScale` prije nego ga daš engineu, ili engineu daj rok već preračunat.
- Duljina roka: `8 s + 0,25 s po riječi` (javni + privatni tekst + izbori), ograničeno na **15–35 s**; **+10 s** ako odlučuje više ljudi.
- Kad svi ljudi u eventu odluče, event se odmah razrješava (provjeri da tako radi i kad su u eventu 2 čovjeka).
- Botovi i `npm run sim` ostaju kakvi jesu (ne smiju usporiti batch).
- **Prihvaćeno kad:** uz `TIME_SCALE=6` obični event na ekranu počinje s ≥ 15 s, važni s ≥ 25 s; uz `TIME_SCALE=1` isto. Test u `server` to provjerava.

### [x] T2. Manje istih solo eventa, više eventa s drugim ljudima
- Cilj: **≥ 55 % eventa koje lik dobije uključuje još nekoga tko odlučuje** (sada 26 %).
- Spusti težinu 7 „obaveznih” solo eventa (`career_overtime`, `everyday_side_gig`, `career_annual_review`, `everyday_missed_bus`, `everyday_parking_scratch`, `everyday_wrong_change`, `financial_tax_error`) tako da lik u sesiji dobije **najviše 3 od njih**, i nijedan solo event ne smije doći dvaput.
- Bar 4 od tih 7 prepravi u eventa s 2 uloge, gdje drugi lik odlučuje o tebi. Primjeri:
  - Missed Bus → kolega koji prolazi autom odluči hoće li te povesti ili se praviti da te ne vidi;
  - Scratch in the Car Park → auto koji si ogrebao je od drugog lika, koji kasnije vidi ili ne vidi poruku;
  - Too Much Change → blagajnik je drugi lik koji odluči hoće li prijaviti manjak;
  - Annual Review → šef ili kolega iz iste zgrade daje mišljenje o tebi.
- Neka direktor više voli likove koji **već imaju odnos** (prijatelj, kolega, dužnik, suparnik): lanci odnosa trebaju biti srž igre.
- **Prihvaćeno kad:** batch od 200 sesija pokazuje ≥ 55 % eventa s ≥ 2 lika koji odlučuju, ponavljanje predloška ≤ 5 %, smrtnost 3–8 %. Novi izvještaj spremi u `docs/reports/`. Dodaj tu metriku u batch izvještaj.

### [x] T3. Krivulja napetosti (storyteller) i finale
- Sesiju podijeli na faze: **upoznavanje** (prvih ~15 %, lagani eventi koji ljude spajaju), **rast** (lanci i odnosi), **vrhunac** (preokret oko 60–70 %), **predah** (~30 s), **finale** (zadnjih 60–90 s).
- **Finale:** jedan veliki event za **sve žive likove** (npr. gradsko vijeće glasa o nečemu, požar u kvartu, vjenčanje dvoje likova), u kojem se vide posljedice ranijih odnosa.
- Pauza između dva eventa za čovjeka: **8–15 stvarnih sekundi**, a nakon važnog eventa duže (predah). Nikad 20+ s bez ičega.
- **Prihvaćeno kad:** u logu sesije vidi se faza; svaka sesija ima finale; QA mjeri razmak između ponuda u browseru.

### [x] T4. Popravci sučelja (QA bugovi)
- **B1:** Na 1280×800 kartica eventa prekriva pola mape, a 4. izbor je odrezan. Kartica mora biti uža, a svi izbori vidljivi bez skrolanja (desktop 1280×800 i iPhone 13). Dodaj provjeru u e2e.
- **B2:** Popis „People” kasni jedan event (nakon zajedničkog eventa lik ostaje „Stranger” do sljedeće poruke). Vjerojatni uzrok: prikaz lika u poruci ishoda radi se prije `relations.meet`. Prvo potvrdi uzrok, pa popravi; dodaj test.
- **B3:** Feed „Around town” prikazuje dosadne solo evente drugih. Prikazuj samo evente s više ljudi, preokrete, smrti, odlaske u bolnicu/zatvor i finale.
- **B4:** U tekstu se kao ime lika koristi korisničko ime (`qa51194`). U lobbyju ponudi ime lika (s nasumičnim prijedlogom).

**Kad završiš Sprint 1, javi u dnevniku — QA ga testira prije Sprinta 2.**

---

## Sprint 2 — grad nosi priču, smicalice postaju spletke

### [x] T4b. Sitnice iz QA Sprinta 1 (napravi prvo)
- **N1:** U finalu je tekst „Only you know” odrezan (vidi se jedan red, ostatak se skrola unutar kartice). Privatna informacija je najvažniji dio eventa — mora biti cijela vidljiva. Ako ne stane, skraćuj javni tekst, ne privatni.
- **N2:** Kartica eventa prekriva baš mjesto eventa (finale na tržnici: tržnica i svi likovi su ispod kartice, na mapi se ne vidi nitko). Kartica neka ide na stranu mape suprotnu od mjesta eventa. (Konačno rješenje je T5, ali ovo je brz popravak.)
- **N3:** Sat sesije pokazuje „8:09 / 8:00” tijekom finala. Umjesto toga prikaži „Finale”.
- **N4:** Popis imena u tekstu: „Filip and Clara and Ana and Lana and Maja” → „Filip, Clara, Ana, Lana and Maja”.

### [x] T5. Event počinje na mapi, ne u kartici
- Kad event krene: mjesto na mapi pulsira, sudionici hodaju s „!”, a kartica se otvori tek kad stignu (`offerAt` već postoji) i to **uz mjesto eventa**, mala, ne preko pola mape.
- Na mobitelu kartica ostaje ispod mape, ali mapa se pomakne/zumira na mjesto eventa.
- Nakon odluke: **istovremeno otkrivanje** svih izbora (sve karte se okrenu odjednom) i 2 s reakcije likova na mapi (lice, skok, ljutnja) prije nego se pokaže tekst ishoda.

### [x] T5b. Sitnice iz QA T5 (napravi uz Sprint 2)
- **R1:** Dvostruki navodnici u otkrivanju izbora: `""Go to the bathroom" and never come back"`. Ako oznaka već počinje navodnikom, ne dodaj nove (ili koristi drugi stil).
- **R2:** Reakcije na mapi se ne vide jer sudionici **odu s mjesta eventa prije otkrivanja**. Kod „Who Pays?” su Iris, Luka i Clara već hodali na druge strane dok su se kartice okretale. Sudionici trebaju ostati na mjestu dok traju otkrivanje, reakcija i tekst ishoda (ili barem 3 s), tek onda nastaviti rutinu.
- **R3:** U prvih nekoliko sekundi sesije (prije prve poruke) zaglavlje nema godišnje doba, dob ni atribute, a „People” prikazuje sve kao „Stranger”. Luka je kasnije bez ikakvog zajedničkog eventa postao „Partner”, što je vjerojatno početni odnos iz seeda koji se ne vidi dok ne stigne prvi `view`. Snapshot u `game:started` treba odmah nositi atribute, kalendar i odnose. Prvo potvrdi uzrok.

### [x] T6. Raspoloženje i odnosi vidljivi na mapi
- Iznad svakog lika emoji raspoloženja (sretan, ljut, tužan, zaljubljen, u dugovima…), izveden iz zadnjih promjena atributa i odnosa.
- Linije odnosa od tvog lika prema drugima: prijatelj (zeleno), suparnik (crveno), dužnik/vjerovnik (žuto), partner (roza). Prikazuju se kad prijeđeš mišem/dodirneš lika ili kad ste zajedno u eventu.
- Uz ime lika jedna osobina iz osobnosti bota/karijere („Gossip”, „Cheapskate”, „Hero complex”), da igrač može „čitati” likove.

### [x] T6b. Sitnice iz QA T6
- **M1:** Na mapi su skoro svi tužni (u 3:00 četiri od šest likova 😢, i Igor nakon neutralnog „You drive on.”). Grad izgleda depresivno, a ton treba biti humorističan. Provjeri raspodjelu raspoloženja u batchu: 😢 neka bude najviše ~30 % vremena, a neutralan ishod ne smije dati tužno lice. Možda dodati „😐/🙂” kao neutralno.
- **M2:** Javni tekst eventa je odrezan usred rečenice („…and asks Marko to”), jer je kartica najviše 38 % mape, a privatni tekst i izbori su uvijek cijeli. Na desktopu ima mjesta: neka kartica smije biti viša (do visine mape), ili smanji razmake/oznake izbora. Javni tekst mora biti cijeli bez skrolanja barem na 1280×800. Dodaj u e2e.
- **M3 (sadržaj):** „The Charity Drive” kao zadani izbor (ako ne odgovoriš) ima „Push hard, mention who else gave”, agresivan izbor. Zadani izbor treba biti pasivan i neutralan. Provjeri sve evente (validator može upozoriti ako default ima tag `risk`, `lie` ili cilja drugog lika negativno).

### [x] T6c. Gramatika kod uloga s više ljudi (sitno)
- „Maja and Ema **is** a few metres away” (The Robbery). Kad uloga ima 2+ člana, glagol mora biti u množini. Najjednostavnije: u predlošku teksta podrži oblik poput `{witness|is|are}` ili prepiši rečenice tako da ne ovise o broju („…, a few metres away.”). Provjeri sve evente s višečlanim ulogama (card-fit skripta već iscrtava sve kombinacije, može usput tražiti „and X is”).

### [x] T7. Trajni tragovi na mapi
- Posljedice ostaju vidljive: ispuhane gume na autu, zavoj na liku, natpis „FOR SALE” na kući, zatvoren dućan, cvijeće na grobu, lisice/rešetke kod policije. **Najmanje 6 vrsta.**
- Efekt u formatu eventa (npr. `{ type: "mark", ... }`) + validator + render.

### [x] T7b. Više veza, dugova i partnera (prijedlog developera, prihvaćen)
- Eventi koji stvaraju partnere, dugove i usluge ranije u sesiji (faza upoznavanja), da Jealousy, Crisis Talk, Loan Due i finale imaju na čemu raditi.
- **Prihvaćeno kad:** batch pokaže da ≥ 50 % likova do finala ima barem jedan „pravi” odnos (partner, prijatelj, suparnik, dug), a Jealousy i Crisis Talk se pojave u ≥ 10 % sesija.

### [x] T8. Smicalica postaje spletka u 3 koraka (vlasnikova točka 3)
1. **Plan:** odabir mete i vrste; prikaži **šansu uspjeha** i **rizik otkrivanja** (ovise o karijeri, odnosu s metom, mjestu).
2. **Priprema (1–2 godine u igri):** krug napretka iznad tvog lika (vidiš samo ti). Tijekom pripreme možeš jednom pojačati spletku: nagovoriti suučesnika (skriveni event drugom liku: pristati / odbiti / izdati te), pričekati pravo mjesto (meta je na poslu → gume) ili zamesti tragove.
3. **Izvršenje:** meta dobije event; ako rizik „pogodi”, meta dobije trag („Vidio si Kim kraj svog auta”) i izbor: suočiti se, prijaviti ili **planirati osvetu** (osveta je besplatna dodatna smicalica protiv krivca).
- Otkrivena spletka postaje **tajna** koju žrtva kasnije može iskoristiti (poseban izbor u budućem eventu s krivcem).
- Dodaj 2–3 nove smicalice vezane uz karijere (npr. novinar objavi lažnu vijest, mehaničar „popravi” auto, odvjetnik pošalje lažnu tužbu).
- Botovi koriste isto (prema osobnosti). Life Recap prikazuje cijeli tok spletke.

### [x] T8b. Sitnice iz QA T8
- **S1:** Nakon što spletka završi, ispod gumba stalno piše „Not possible: they already had this one”, a odabrana je ista spletka, pa je gumb siv. Igrač ne zna što napraviti. Nakon spletke automatski odaberi drugu dostupnu vrstu (ili drugu metu), a poruku promijeni u „Kim already got this one, pick another scheme.” Već iskorištene vrste za tu metu prikaži prekrižene ili sive.
- **S2:** QA nije mogao vidjeti **stranu žrtve** (trag „You noticed: …” i izbor osvete), jer to ovisi o tome hoće li bot slučajno odabrati čovjeka i biti otkriven. Dodaj u `npm run e2e` (ili kao opciju za QA, npr. env `QA_FORCE_SCHEME_ON_HUMAN=1`) scenarij u kojem bot izvede spletku na čovjeka i bude otkriven. E2E neka provjeri da se pojave trag, tri izbora i besplatna osveta u kartici „Schemes”.

### [x] T9. Kad čekaš, imaš što raditi
- Dok nisi u eventu, možeš **pogađati** što će odlučiti drugi u tekućem eventu („Što će Greta napraviti?”). Točni pogoci se broje i nagrađuju u recapu (titula „Town Oracle”).
- Klik na lika na mapi → mala kartica: tko je, osobina, odnos s tobom, što trenutno radi.

---

### [x] T9b. Sitnica iz QA T9
- **P1:** Kad 3+ lika stoje zajedno (npr. ispred The Last Call), imena i emojiji se preklapaju („G Luka”) i ne mogu se pročitati. Raširi oznake lepezasto ili pomakni likove malo jedne od drugih kad stoje na istom mjestu.

### [ ] T8c. Sitnice sa strane žrtve (QA uz `QA_FORCE_SCHEME_ON_HUMAN=1`)
- **V1:** Kartica „Flat Tyres” s tragom ima 5 izbora i na 1280×800 donji red („If time runs out: …”) je odrezan. `card-fit.mjs` vjerojatno ne iscrtava kombinaciju „trag + svi izbori žrtve”; dodaj je i popravi.
- **V2:** Kad žrtva već ima trag („Your neighbour's camera shows Lea…”), izbor „Check the neighbour's doorbell camera” nema smisla. Sakrij ga kad je krivac otkriven, ili ga promijeni u nešto drugo.

---

## Sprint 3 — razlog za još jednu partiju

### [ ] T10. Osobni ciljevi za sesiju
- Svaki igrač na početku dobije **2 osobna cilja** iz popisa od ~20. Ciljevi su **o tvom životu, ne protiv nekoga** i ne o dugom životu. Primjeri: „Zaradi da ti 2 osobe duguju novac”, „Napreduj na poslu prije 25.”, „Pretvori stranca u najboljeg prijatelja”, „Prođi preokret bez ičije pomoći”, „Izvedi spletku i ne budi otkriven”.
- Vidljivi u zaglavlju, a u recapu ✓/✗. Nema pobjednika.

### [ ] T11. Titula života i „Copy my life”
- Na kraju svaki lik dobije **titulu** izračunatu iz povijesti („The Town Snitch”, „Bailed Everyone Out, Died Broke”, „Never Caught”). Bar 15 titula.
- Recap počinje **otkrivanjem jedno po jedno**: „Tko ti je ispuhao gume 2031.?” → pauza → lice krivca.
- Gumb **„Copy my life”**: niz emojija po godinama + titula, bez spoilera, za dijeljenje.
- Kolekcija titula u lobbyju (spremljena u bazi uz korisnika).

### [ ] T12. Duh nakon smrti
- Mrtav ili zatvoren igrač postaje duh: može jednom po desetljeću „gurnuti” jedan event (+10 % jednom ishodu), glasati za „Trač godine” i ostaviti **oporuku** od jedne rečenice (iz ponuđenih) koja se pročita u recapu.

---

## Pitanja za QA/PM

_(developer piše ovdje)_

## Odgovori QA/PM

- **27. 11. 2026. — QA Sprinta 2: ✅ prihvaćeno, kreni na Sprint 3** (prvo sitnice T8b i T9b).
  - `npm run check` 138/138, 75 eventa, 0 upozorenja; `npm run e2e`: desktop + iPhone 13, 125 kartica bez skrolanja na oba ekrana, 0 gramatičkih grešaka.
  - Igranje uz 3× (cijela sesija, 9 eventa): spletka „tyres” na Leu s „Cover your tracks” uspjela; Luka je meni ispuhao gume, što je otkriveno u recapu; „Meanwhile” pogađanje radi (Town Oracle 10/24 u recapu); vjenčanje kao finale; na mapi se vide auto s ispuhanim gumama i grob s cvijećem.
  - Klik na lika na mapi QA skripta nije uspjela pogoditi (klikovi na slučajne točke) pa kartica osobe nije vizualno provjerena. Ako imaš e2e za nju, napiši u dnevnik.

- **27. 11. 2026. — QA Sprinta 1: ✅ prihvaćeno, kreni na Sprint 2.**
  - Provjereno: `npm run check` 114/114, 70 eventa bez grešaka, `npm run e2e` desktop + iPhone 13 prolazi.
  - Igranje u browseru uz `TIME_SCALE=6` (kako je igrao vlasnik), cijela sesija: 6 eventa, rokovi 17–26 s (prije 2–3 s), **svih 6 s drugim ljudima** (prije 3 od 9), razmak između ponuda ~10 s, finale „Fire on Market Street” za sve. Odnosi se vide odmah (Friend, Acquaintance). Ime lika radi.
  - Slažem se s tvojim objašnjenjem razlike 26 % vs 47 % (različite mjere) — u redu je da izvještaj ima obje.
  - Slažem se s prijedlogom o vezama: dodao sam ga kao **T7b** u Sprint 2.
  - Novi nalazi (dodani kao **T4b**, napravi ih prvo, mali su).

## Dnevnik developera

_(developer piše ovdje: datum, zadatak, commit, napomena)_

- **27. 11. 2026. — T1 gotov** (`f34eebe`). Rok za čovjeka je u stvarnim sekundama: `8 + 0,25 × riječi`, 15–35 s (važni ≥ 25 s), +10 s za više ljudi; ne ovisi o `TIME_SCALE`. Kad svi ljudi odluče, botovi koji još „razmišljaju” odgovore odmah. Botovi i `sim` nepromijenjeni (test uspoređuje). Testovi: `engine/test/pacing.test.ts`, `server/test/pacing.test.ts`. Za ručni test: `TIME_SCALE=6 FILL_AFTER_SECONDS=2 npm run start`. Pretpostavka: „riječi” = javni + privatni tekst za tvoju ulogu + oznake izbora koje vidiš.
- **27. 11. 2026. — T2 gotov** (`c9beede`). Batch 200 sesija (`docs/reports/t2.report.md`): **73,2 %** eventa lika uključuje još nekoga tko odlučuje (bilo 47,4 % po istoj mjeri), **57,4 %** eventa ima ≥ 2 lika koji odlučuju (bilo 30,3 %), ponavljanje predloška 1,3 %, smrtnost 4,0 %, 0 ponovljenih solo eventa. Missed Bus, Car Park Scratch, Too Much Change i Annual Review prepravljeni u evente s 2 uloge; Overtime/Side Gig/Tax Refund najviše jednom po liku; eventi s više ljudi `maxPerSession: 3`. Direktor ×3 za ljude s pravim odnosom (uklj. dug/uslugu/tajnu). Napomena: QA-ova brojka 26 % brojala je pojavljivanja drugačije; izvještaj sada ima obje mjere. Pragovi odnosa spušteni (prijatelj ≥ 25, suparnik ≤ −15) jer inače nema dovoljno odnosa za lance; pravih odnosa u zajedničkim eventima je i dalje samo ~30 %, a Jealousy/Crisis Talk ostaju rijetki (traže partnera) — prijedlog za kasnije: više eventa koji stvaraju partnere i dugove.
- **27. 11. 2026. — T3 gotov** (`3a4a63d`). Faze upoznavanje → rast → vrhunac (preokret na 62–70 %) → predah → finale; u logu `STORY: … phase` i `[faza]` uz svaki event. Finale (`trigger: "finale"`): požar na tržnici, vjenčanje u parku ili zadnji gradski sastanak, za **sve žive**; izbori ovise o ranijim odnosima (dug, spašen život, suparnik, tajna). Sve sesije u batchu završe finalom. Pauza za čovjeka (engine mjerenje, 10 sesija): medijan 12 s uz 1× i 9 s uz 6×, iznad 20 s ~1 %. **Napomena za QA mjerenje u browseru:** prije finala čovjek čeka dok ostali ne završe svoje evente (ako je u tom trenutku drugi čovjek u eventu, to može biti do njegovog roka); botovi u tom trenutku odgovore odmah. Kad je T2 metrika s fazama pala na 54 %, ograničio sam Overtime/Side Gig/Tax Refund na 3 po sesiji → sada 64,4 %.
- **27. 11. 2026. — T4 gotov** (`d3aa236`).
  - **B1:** kartica 300 px (najviše 38 % mape; ekran igre širi pa je mapa 856×571); izbori su uvijek cijeli vidljivi, a samo tekst priče se skrola ako je baš dug. Na mobitelu je kartica fiksni sheet na dnu ekrana. `npm run e2e` za svaki event provjerava da su svi izbori na ekranu i da se kartica ne skrola.
  - **B2:** uzrok nije bio `relations.meet` (engine ga radi prije poruka), nego klijent: odnose je osvježavao samo iz nove ponude. Poruka ishoda sada nosi `others`. Test je padao prije popravka.
  - **B3:** u feedu su samo eventi s ≥ 2 osobe, početak preokreta, smrti, bolnica/zatvor i najava finala.
  - **B4:** polje „Your character's name” u lobbyju (🎲 nasumični prijedlog); server validira ime; botovi nikad ne dobiju isto ime.

**✅ Sprint 1 (T1–T4) je gotov i spreman za QA test.** Provjereno na svježem `git clone` grane `dev`: `npm install`, `npm run check` (114/114), `web:build`, server; `npm run e2e` (desktop i iPhone 13). Za ručno igranje: `cd life-simulation && npm install && TIME_SCALE=6 FILL_AFTER_SECONDS=2 npm run start` → http://localhost:3000. Detalji svakog zadatka su u `PROGRESS.md`. Čekam povratnu informaciju prije Sprinta 2.
- **27. 11. 2026. — T4b gotov** (`7d30a94`). N1: u kartici se skrola samo javni tekst, „Only you know” je uvijek cijeli (e2e provjerava). N2: kartica na suprotnoj strani od mjesta eventa. N3: „Finale” na satu. N4: „Filip, Clara, Ana, Lana and Maja”. Provjereno u browseru na finalu (desktop + iPhone 13). Sljedeće: T5, pa ostatak Sprinta 2 i T7b.
- **27. 11. 2026. — T5 gotov** (`09da472`). Najava eventa (`coming`): mjesto pulsira, sudionici hodaju s „!”, natpis „… everyone is on the way”. Kartica se otvori kad svi stignu, 2,2 polja od mjesta eventa (sudionici ostaju vidljivi). Mobitel: zum 1,9× na mjesto + skrol na mapu. Nakon odluke 2,2 s: sve kartice se okrenu odjednom (skriveni izbori „🤐 kept it to themselves”) i likovi reagiraju na mapi (radost/ljutnja/tuga/šok), pa tek onda tekst ishoda. **Za QA:** reakcije se lako vide uz `TIME_SCALE=2`; uz 6× sve je brže.
- **27. 11. 2026. — T6 gotov** (`e5a6f57`). Emoji raspoloženja iznad imena (😄 😠 😢 😱 😍 💸 🤒 😩), mijenja se nakon eventa i preokreta. Linije odnosa kad prijeđeš mišem/dodirneš lika (preko sebe: do svih), i do sudionika tvog eventa: prijatelj zeleno, suparnik crveno, novac žuto isprekidano, partner roza (+ obitelj ljubičasto, kolega plavo). Osobina uz ime: botovi iz osobnosti (21 oznaka), ljudi iz karijere; u „People” i u imenu na mapi pri prelasku mišem.
- **27. 11. 2026. — T5b gotov** (`d51e4d9`). R1: bez dvostrukih navodnika (`quoted()`). R2: sudionici eventa s čovjekom ostaju na mjestu 5 s nakon razrješenja (otkrivanje + reakcije + početak ishoda), pa tek onda idu dalje. R3: uzrok potvrđen — klijent je stanje uzimao samo iz zadnje ponude; snapshot sada nosi `me` (atributi, kalendar, dob, odnosi), pa je zaglavlje puno i početni partner/kolega vidljiv od prve sekunde (e2e provjerava). Sljedeće: T6b.
- **27. 11. 2026. — T6b gotov** (`4859ae3`).
  - **M1:** batch sada mjeri raspoloženja. Bilo je 40 % vremena tužno (neutralan ishod nije mijenjao staro raspoloženje, a već −5 je davalo tugu). Sada neutralan ishod vraća mir (🙂 na mapi), tuga od −8, radost od +6 → mir 62 %, sreća 13 %, tuga 12 % (`docs/reports/t6b.report.md`).
  - **M2:** nova provjera `packages/web/e2e/card-fit.mjs` u `npm run e2e` iscrta karticu **svih 109 kombinacija event/uloga** (duga imena, najviše izbora) na 1280×800 i 390×664: bilo je 61 skrolanje, sada 0. Kartica na desktopu smije ispod mape, 340 px, zbijenija; „With” se ne prikazuje u kartici; skraćen javni tekst u 11 eventa (privatni nije diran).
  - **M3:** validator upozorava na zadani izbor s `risk`/`lie`/`threaten`; ispravljeno 17 uloga (Charity Drive sada „Hand in every cent”). Pasivno odbijanje ostaje dopušteno.
  - Smrtnost je pala na 3,0 % (sigurniji zadani izbori) — na donjoj granici.
- **27. 11. 2026. — T7 gotov** (`c69794c`). Efekt `mark` (+ validator, dokumentacija) i 8 vrsta tragova: zavoj, lisice (na liku); ispuhane gume, FOR SALE, cvijeće na grobu, srca (vjenčanje), razbijeni prozor (kod kuće); CLOSED (na poslu). Smrt/zatvor/bolnica ostave trag automatski. Tragovi su u 12 eventa; oni s vremenom nestaju sami. Za QA: najlakše se vide ispuhane gume (smicalica „Let their tyres down”), FOR SALE nakon „Panic Sale” i zavoj nakon nesreće/ozljede. Batch t7: smrtnost 5,3 %, replay identičan.
- **27. 11. 2026. — T7b gotov** (`2600a33`). Batch 200 sesija (`docs/reports/t7b.report.md`, potvrđeno i na drugom seedu): **88 %** likova ima stvarnu vezu prije finala, **Jealousy 19 %**, **Crisis Talk 12,5 %** sesija (prije 0 % i 1 %). Kako: priče kao nastavci (First Date → Jealousy → Crisis Talk, kriza i nakon zaboravljene godišnjice/sumnje), sumnja ostaje i nakon „vjernog” ishoda, direktor **rezervira** sudionike nastavka dok se ostali ne oslobode, eventi koji stvaraju veze ×2 u ranim fazama, početni par u 40 % sesija. Batch izvještaj ima nove retke „Real ties” i „Relationship events”. Sljedeće: T6c, pa T8.
- **27. 11. 2026. — T6c gotov** (`de93b0f`). `{witness} {witness|is|are} a few metres away` → „Maja and Ema are …”. Validator upozorava na „{višečlana uloga} is/has/was/does” (našao 4 teksta, ispravljeni); `card-fit.mjs` u `npm run e2e` traži „X and Y is” u svim popunjenim tekstovima: 0. Sljedeće: T8 (spletke).
- **27. 11. 2026. — T8 gotov** (`e888b5b` engine, `ba1f259` sučelje).
  - **Plan:** kartica „Schemes”: meta + spletka → odmah „75 % it works · 25 % they find out” (ovisi o spletki, karijeri, odnosu s metom, istom poslu).
  - **Priprema** 30–60 s vremena sesije (1–2 godine): traka + krug iznad tvog lika; jedno pojačanje: „Cover your tracks” (rizik ×0,5), „Wait for the right moment” (+15 %), „Ask for help” (suučesnik dobije skriveni event: pomoći +25 % / odbiti / pristati pa upozoriti metu).
  - **Izvršenje:** ako te uhvate, žrtva u kartici vidi „You noticed: …” i izbore suočiti se / prijaviti / **osveta** (besplatna spletka protiv tebe). Otkrivena tajna kasnije daje izbor „Remind X what you know” u 4 eventa.
  - 3 spletke karijere (novinar, mehaničar, odvjetnik); botovi isto; Life Recap priča cijeli tok.
  - Batch: 4,3 spletke po sesiji, 68 % uspije, 27 % otkriveno; replay identičan. **Za QA:** uz `TIME_SCALE=6` priprema traje 5–10 s; da vidiš stranu žrtve, najlakše je da te bot pogodi — botovi planiraju nakon svojih eventa.
- **27. 11. 2026. — T9 gotov** (`91cfc6d`). Kartica „Meanwhile” ispod mape: kad netko drugi odlučuje, „What will Greta do?” s njezinim izborima; jedan pogodak po eventu, pa „✓ Right!” / „✗ … chose …”; brojač „Town Oracle 3/5”, u Life Recapu „🔮 Town Oracle” od 3 pogotka. Klik na lika na mapi: kartica s imenom, karijerom, osobinom, odnosom (i dugom), raspoloženjem i što radi („Busy: …”, „On the way to …”).

**✅ Sprint 2 (T5–T9, plus T4b, T5b, T6b, T6c, T7b) je gotov i spreman za QA test.** Provjereno na svježem `git clone` (`npm install`, `npm run check` 138/138, `web:build`, server) i `npm run e2e` (desktop + iPhone 13, 125 kartica bez skrolanja). Batch 200 sesija: `docs/reports/sprint2.report.md`. Ručno: `cd life-simulation && npm install && TIME_SCALE=3 FILL_AFTER_SECONDS=2 npm run start` → http://localhost:3000 (uz 3× se reakcije, spletke i pogađanje dobro vide). Čekam povratnu informaciju prije Sprinta 3.
- **27. 11. 2026. — T8b gotov** (`6a6db06`). S1: nakon spletke odabir se sam pomakne na još moguću spletku, iskorištene su prekrižene, poruka „Kim already got this one, pick another scheme.” S2: `QA_FORCE_SCHEME_ON_HUMAN=1 TIME_SCALE=6 FILL_AFTER_SECONDS=2 npm run start` → bot nakon 2 s planira „Let their tyres down” na tebe, a svaka spletka uspije i krivac bude otkriven; za ~10 s dobiješ „Flat Tyres” s tragom „You noticed …”, tri izbora i besplatnu osvetu. Isto provjerava novi `packages/web/e2e/scheme-victim.mjs` u `npm run e2e` (prolazi).
- **27. 11. 2026. — T9b gotov** (`6a3596f`). Likovi koji stoje zajedno crtaju se kao grupa: malo se rašire, imena se slažu prema gore s tankom crtom do glave, emoji je pokraj imena, „!” jednom po grupi. Provjereno na finalu (svih 6 na jednom mjestu, sva imena čitljiva). **Kartica lika ima e2e:** `npm run e2e` klikne drugog lika (pozicije iz atributa `data-people` na canvasu) i provjeri karticu, na desktopu i mobitelu — QA skripta može isto: `JSON.parse(canvas.dataset.people)` daje `{ c2: [x, y] }` u pikselima canvasa. Sljedeće: Sprint 3 (T10–T12).

## Dnevnik QA/PM

- **27. 11. 2026.** — Prvo QA igranje (TIME_SCALE=1, 3 min) i analiza batch izvještaja m10; istraživanje BitLife, Reigns, RimWorld, Jackbox, CK3, Tomodachi Life, Wordle. Napisani Sprintovi 1–3. Detalji u `docs/reports/qa-research-2026-11-27.md`.
- **27. 11. 2026.** — QA Sprinta 1: prihvaćen. Dodani T4b (4 sitnice iz igranja) i T7b (veze i dugovi). Developer može krenuti na Sprint 2.
- **27. 11. 2026.** — QA T4b: ✅ sve 4 sitnice potvrđene u browseru (6×): „Finale” na satu, „Only you know” cijeli, kartica s druge strane od mjesta eventa (likovi vidljivi), „Olga, Rosa and Klara”. Rokovi 17–25 s. Nastavi sa Sprintom 2.
- **27. 11. 2026.** — QA T5: ✅ prihvaćeno uz sitnice **T5b**. `npm run check` 119/119. Igranje uz 2×: najava radi (pulsira MegaMart, „everyone is on the way”), kartica se otvara kraj mjesta, sve odluke se otkrivaju odjednom, rokovi 16–21 s, 5 od 6 eventa s drugim ljudima. Problemi: reakcije se ne vide jer likovi odlaze prerano (R2), dvostruki navodnici (R1), prazno zaglavlje i krivi odnosi na početku (R3).
- **27. 11. 2026.** — QA T6: ✅ prihvaćeno uz **T6b**. `npm run check` 122/122. Emoji iznad glava, osobine u „People” i legenda linija rade; 7 eventa u 110 s uz 3×. Problemi: skoro svi su tužni (M1), javni tekst odrezan usred rečenice (M2), agresivan zadani izbor u Charity Drive (M3).
- **27. 11. 2026.** — QA T5b: ✅ sve tri potvrđene (2×, `npm run check` 124/124). Zaglavlje i odnosi puni od 0:06 (Greta „Colleague” od početka); Greta i Ruby ostaju u baru za vrijeme otkrivanja i reakcije se vide; nema dvostrukih navodnika. Sljedeće: T6b, pa T7.
- **27. 11. 2026.** — QA T6b: ✅ prihvaćeno. `npm run check` 126/126, 0 upozorenja validatora. Igranje uz 3×: 7 eventa, kartica uvijek cijela bez skrolanja, likovi uglavnom 🙂, zadani izbor u The Robbery je „Let go of the bag”. Smrtnost 3,0 % je u redu (donja granica), ne treba dirati. Nova sitnica **T6c** (gramatika „Maja and Ema is”). Sljedeće: T7.
- **27. 11. 2026.** — QA T7: ✅ prihvaćeno. `npm run check` 129/129. U igri (3×) se vide auto s ispuhanim gumama („pfff”) kraj moje kuće nakon „Flat Tyres” i razbijen prozor na drugoj kući; ishod je duhovit („Your step count is excellent.”). Tragovi su mali, ali čitljivi. Sljedeće: T6c (sitno), T7b, T8.
- **27. 11. 2026.** — QA T7b i T6c: ✅ prihvaćeno. `npm run check` 132/132. Vlastiti batch (100 sesija, seed `qa7b`) potvrđuje brojke: veze prije finala 88,3 %, Jealousy 13 %, Crisis Talk 11 %, Loan Due 29 %, eventi s drugima 79,4 %, ponavljanje 1,1 %, smrtnost 4,7 %, tuga 12,7 % vremena; replay 3/3 identičan. Sljedeće: T8 (spletke) — najvažniji preostali zadatak (vlasnikova točka 3).
- **27. 11. 2026.** — QA T8: ✅ prihvaćeno uz **T8b**. `npm run check` 136/136, 75 eventa. Cijeli tok s nove QA skripte (6×): 5 vrsta spletki (uključujući „Send a fake lawsuit” za odvjetnika), izgledi se mijenjaju s vrstom (75/20 → 80/25 %), plan → traka pripreme → „Cover your tracks” (rizik 25 → 13 %) → „it worked, and nobody saw a thing” za ~30 s; žrtva Kim dobila je „Flat Tyres”, a Life Recap pod „Secrets revealed” priča cijeli tok. Vlasnikova točka 3 je riješena. Problemi: zbunjujuća poruka nakon spletke (S1), strana žrtve nije provjerljiva u QA (S2).
- **27. 11. 2026.** — QA Sprinta 2: ✅ prihvaćen (detalji u „Odgovori QA/PM”). Dodana sitnica **T9b** (preklapanje imena). Developer kreće na Sprint 3 (T8b, T9b, pa T10–T12).
- **27. 11. 2026.** — QA T8b i T9b: ✅ prihvaćeno. `npm run check` 139/139; `npm run e2e` prolazi sve (igra, strana žrtve, kartica lika, 125 kartica, gramatika). Ručno uz `QA_FORCE_SCHEME_ON_HUMAN=1`: „You noticed: … Lea crouching by your car”, izbori suočiti se / prijaviti / osveta rade. Dvije sitnice: **T8c** (odrezan donji red kartice, suvišan izbor „Check the camera”).
