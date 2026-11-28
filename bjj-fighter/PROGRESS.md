# Napredak projekta bjj-fighter

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Testna verzija je igriva u pregledniku, na računalu i mobitelu:
- treninzi poteza na timer, s animiranim pogledom na dvoranu iz ptičje perspektive
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

### Kartice prema situaciji i osjećaj (savjet) od plavog pojasa
Vlasnik: u zatvorenom gardu se nudila obrana od guillotine kao napad, a u north-southu „North-south”, obrana od kimure i shrimp. Ideja: na niskim razinama nema savjeta, od plavog pojasa igrač dobiva savjet koji potez odabrati, a savjet je precizniji što je igrač bolji (kao podsvijest).
- **Prilika (napad):** krive opcije su samo napadi druge strane iz iste pozicije (npr. kad si gore u zatvorenom gardu: triangle, armbar, scissor sweep). Nikad obrane, bijegovi ni imena pozicija. Ako nema takvih poteza, a znaš barem dva napada, biraš između njih (razlikuju se šansom). Ako znaš samo jedan napad i nema krive opcije, odluke nema i napad se odigra sam (npr. s leđa samo rear naked choke).
- Kriva opcija u prilici objašnjava zašto: „Triangle se ovdje radi odozdo, a ti si gore.” (log), „✘ Triangle ovdje radi protivnik, ne ti.” (poruka).
- **Obrana:** krive opcije su obrane od drugih napada koje protivnik ima iz te pozicije (obrana od guillotine dok te hvata triangle) i tvoji potezi iz te pozicije. Nikad obrana od tvog vlastitog poteza (npr. „Zatvoreni gard” dok si ti gore).
- **Osjećaj:** bijeli pojas nema savjet. Od plavog pojasa kartica ima redak „💭 Osjećaj ti govori: …” i označenu karticu. Savjet pokazuje karticu s najboljom šansom, ali je pouzdan samo dio vremena: plavi 55 %, ljubičasti 70 %, smeđi 82 %, crni 90 %, plus 1,5 postotna boda po prosječnoj razini ponuđenih tehnika iznad 1, najviše 97 %. Kad promaši, pokazuje nasumičnu drugu karticu. Savjet i njegova pouzdanost upisuju se u log.

### Kartice samo s onim što znaš, tri boje, protivnici na turniru po pojasu
Vlasnik: s gotovo svim vještinama na maksimumu muči se tri runde s bijelim pojasom na turniru; u poziciji s leđa nude se obrane; ponuđeno treba biti ono što igrač zna o situaciji u kojoj se nalazi; boje kartica za napad, obranu i sweep.
- **Turnir:** protivnici više ne prate tvoju razinu, nego imaju vještinu tipičnu za tvoj pojas: bijeli oko razine 2, plavi 4, ljubičasti 5,5, smeđi 7, crni 8,5, plus 0,75 po rundi turnira (četvrtfinale, polufinale, finale), a znaju 60–90 % poteza svog pojasa. Simulacija (bijeli pojas, 75 % točnih odabira, 300 borbi po redu): svi bijeli potezi na razini 1 → 29 % pobjeda, razina 3 → 64 %, razina 5 → 89 %, razina 9 → 99 %.
- **Prilika:** kartice su samo tehnike koje znaš za svoju poziciju i ulogu (do 5), bez krivih kartica. Biraš onu s najboljom šansom, a svaka kartica pokazuje tvoju razinu. Ako znaš manje od dvije, odluke nema i potez se odigra sam. Tekst kaže gdje si: „Prilika! Ti si dolje (leđa). Izaberi potez.”
- **Obrana:** ostaje kao prije: točne obrane plus obrane od drugih napada iz te pozicije i tvoji potezi odatle (sve što znaš o toj situaciji).
- **Boje kartica:** napad (crveno: submissioni, prolazi, rušenja, napredovanje gore), sweep (zeleno), obrana (plavo: obrane, bijegovi, gardovi, osnove kretanja).

### Snaga i kondicija
Vlasnik: uz vještinu tehnike u jednadžbu ulaze snaga i kondicija. Odabrano: nove aktivnosti u klubu (teretana i kardio), snaga mijenja šansu, a kondicija je umor.
- **Klub:** odjeljak „Fizička priprema” s teretanom (snaga) i kardiom (kondicija), razine 1–10. Nova igra počinje sa snagom 1 i kondicijom 1. Trening traje 20 s × 2^(razina−1) vremena igre (razina 2: 40 s, razina 10: 2 h 50 min) i ide u vlastitom slotu, usporedno s treningom tehnike. Testni gumb ⚡ +1 radi i ovdje. Stari save dobiva snagu i kondiciju 1.
- **Snaga u borbi:** svaka razina razlike u snazi pomiče šansu svakog napada i obrane za 3 postotna boda (automatski potezi, tvoje prilike i obrane).
- **Kondicija u borbi:** oba borca počinju s energijom 100. Svaki pokušaj troši 2,5 (submission 3,5, a greška još 1), puta (1,25 − 0,05 × kondicija), dakle 1,2× uz kondiciju 1 i 0,75× uz kondiciju 10. Ispod 50 energije borac je umoran: šansa greške mu raste, a napadi i obrane slabe, do 15 postotnih bodova na nuli. Između rundi oporavak 20 + 2 × kondicija. Log javlja „se počinje umarati” i „je iscrpljen”, a semafor ima traku energije (zeleno, žuto ispod 50, crveno ispod 20).
- **Protivnici:** snaga i kondicija prema pojasu (bijeli oko 2, plavi 3,5, ljubičasti 5, smeđi 6, crni 7, ±1). Na turniru +0,5 po rundi, a sparing partneri imaju 1–5. Na semaforu piše snaga i kondicija oba borca, a na početku loga redak „Snaga: … · kondicija: …”.
- Simulacija (bijeli pojas, sve bijele tehnike na razini 4, turnir, 300 borbi): snaga i kondicija 1 → 60 % pobjeda, umoran u 74 % borbi; 3/3 → 78 %; 6/6 → 96 %; snaga 3 i kondicija 8 → 85 %; snaga 8 i kondicija 3 → 97 %.

### Grafika, korak 1: HUD borbe i efekti
Vlasnik: dok traje testiranje, raditi na grafici. Stil treba biti blizak MMA Manageru (stilizirani 3D likovi, efekti, veliki portreti), ali ne kopija. Likovi ne smiju biti zdepasti, a krajnji proizvod je 3D, ne 2D lutke ni stickmani. Za 3D likove odabrana je opcija A: besplatan CC0 humanoidni model, koji se kasnije može zamijeniti AI-generiranim ili naručenim.
- Redoslijed grafičkog kruga: 1) HUD i efekti, 2) 3D borba (Three.js, CC0 model, poze iz igre na kosturu), 3) klub kao izometrijska dvorana. Novi 2D borci su preskočeni jer bi se bacili kad stigne 3D.
- Dizajn: `docs/superpowers/specs/2026-11-14-hud-effects-design.md`, plan: `docs/superpowers/plans/2026-11-14-hud-effects.md`.
- **Semafor** je TV traka unutar slike borbe: portret (silueta dok ne stigne 3D model) u okviru boje pojasa, ime i pojas, sitni red „greška · snaga · kondicija”, veliki bodovi s A/K, energija u 10 segmenata (zelena, žuta ispod 50, crvena ispod 20) i nagnuta jantarna pločica s rundom, fazom turnira i satom. Na mobitelu je sažet (manji portret, bez sitnog reda i oznake pozicije).
- **Kartice kritičnog trenutka:** obojeno zaglavlje po klasi (napad, obrana, sweep) s brojem tipke, naziv tehnike, razina u 10 točkica i opis. Kartica koju predlaže osjećaj ima zlatni okvir koji pulsira i oznaku „💭 osjećaj”. Traka odbrojavanja pocrveni u zadnjoj trećini.
- **Efekti:** uspješna tehnika daje nagnuti natpis koji preleti preko slike (TAKEDOWN!, SWEEP!, PROLAZ!, MOUNT!, LEĐA!, a završni submission TAP!), jantarni za tebe, crveni za protivnika. Kad se bodovi stvarno upišu, uz semafor iskoči zelena značka „+N”. Rušenje i sweep kratko protresu sliku. Uz smanjeno kretanje u sustavu efekti se samo pojave i nestanu, bez tresenja.
- Logika efekata je u `src/ui/fightFx.js` (čiste funkcije, 9 novih testova), pa HUD i efekti ostaju isti kad stigne 3D renderer.
- Font Barlow Condensed (SIL OFL) spremljen u `assets/fonts/`, bez vanjskog učitavanja. `server.js` poslužuje `.woff2` i `.txt`.
- Engine i 2D renderer nisu mijenjani.

## Napravljeno 18. studenog 2026.

### Pogled na dvoranu iz ptičje perspektive
Vlasnik: „Bilo bi dobro gledati iz ptičje perspektive dvoranu kada se trenira da se ne gleda samo kontrolna tabla.” Odabrao je položaj na vrhu, iznad slotova treninga, vidljiv u svim karticama.
- Canvas 800 × 280 iznad statusa: drveni pod, tatami „BJJ KLUB”, teretana (stalak, klupa, bučice) lijevo, kardio (dvije trake) desno, klupa i stalak s pojasevima dolje lijevo, izlaz dolje desno.
- Ti (plava majica, pojas u boji tvog pojasa) i partner (crvena) usred tatamija sa zlatnim prstenom. Rušenja se driluju stojeći (ulaz pa povratak), sve ostale kategorije u parteru. Iznad je oznaka „Potez → razina” s trakom napretka.
- Samo fizička priprema: ti na klupi s utegom ili na traci. Samo aktivnost: oznaka „Seminar/Open mat (izvan kluba)” kod izlaza. Ništa: sjediš na klupi s oznakom „Odmor”. Kad trening i fizička priprema idu zajedno, ti si na tatamiju, a teretana/kardio dobiva svoju oznaku s napretkom.
- Četiri para članova kluba izmjenjuju stojeći dio i parter, svaki svojim tempom, a trener (crni pojas) obilazi tatami.
- Uz `prefers-reduced-motion` slika miruje. Crta se samo dok je otvoren ekran karijere.
- Odluka: ravni 2D crtež u Canvasu, isti pristup kao trenutni renderer borbe, jer je jeftin i ne čeka 3D. Kad stigne „korak 3: klub kao izometrijska dvorana”, ovaj prikaz se može zamijeniti, a `src/ui/gymScene.js` (tko je gdje, čista funkcija, 5 testova) ostaje.
- Kod: `src/render/gymTopDown.js`, `src/ui/gymScene.js`, `tests/gym-scene.test.js`.

### Jedna stvar u isto vrijeme i seminar od sat vremena
Vlasnik: igrač ne može biti na seminaru i trenirati u dvorani u isto vrijeme, ne može raditi snagu ili kardio uz nešto drugo, a seminar traje 1 h stvarnog vremena. Odabrao je da se novo ne može pokrenuti dok staro traje (bez pauziranja).
- Trening poteza, teretana, kardio, seminar i open mat međusobno se isključuju (`busyWith` u `progression.js`). Gumbi su sivi i pišu što trenutno radiš („Na seminaru si. Jedna stvar u isto vrijeme.”). Gore je jedna kartica stanja umjesto tri.
- Seminar traje 3600 stvarnih sekundi: tajmer ima `clock: 'real'` (vrijeme u ms), ne ovisi o testnom ubrzanju i završi i dok je igra zatvorena. Open mat i treninzi ostaju u vremenu igre.
- Testni panel ima „⚡ Završi odmah” za seminar i open mat (aktivnost ipak baca kocku za novi potez).
- Stari save u kojem već teče više stvari odjednom pusti ih da završe; dvorana odozgo ih i dalje prikazuje kao oznake.
- Sparing i natjecanje i dalje se mogu igrati dok nešto traje.

### Osnove otključavaju sparing, trener vodi kroz početak priče
Vlasnik: sparing bez nekoliko vještina nema smisla; početak treba biti zanimljiviji, s nečim što vodi kroz priču. Odobrio je prijedlog (osnove + trener vodič). Ime trenera nije zadao, pa je odabrano „Trener Mirko”.
- **Osnove** (`BASICS` u `src/engine/story.js`): Shrimp, Bridge (upa), Zatvoreni gard, Postura u gardu, Elbow-knee bijeg, Hip bump sweep, sve na razini 1 (ukupno oko 85 s igre). Dok ih nemaš, kartica Sparing je zaključana i pokazuje popis s kvačicama. „Sve otključano” to zaobilazi.
- **Uvod:** tri kartice preko ekrana (prvi dan u klubu, trener se predstavlja, plan). Može se preskočiti.
- **Trener Mirko:** panel iznad stanja s trenutnim zadatkom, rečenicom trenera, trakom napretka i gumbom (npr. „Treniraj Shrimp”, „Kreni u sparing”). Redoslijed: osnove jedna po jedna → prvi sparing → seminar ili open mat → prvo natjecanje → plavi pojas. U dvorani odozgo trener ima bijeli oblačić („Mirko: Nauči: Shrimp”). „Preskoči vodiča” skriva trenera, ali sparing i dalje traži osnove.
- **Prvi sparing:** lakši partner (bijeli pojas, razina 1–2, zna oko trećine poteza, snaga i kondicija 1–2), a u svakoj odluci trener viče točnu karticu („🥋 Trener viče s ruba: Zatvoreni gard!”, oznaka „🥋 trener” na kartici). Opcija `coach` u `createFight`.
- Stanje priče je `state.story` (uvod, preskočeno, broj sparinga, aktivnosti i natjecanja). Stari save dobije priču s uvodom, a sparinzi i natjecanja izračunaju se iz omjera i medalja.
- Testovi: `tests/story.test.js` (8).

### Prototip low-poly 3D stila (Three.js)
Vlasnik: mogu li animacije biti u Three.js, low-poly stilu. Dogovoreno: likovi složeni u kodu od jednostavnih oblika (opcija A, bez skinutog modela), prvo prototip na zasebnoj stranici da vlasnik odobri izgled. Ovo mijenja raniji plan („besplatan CC0 humanoidni model”): low-poly likovi iz koda ne traže model, ali izgledaju stilizirano i uglato, ne kao atletski likovi iz MMA Managera.
- `tools/lowpoly.html`: tatami u dvorani, dva lika (plavi i crveni), izbornik svih 10 pozicija, „Plavi gore / dolje”, automatsko prebacivanje svih pozicija s glatkim prijelazom (0,7 s), disanje, sjene, kamera koja se okreće povlačenjem i zumira kotačićem ili s dva prsta.
- `src/render/pose3d.js` (čisto, bez Three.js): postojeće 2D ključne poze pretvara u 3D zglobove (bliže ruke i noge naprijed, dalje natrag, ramena i kukovi dobiju širinu). Testovi: `tests/pose3d.test.js` (2).
- `src/render/lowpoly.js`: lik od 6-stranih suženih valjaka između zglobova, ikosaedar za glavu, trup s rashguardom, kratke hlače i traka u boji pojasa na struku. `createMat()` je mala dvorana.
- Three.js 0.170.0 (MIT) spremljen u `vendor/three/` (oko 690 KB).
- 2D borba i dvorana odozgo nisu mijenjani.
- Poznato u prototipu: tijela se mjestimično preklapaju (npr. noge donjeg u zatvorenom gardu prolaze kroz gornjeg) jer su poze 2D s dodanom dubinom; za pravu 3D borbu poze treba doraditi po poziciji.

### Sav tekst u igri na engleskom
Vlasnik: sav tekst u igri je na engleskom. Prijevod je započet lokalno prije gornjih promjena od 18. 11., pa je nakon `git pull` spojen s njima i one su također prevedene.
- Prevedeno: sučelje (`index.html`, `app.js`), potezi i pozicije, log borbe, natpisi efekata (`PASS!`, `BACK!`), razlozi u `progression.js` („One thing at a time.”), pogled na dvoranu („BJJ CLUB”, „GYM”, „CARDIO”, „BENCH”, „EXIT”, „Resting”, „(away from the club)”), alat `tools/poses.html` i poruka servera.
- Prevedena je i priča s trenerom: uvod („First day at the club”, „The plan”), „Coach Mirko”, zadaci i savjeti u `story.js`, panel trenera („Skip the guide”), poruke („🥋 Coach shouts from the edge: …”, „💭 Your gut says: …”) i alat `tools/lowpoly.html`.
- Klase boja kartica su sada `attack` / `defense` / `sweep` (CSS `cls-defense`), a nedostajući potezi za natjecanje `attack` / `defense` / `control`. Ishod borbe na predaju ima `detail: 'gave up'`, a na bodove `points`.
- Testovi prate engleske tekstove. Testni borci zovu se `You` i `Rival`.
- Imena i prezimena protivnika (Marko Horvat i sl.) namjerno ostaju hrvatska.
- Odjeljci iznad ovoga spominju stare hrvatske natpise („BJJ KLUB”, „Odmor”, „Na seminaru si…”, „Trener Mirko”, „Trener viče s ruba”); oni su sada engleski kako je ovdje navedeno.

### Pravi 3D model umjesto likova iz koda (pregled)
Vlasnik je u low-poly prototipu vidio likove s tankim udovima (blizu „štapića” koje je ranije odbio) i krive poze na podu, pa je tražio da prije nastavka vidi humanoidni model. Predložen je Quaternius „Universal Base Characters” (CC0); vlasnik je skinuo besplatnu Standard verziju.
- `assets/models/fighter/`: samo ono što se koristi: muški model (glTF, kostur od 65 kostiju u UE stilu), svijetla i tamna koža, frizure „buzzed” i „parted”, brada, teksture smanjene na 1024 px (normal mape iz verzije za Unity/Godot, OpenGL konvencija). Ukupno oko 1,5 MB. Licenca: `LICENSE.txt` iz paketa. ZIP paketa je u `.gitignore`.
- `vendor/three/addons/`: `GLTFLoader.js` i `BufferGeometryUtils.js` iz three 0.170.0 (MIT), s import mapom za `three`.
- `src/render/fighter3d.js`: učitava model i kosu (kosa i brada se vežu na kostur tijela po imenima kostiju), boja kosu, a rashguard (prsa, ključne kosti, nadlaktice) i hlačice (kukovi, bedra) boja u shaderu prema težinama kostiju. Poza: kukovi i trup iz ciljanih smjerova (prsa se miješaju između kukova i prsa, slerp), ruke i noge IK s dvije kosti uz pravu duljinu kostiju i smjer lakta/koljena, stopala prema prstima, prsti se savijaju za stisak. Prijelazi miješaju riješene rotacije kostiju.
- `src/render/poses3d.js`: 3D poze za stav, zatvoreni gard, mount, leđa i side control (čisti podaci, `mirrorPose` za simetrične pozicije). Testovi: `tests/poses3d.test.js` (3).
- `tools/model.html`: pregled na tatamiju (plavi i crveni rashguard), izbornik pozicija, automatsko izmjenjivanje, kamera koja se okreće i zumira.
- `server.js` poslužuje `.gltf`, `.bin` i `.jpg`.
- Igra (2D borba, dvorana odozgo) nije mijenjana.

### 3D borba s modelom
Vlasnik je odobrio model i poze („kasnije ćemo modele možda malo modificirati, ali sada me zanima kako će ovo izgledati”).
- `src/render/renderer3d.js`: Three.js renderer borbe s istim sučeljem kao `renderer2d.js`. Sparing je u dvorani kluba (`src/render/gym3d.js`), a natjecanje u areni (tamna dvorana, sivi tatami s crvenim rubom, publika, reflektor). Pokreti kao u 2D-u, ali na 3D ciljevima: disanje, borba za stisak, pokret po vrsti tehnike (rušenje, sweep, prolaz, bijeg, submission, neuspjeh), tapkanje gubitnika, prijelaz s kratkim podizanjem. Kamera kadrira glave, šake i stopala oba borca i ostavlja mjesta semaforu i komentarima. Komentari, nazivi tehnika (složeni jedan ispod drugog, ispod semafora) i zatamnjenje u usporenom trenutku crtaju se na 2D platnu iznad 3D slike. HTML HUD i efekti nisu mijenjani.
- `src/render/poses3d.js`: dodane 3D poze za half guard, butterfly, knee on belly, north-south i kornjaču (front headlock), sad svih 10 pozicija. Kad je igrač dolje, uzima pozu B (isto pravilo kao 2D).
- `src/render/fighter3d.js`: `capture()` za početak prijelaza.
- `app.js` i `index.html`: import mapa za `three`, 3D platno uz 2D platno, modul i model se učitavaju u pozadini kad se igra otvori. Borba je u 3D-u ako je model učitan i 3D uključen; inače 2D. Testni panel ima „3D fighters” (pamti se u `localStorage` pod `bjj-fighter-view`, jer je to postavka preglednika, a ne napredak). Bez WebGL-a panel piše da 3D nije dostupan.
- Uklonjeni low-poly prototip (`tools/lowpoly.html`, `src/render/lowpoly.js`, `src/render/pose3d.js` i njegov test); tatami i dvorana premješteni su u `src/render/gym3d.js`.

### Dorada 3D animacije
Vlasnik: animacija nije fluidna („kao da se slike mijenjaju u starim crtićima”), pod na turniru treperi crno-bijelo, udovi propadaju kroz tatami i jedni u druge.
- Treperenje poda u areni (z-fighting): tamni pod i slojevi tatamija razmaknuti su po visini.
- `src/render/contact3d.js`: mjerenje kože ispod tatamija i u drugom borcu na stvarnim verteksima modela. `settle()` pri učitavanju slegne svih 10 poza (prije do 18 cm ispod tatamija i 11 cm preklapanja, sada 0–1 cm ispod i najviše oko 5 cm preklapanja). Tijekom igre ostaje samo provjera poda (borac se glatko podigne ako koža zađe u tatami). Guranje iz kontakta uživo je isprobano i uklonjeno jer je gurnulo udove u tatami.
- Pokreti: stalni živi pokret (težina, stisak, kukovi, glava) koji se pretapa između stava i partera; tehnike sa zaletom i smirivanjem koje se međusobno ne prekidaju; smjer tehnike određen na početku pokreta.
- Prijelazi miješaju ciljeve poze umjesto rotacija kostiju (`blendPose` u `poses3d.js`): šake, stopala i kukovi idu ravno uz mali luk koraka, kukovi se okreću kao cjelina (kvaternion), prsa i glava miješaju samo svoj otklon od kukova; gornji borac se u prijelazu malo podigne preko donjeg. Trajanje prema putu i okretu (0,7–1,8 s).
- IK pamti ravninu savijanja lakta i koljena i okreće je najviše ~7° po sličici, pa zglobovi ne preskaču kad je cilj blizu linije uda.
- Mirnija kamera (prati u stvarnom vremenu, i nagib se glatko mijenja), automatsko smanjenje kvalitete ako sličica traje dulje od 25 ms, FPS zadnje 3D borbe u testnom panelu.
- `tools/anim-check.html`: zadani niz od 16 pozicija i tehnika kroz 3D renderer točno 60 sličica/s; `window.result` daje najveći pomak zgloba po sličici, dubinu ispod tatamija i preklapanje (s mjestom gdje su se dogodili).
- Pri 60 sličica/s (isti niz): najveći pomak zgloba po sličici pao je s 38 cm na 6,8 cm (pri vrhu brzine prijelaza, bez skokova), najveća trenutna dubina ispod tatamija u prijelazu sa 60 cm na 7 cm.

### Ravnoteža borbe nakon vlasnikovih primjedbi
Vlasnik: bijeli pojas s 10 poteza na maksimumu (shrimp, single leg, hip bump, half guard, knee on belly, mount, side → mount, mount → back, back escape, armbar) i svim obranama na 1 ne prolazi bijeli turnir lako; „Armbar doesn't help here” u mountu kad protivnik bježi upom; armbar razine 10 protiv obrane 0 ne uspije uz 74 %.
- Uzroci: šansa odabranog submissiona imala je strop 55 % (automatskog 30 %), a vlastiti napadi u obrambenoj odluci bili su namjerno krive kartice; šansa greške prije borbe računala je prosjek i preko nenaučenih poteza (zato „60 %”).
- Promjene u `fight.js`: odabrani submission 25 % + 7 %/razina (do 95 %), automatski 6 % + 4,5 %/razina (do 60 %); jedan vlastiti napad (submission, sweep, prolaz, rušenje, prijelaz) u obrambenoj odluci postaje protunapad (60 % normalne šanse; uspjeh = tvoja tehnika, neuspjeh = protivnikova prolazi), bijeg ostaje kriva kartica; obrana od tehnike je barem pola vlastite razine u njoj; šansa greške samo od naučenih poteza. U sučelju oznaka „↺ counter” i vlastite poruke.
- Simulacija (400 borbi protiv natjecatelja bijelog pojasa, točne kartice): vlasnikov sastav 46 % → 50 % pobjeda. Više od formula pomaže širina igre: isti sastav + 7 poteza na razini 6 (zatvoreni gard, elbow-knee, upa, toreando, postura u gardu, kimura, RNC) 85 %; obrane na 5 i snaga/kondicija 4 bez novih poteza 78 %; sve zajedno 98 %. Gubitci dolaze od raznih submissiona (obrane na 1, protivnici napadi oko 4–5 i snaga 3–4) i od pozicija u kojima igrač ne zna ništa pa se bori na instinkt (60 % greške). Težina natjecatelja nije mijenjana.
- Testovi: 4 nova u `tests/fight.test.js`.

### Animacije tehnika
Vlasnik: „Moramo napraviti animacije za tehnike, tako će kretanje biti puno fluidnije i realnije.”
- `src/render/techniques3d.js`: klipovi tehnika (ključni trenuci s pomacima ciljeva poze za napadača i branitelja, `K(t, a, d, { A, D })`, apsolutni ciljevi za završne oblike). 30 od 57 akcija ima vlastiti klip (rušenja, guard pull, snap down, guillotine, sweepovi iz garda, submissioni iz garda, prolazi, prijelazi side → mount / knee on belly, mount → leđa, bijegovi upa / elbow-knee / shrimp / s leđa, armbar iz mounta, garda i knee on belly, americana, kimura, RNC, d'arce, guillotine s kornjače, kornjača → leđa), ostale klip prema vrsti. Testovi: `tests/techniques3d.test.js` (5).
- `renderer3d.js`: klip počinje s akcijom; odgovor na odluku nastavlja isti klip; prijelaz pozicije traje koliko klip; uspješan submission drži završni oblik. Nagib smjera „gore” okreće i smjer „naprijed” (inače se trup zavrtio kod sjedanja u hip bumpu). Šake, stopala i koljena ne idu ispod tatamija, a podizanje s poda je najviše 1,5 cm po sličici.
- `tools/techniques.html`: svaka tehnika uspjeh/neuspjeh, usporeno; `?strip&action=…&outcome=…` slaže 6 sličica za provjeru.
- Pregledano po sličicama: double leg, single leg, hip bump, armbar iz mounta (pravi završni oblik), armbar iz garda (iz ovog kuta kamere slabo se vidi), mount → leđa, RNC (ruka pod bradom), bijeg s leđa, neuspjeli armbar (pola zamaha pa natrag).
- `tools/anim-check.html` sada koristi stvarne akcije iz svake pozicije, uključujući neuspjele submissione.

### Manga prototip
Vlasnik: animacije i prijelazi i dalje nisu realni; želi vidjeti borbu u anime/manga stilu, kao listanje stranica stripa. Dogovoreno: prvo prototip izgleda (prijedlog: realne prijelaze bez motion capturea ne ganjati dalje; ako se 3D zadrži, put je mocap iz snimki stvarnih tehnika).
- `src/render/manga3d.js`: panel = sličica dvaju 3D boraca (poza, prijelaz u trenutku t, klip tehnike u trenutku t) iz zadanog kadra; post shader: obrubi iz rubova dubine i normala, tonovi (bijelo / raster / gusti raster / crno), prozirna pozadina; svjetlo prati kameru.
- `techniques3d.js`: `applyClips()` (primjena klipova na pozu) izvučen iz `renderer3d.js`, da ga koriste i 3D borba i manga.
- `tools/manga.html`: fiksna borba na 4 stranice (četvrtfinale: single leg, triangle iz garda s odlukom „Posture up / Armbar defense / Counter”, dvije varijante sljedeće stranice, prolaz, mount, armbar, tap, pobjeda), paneli raznih oblika, linije brzine i fokusa, raster pozadine, zvučni efekti, oblačići govora / misli / povika, natpisi, okretanje stranica klikom ili strelicama.
- Poznato: kadrovi su ručno postavljeni za ovu borbu; lica bez izraza (model ih nema); neki paneli (tap, pobjeda) zbijeni; crni rashguard protivnika u krupnom planu postaje velika crna ploha.

## Zadnja automatizirana provjera

Provedeno 18. studenog 2026. (manga prototip):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 127/127 prolazi |
| `tools/manga.html` | sve 4 stranice i obje varijante odluke iscrtane (Playwright), 0 grešaka |
| 3D borba nakon izvlačenja `applyClips()` | e2e sparing bez grešaka, `tools/anim-check.html` isti rezultat (9 cm) |

Prethodna provjera (18. studenog 2026., animacije tehnika i ravnoteža):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 127/127 prolazi |
| `tools/anim-check.html` (60 sličica/s, 17 stvarnih akcija) | najveći pomak zgloba 9 cm po sličici (brzo prevrtanje kod upe), najdublje ispod tatamija 13 cm (trenutno, kod rušenja), najveće preklapanje 11 cm (trenutno, u bijegu) |
| `tools/techniques.html` | snimke 9 tehnika, 0 grešaka |
| Playwright e2e | sparing do kraja u 3D-u, 0 grešaka u konzoli |
| Simulacija ravnoteže (400 borbi) | vlasnikov sastav 50 % pobjeda, sa 7 dodatnih poteza 85 % |

Prethodna provjera (18. studenog 2026., dorada 3D animacije):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 118/118 prolazi |
| `tools/anim-check.html` (60 sličica/s) | najveći pomak zgloba 6,8 cm po sličici, najdublje ispod tatamija 7 cm (trenutno, u prijelazu), najveće preklapanje 11 cm (trenutno, u prijelazu), 0 grešaka |
| Playwright e2e | sparing i natjecanje do kraja u 3D-u, 0 grešaka u konzoli |

Prethodna provjera (18. studenog 2026., 3D borba):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 112/112 prolazi (2 testa otišla su s low-poly prototipom) |
| Playwright e2e (1100 px, WebGL) | sparing i natjecanje odigrani do kraja u 3D-u uz „Unlock everything” i ubrzanje 10x: kritični trenuci (kartice, „Coach shouts from the edge”), natpis „BACK!” i značka „+4” preko 3D slike, komentari dolje, ishod (pobjeda i poraz submissionom), arena u natjecanju; uloge se zamijene kad je igrač dolje; 0 grešaka u konzoli |
| Playwright 2D | s isključenim „3D fighters” borba se crta na 2D platnu, 3D platno je skriveno |
| Playwright mobitel (390 × 844) | 3D borba stane, nema horizontalnog scrolla |
| `tools/model.html` | učitava se sa svih 10 pozicija |

Prethodna provjera (18. studenog 2026., pregled 3D modela):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 114/114 prolazi |
| Playwright (900 px, WebGL) | `tools/model.html` crta oba lika u svih 5 poza (snimke iz više kutova); gard odozgo i sa strane: noge crvenog oko struka plavog, stopala prekrižena iza leđa; 0 grešaka u konzoli |
| Playwright mobitel (390 × 844) | automatsko izmjenjivanje prođe svih 5 pozicija s prijelazima, nema horizontalnog scrolla, 0 grešaka |

Prethodna provjera (18. studenog 2026., sav tekst na engleskom):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 111/111 prolazi |
| Playwright (1100 px) | tri kartice uvoda („Next”, „On the mat”), panel trenera „First week: the basics (0/6)” s „Train Shrimp”, sparing zaključan bez osnova; uz „Unlock everything” sparing kreće i semafor pokazuje „ROUND 1/3”; jedini znakovi č/ć/š/ž/đ na ekranu su u prezimenu protivnika; 0 grešaka u konzoli |
| Rječnik | sve riječi iz stringova u `src/`, `index.html` i `tools/` su engleske, BJJ termini, imena ili kodne oznake |

Prethodna provjera (18. studenog 2026., low-poly prototip):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 111/111 prolazi |
| Playwright (1000 px, WebGL) | `tools/lowpoly.html` crta stav, zatvoreni gard, mount, leđa, kornjaču; 0 grešaka u konzoli |

Prethodna provjera (18. studenog 2026., osnove i trener vodič):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 109/109 prolazi |
| Playwright (1100 px) | nova igra prikaže uvod, nakon njega panel trenera i oblačić u dvorani; sparing zaključan bez osnova; nakon osnova trener nudi sparing, partner je bijeli pojas, u odluci se vidi „🥋 Trener viče s ruba”; 0 grešaka u konzoli |
| Playwright mobitel (iPhone 13) | uvod stane na ekran, nema horizontalnog scrolla |

Prethodna provjera (18. studenog 2026., jedna stvar u isto vrijeme, seminar 1 h):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 101/101 prolazi |
| Playwright (1100 px) | dok traje trening, teretana i seminar su sivi s razlogom; seminar pokazuje „još 1 h” i blokira trening; „⚡ Završi odmah” završi seminar uz poruku; 0 grešaka u konzoli |

Prethodna provjera (18. studenog 2026., nakon pogleda na dvoranu):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 97/97 prolazi |
| Playwright (1100 px) | dvorana se crta u mirovanju, s treningom u parteru (Shrimp), s rušenjem (Double leg) uz kardio i open mat, i samo s teretanom; nakon sparinga i povratka u klub crta se dalje; 0 grešaka u konzoli |
| Playwright mobitel (iPhone 13) | nema horizontalnog scrolla |

Prethodna provjera (14. studenog 2026., nakon HUD-a i efekata):

| Provjera | Rezultat |
| --- | --- |
| `npm test` | 92/92 prolazi |
| `npm start` | server odgovara, font se učitava (`document.fonts.check` za Barlow Condensed 800 italic) |
| Playwright e2e (1100 px) | sparing (dvorana) i natjecanje (arena) odigrani do rezultata uz „sve otključano”, svi natpisi iz dopuštenog popisa, značke s točnim bodovima, sloj efekata prazan nakon borbe, 0 grešaka u konzoli |
| Playwright smanjeno kretanje | natpisi i značke se pojavljuju, slika se nikad ne trese |
| Playwright mobitel (iPhone 13) | nema horizontalnog scrolla u borbi ni s dugim imenom protivnika (ime završava s „…”), kartice jedna ispod druge, tipka 1 bira opciju |

## Poznata ograničenja

- Postoji samo testna verzija (testni panel, ubrzanje, ⚡ +1).
- 3D borba: svi protivnici imaju isti izgled (tamna koža, brada, crveni rashguard). U mirnim pozama tijela se preklapaju najviše oko 5 cm, a usred prijelaza kratko do oko 11 cm; u stavu se ruke križaju. 30 tehnika ima vlastitu animaciju, ostale opću prema vrsti; usred prevrtanja kod hip bumpa gornji je nakratko previsoko, a armbar iz garda iz kuta kamere slabo se vidi. Brzina na pravom mobitelu nije izmjerena (provjereno u headless Chromiumu sa softverskim WebGL-om).
- Prva borba odmah nakon otvaranja igre može biti u 2D-u ako se model još nije učitao (oko 1,5 MB).
- Rashguard je obojena koža (bez nabora i ruba tkanine), a model u besplatnoj verziji postoji samo u dvije boje kože.
- Animacije su po vrsti tehnike (rušenje, sweep, prolaz, bijeg, submission), ne za svaku tehniku posebno. Poze su ključne poze po poziciji, 2D. U 2D načinu borci su i dalje stare 2D figure.
- Portreti na semaforu su siluete dok ne stigne 3D model.
- Prasak na mjestu kontakta nije napravljen jer ovisi o položaju boraca, dolazi s 3D-om.
- Reload usred borbe prekida borbu bez upisa rezultata.
- Dok je uključeno „sve otključano”, igrač zna sve poteze pa se nude svi potezi iz pozicije.
- Igrač bez poteza ne može na sparing dok ne nauči osnove; na natjecanju vrijedi stari uvjet (po jedan potez iz napada, obrane i kontrole).
- Snaga i kondicija su jedan broj svaka (nema posebne eksplozivnosti, izdržljivosti stiska i sl.).
- Nakon ponovnog otvaranja igre nema obavijesti o treningu ili aktivnosti koji su završili dok je igra bila zatvorena.

## Sljedeći koraci

1. Vlasnik pregleda `tools/manga.html`. Ako je smjer dobar: manga prikaz spojiti s pravom borbom (svaka razmjena iz loga borbe postaje 1–3 panela prema vrsti akcije: kadrovi i efekti po vrsti tehnike, odluke kao paneli s kartama), automatski raspored panela po stranici, izrazi lica (npr. 2D crtani preko glave) i različit izgled protivnika.
1. Vlasnik isproba 3D borbu i javi što promijeniti (kamera, tempo, poze, izgled modela). Zatim: različiti izgledi protivnika (koža, kosa, brada, boja rashguarda), portreti na semaforu iz modela, dorada poza i prijelaza (preklapanja tijela), animacija po tehnici; zatim dvorana kluba u 3D-u.
1. Vlasnik isproba uvod i trenera i javi treba li drukčiji ton, ime ili zaplet (npr. rival iz drugog kluba).
1. Pogled na dvoranu: vlasnik isproba i javi treba li veći, manji ili drukčiji (npr. više članova kluba, zvukovi).
1. Korak 2 drugog kruga: granice razina po pojasu, novi seminari (instruktori 1–5 ★, 40–90 %, trening pauziran). Korak 3: stil borbe, energija, ozljede.
2. Vlasnik isproba testnu verziju i javi što treba podesiti (učestalost kritičnih trenutaka, težina, trajanja).
2. Prava verzija: početak bez otključanih poteza, bez testnog panela.
3. Animacije pojedinih tehnika i više poza (npr. zasebne poze za trokut, armbar, leg lockove), u 3D-u.
4. Klub koji se nadograđuje, karijera, ozljede.

## Handoff za novi chat

1. Kod je u `bjj-fighter/` na grani `dev`. Prvo pročitaj `README.md`, `docs/KONCEPT.md` i ovaj dokument.
2. Pokretanje: `npm start` (http://localhost:8080). Testovi: `npm test`. 2D poze: `tools/poses.html`. 3D model i poze: `tools/model.html`.
   - Borba je u 3D-u (`src/render/renderer3d.js`, model Quaternius CC0 u `assets/models/fighter/`), 2D je rezerva. 3D poze su ciljevi u `src/render/poses3d.js` (x uz borbu, y gore, z prema kameri), a `fighter3d.js` ih rješava IK-om. Nova pozicija treba pozu i u `poses.js` (2D) i u `poses3d.js` (3D); provjera izgleda u `tools/model.html`.
   - Sav tekst u igri je na engleskom (imena protivnika ostaju hrvatska). Dokumentacija ostaje na hrvatskom.
   - Smjer grafike: krajnji proizvod je 3D, blizak stilu MMA Managera, s atletskim (ne zdepastim) proporcijama. HUD i efekti su HTML preko canvasa (`src/ui/fightFx.js` + `style.css`) i ne ovise o rendereru.
3. Granice arhitekture:
   - `src/engine` i `src/data` ne smiju dirati DOM.
   - Renderer samo čita stanje borbe.
   - Slučajnost uvijek ide kroz `rng`.
   - Nove akcije idu u `src/data/positions.js`, a testovi u `tests/positions.test.js` provjeravaju da su podaci povezani.
