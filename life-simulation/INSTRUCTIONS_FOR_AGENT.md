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

### [ ] T1. Rok za odluku u stvarnim sekundama, prema duljini teksta
- Rok za **ljudskog igrača** računaj u stvarnim (wall-clock) sekundama, neovisno o `TIME_SCALE`. Npr. u `LiveSession` pomnoži rok s `timeScale` prije nego ga daš engineu, ili engineu daj rok već preračunat.
- Duljina roka: `8 s + 0,25 s po riječi` (javni + privatni tekst + izbori), ograničeno na **15–35 s**; **+10 s** ako odlučuje više ljudi.
- Kad svi ljudi u eventu odluče, event se odmah razrješava (provjeri da tako radi i kad su u eventu 2 čovjeka).
- Botovi i `npm run sim` ostaju kakvi jesu (ne smiju usporiti batch).
- **Prihvaćeno kad:** uz `TIME_SCALE=6` obični event na ekranu počinje s ≥ 15 s, važni s ≥ 25 s; uz `TIME_SCALE=1` isto. Test u `server` to provjerava.

### [ ] T2. Manje istih solo eventa, više eventa s drugim ljudima
- Cilj: **≥ 55 % eventa koje lik dobije uključuje još nekoga tko odlučuje** (sada 26 %).
- Spusti težinu 7 „obaveznih” solo eventa (`career_overtime`, `everyday_side_gig`, `career_annual_review`, `everyday_missed_bus`, `everyday_parking_scratch`, `everyday_wrong_change`, `financial_tax_error`) tako da lik u sesiji dobije **najviše 3 od njih**, i nijedan solo event ne smije doći dvaput.
- Bar 4 od tih 7 prepravi u eventa s 2 uloge, gdje drugi lik odlučuje o tebi. Primjeri:
  - Missed Bus → kolega koji prolazi autom odluči hoće li te povesti ili se praviti da te ne vidi;
  - Scratch in the Car Park → auto koji si ogrebao je od drugog lika, koji kasnije vidi ili ne vidi poruku;
  - Too Much Change → blagajnik je drugi lik koji odluči hoće li prijaviti manjak;
  - Annual Review → šef ili kolega iz iste zgrade daje mišljenje o tebi.
- Neka direktor više voli likove koji **već imaju odnos** (prijatelj, kolega, dužnik, suparnik): lanci odnosa trebaju biti srž igre.
- **Prihvaćeno kad:** batch od 200 sesija pokazuje ≥ 55 % eventa s ≥ 2 lika koji odlučuju, ponavljanje predloška ≤ 5 %, smrtnost 3–8 %. Novi izvještaj spremi u `docs/reports/`. Dodaj tu metriku u batch izvještaj.

### [ ] T3. Krivulja napetosti (storyteller) i finale
- Sesiju podijeli na faze: **upoznavanje** (prvih ~15 %, lagani eventi koji ljude spajaju), **rast** (lanci i odnosi), **vrhunac** (preokret oko 60–70 %), **predah** (~30 s), **finale** (zadnjih 60–90 s).
- **Finale:** jedan veliki event za **sve žive likove** (npr. gradsko vijeće glasa o nečemu, požar u kvartu, vjenčanje dvoje likova), u kojem se vide posljedice ranijih odnosa.
- Pauza između dva eventa za čovjeka: **8–15 stvarnih sekundi**, a nakon važnog eventa duže (predah). Nikad 20+ s bez ičega.
- **Prihvaćeno kad:** u logu sesije vidi se faza; svaka sesija ima finale; QA mjeri razmak između ponuda u browseru.

### [ ] T4. Popravci sučelja (QA bugovi)
- **B1:** Na 1280×800 kartica eventa prekriva pola mape, a 4. izbor je odrezan. Kartica mora biti uža, a svi izbori vidljivi bez skrolanja (desktop 1280×800 i iPhone 13). Dodaj provjeru u e2e.
- **B2:** Popis „People” kasni jedan event (nakon zajedničkog eventa lik ostaje „Stranger” do sljedeće poruke). Vjerojatni uzrok: prikaz lika u poruci ishoda radi se prije `relations.meet`. Prvo potvrdi uzrok, pa popravi; dodaj test.
- **B3:** Feed „Around town” prikazuje dosadne solo evente drugih. Prikazuj samo evente s više ljudi, preokrete, smrti, odlaske u bolnicu/zatvor i finale.
- **B4:** U tekstu se kao ime lika koristi korisničko ime (`qa51194`). U lobbyju ponudi ime lika (s nasumičnim prijedlogom).

**Kad završiš Sprint 1, javi u dnevniku — QA ga testira prije Sprinta 2.**

---

## Sprint 2 — grad nosi priču, smicalice postaju spletke

### [ ] T5. Event počinje na mapi, ne u kartici
- Kad event krene: mjesto na mapi pulsira, sudionici hodaju s „!”, a kartica se otvori tek kad stignu (`offerAt` već postoji) i to **uz mjesto eventa**, mala, ne preko pola mape.
- Na mobitelu kartica ostaje ispod mape, ali mapa se pomakne/zumira na mjesto eventa.
- Nakon odluke: **istovremeno otkrivanje** svih izbora (sve karte se okrenu odjednom) i 2 s reakcije likova na mapi (lice, skok, ljutnja) prije nego se pokaže tekst ishoda.

### [ ] T6. Raspoloženje i odnosi vidljivi na mapi
- Iznad svakog lika emoji raspoloženja (sretan, ljut, tužan, zaljubljen, u dugovima…), izveden iz zadnjih promjena atributa i odnosa.
- Linije odnosa od tvog lika prema drugima: prijatelj (zeleno), suparnik (crveno), dužnik/vjerovnik (žuto), partner (roza). Prikazuju se kad prijeđeš mišem/dodirneš lika ili kad ste zajedno u eventu.
- Uz ime lika jedna osobina iz osobnosti bota/karijere („Gossip”, „Cheapskate”, „Hero complex”), da igrač može „čitati” likove.

### [ ] T7. Trajni tragovi na mapi
- Posljedice ostaju vidljive: ispuhane gume na autu, zavoj na liku, natpis „FOR SALE” na kući, zatvoren dućan, cvijeće na grobu, lisice/rešetke kod policije. **Najmanje 6 vrsta.**
- Efekt u formatu eventa (npr. `{ type: "mark", ... }`) + validator + render.

### [ ] T8. Smicalica postaje spletka u 3 koraka (vlasnikova točka 3)
1. **Plan:** odabir mete i vrste; prikaži **šansu uspjeha** i **rizik otkrivanja** (ovise o karijeri, odnosu s metom, mjestu).
2. **Priprema (1–2 godine u igri):** krug napretka iznad tvog lika (vidiš samo ti). Tijekom pripreme možeš jednom pojačati spletku: nagovoriti suučesnika (skriveni event drugom liku: pristati / odbiti / izdati te), pričekati pravo mjesto (meta je na poslu → gume) ili zamesti tragove.
3. **Izvršenje:** meta dobije event; ako rizik „pogodi”, meta dobije trag („Vidio si Kim kraj svog auta”) i izbor: suočiti se, prijaviti ili **planirati osvetu** (osveta je besplatna dodatna smicalica protiv krivca).
- Otkrivena spletka postaje **tajna** koju žrtva kasnije može iskoristiti (poseban izbor u budućem eventu s krivcem).
- Dodaj 2–3 nove smicalice vezane uz karijere (npr. novinar objavi lažnu vijest, mehaničar „popravi” auto, odvjetnik pošalje lažnu tužbu).
- Botovi koriste isto (prema osobnosti). Life Recap prikazuje cijeli tok spletke.

### [ ] T9. Kad čekaš, imaš što raditi
- Dok nisi u eventu, možeš **pogađati** što će odlučiti drugi u tekućem eventu („Što će Greta napraviti?”). Točni pogoci se broje i nagrađuju u recapu (titula „Town Oracle”).
- Klik na lika na mapi → mala kartica: tko je, osobina, odnos s tobom, što trenutno radi.

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

_(QA/PM piše ovdje)_

## Dnevnik developera

_(developer piše ovdje: datum, zadatak, commit, napomena)_

## Dnevnik QA/PM

- **27. 11. 2026.** — Prvo QA igranje (TIME_SCALE=1, 3 min) i analiza batch izvještaja m10; istraživanje BitLife, Reigns, RimWorld, Jackbox, CK3, Tomodachi Life, Wordle. Napisani Sprintovi 1–3. Detalji u `docs/reports/qa-research-2026-11-27.md`.
