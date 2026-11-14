# Ideje

Popis ideja koje još nisu pretvorene u projekt. Kad ideja postane projekt, briše se odavde i dodaje u tablicu u [`README.md`](README.md).

Format:

```
## Naziv ideje
Što radi i za koga je. Želje oko tehnologije ili izgleda, ako ih ima.
```

---

## MMA / BJJ borilačka igra
Igra u kojoj igrač gradi borca od nule: kreće kao početnik bez vještina, trenira, stječe i usavršava tehnike te napreduje kroz borbe. Kreće se s BJJ-om (pozicije, prijelazi, submissioni), a MMA (udarci, rvanje, KO) dolazi kasnije.

### Dogovoreno
- **Platforma:** browser (mobitel i računalo, bez instalacije).
- **Protivnici:** AI protivnici kroz karijeru/turnire. PvP možda kasnije.
- **Prikaz borbe:** 2D, uz mogućnost kasnijeg prelaska na 3D. Logika borbe mora biti odvojena od prikaza da se prikaz može zamijeniti.
- **Disciplina:** prvo BJJ, MMA kasnije. BJJ je **no-gi** varijanta (rashguard i šorc, bez hvatova za kimono).
- **Pravila:** ne slijede se striktno IBJJF pravila. Heel hookovi i ostali leg lockovi dopušteni su u svim borbama.
- **Bodovanje:** kao u pravom BJJ-u (po uzoru na IBJJF): takedown 2, sweep 2, koljeno na trbuhu 2, prolaz garda 3, mount 4, leđa 4. Bodovi se dobivaju tek kad se pozicija zadrži 3 sekunde. Uz to postoje prednosti (advantage) i kazne. Pobjeđuje se submissionom, a ako ga nema, bodovima.
- **Trajanje borbe:** 3 runde po 3 minute ili do submissiona.
- **Spremanje napretka:** za sada samo u pregledniku. Račun dolazi kasnije.
- **Izgled lika:** za sada jednostavan, ali dovoljno dobar da borbe izgledaju zanimljivo. Prilagođavanje izgleda dolazi kasnije.
- **Testna i prava verzija:** testna verzija ima sve otključano i vrijeme ubrzano do 10x (igrač bira ubrzanje). Prava verzija ima napredovanje kroz vrijeme, gdje svaki sljedeći razvoj vještine traje duže od prethodnog, kao u drugim igrama tog tipa.

### Borba
Borba teče sama, ovisno o vještinama oba borca. U kritičnim trenucima (protivnik kreće u submission, otvori se prilika za sweep ili prolaz garda, kraj runde...) vrijeme se uspori i igrač dobije pet opcija. Jedna ili više može biti točna, a jedna ili više kriva. Odluka ima ograničeno vrijeme. Ishod ovisi o izboru:
- dobra odluka → bolja pozicija, bodovi, submission
- loša odluka → gubitak pozicije, negativni bodovi, poraz submissionom
- (MMA kasnije: KO, nokdaun)

Prijedlog: pozicije su graf (stojeći, zatvoreni gard, polugard, butterfly gard, side control, koljeno na trbuhu, mount, leđa...). Svaka ima svoje moguće akcije, prijelaze i submissione. U no-gi BJJ-u češći su guillotine, darce, rear naked choke i leg lockovi. Heel hook je u borbama dopušten svima, ali kao napredna tehnika spada u poteze višeg pojasa.

### Razvoj lika
Razvoj je u stilu Clash Royalea (building strategy): treninzi i nadogradnje traju određeno stvarno vrijeme i odvijaju se dok igrač nije u igri. Igrač ne mora stalno igrati: navrati, pokrene trening, vrati se kad završi.

Prijedlozi:
- vještine po područjima (npr. gard, prolazi, kontrola, submissioni, obrana, kondicija) i pojedinačne tehnike koje se otključavaju
- napredak kroz pojaseve (bijeli → plavi → ljubičasti → smeđi → crni)
- dvorana/klub koji se nadograđuje (bolja oprema, treneri, sparing partneri → brži ili jači treninzi)
- valuta se zarađuje u borbama i troši na treninge i nadogradnje

Mogućnost za razmotriti: vještine lika utječu na to koje se opcije nude i koliko su uspješne.

Svaki potez ima razine. Novi potez se nauči brzo (razina 1 traje od nekoliko sekundi do minute), a svaka sljedeća razina istog poteza traje 2x duže od prethodne, kao u drugim igrama tog tipa. Usavršavanje poteza tako s vremenom traje minute, sate, pa i dane.

Što je pojas viši, borac brže uči nove poteze (iskusniji borac lakše pohvata novu tehniku). Koliko brže od bijelog pojasa uči koji pojas: plavi 20 %, ljubičasti 45 %, smeđi 65 %, crni 85 %. Npr. potez koji bijeli pojas uči 10 minuta crni nauči za 1,5 minutu. U testnoj verziji isti sustav radi s vremenom ubrzanim do 10x.

Potezi su ograničeni po pojasevima, ali ne strogo:
- redovnim treningom u klubu igrač uči poteze svog pojasa
- novi potez, pa i onaj višeg pojasa, može se naučiti i izvan redovnog treninga:
  - na **seminaru**: 90 % šanse
  - na **open matu**: 10–20 % šanse
  - na **natjecanju**: 5 % šanse (npr. pokupi ga od protivnika)

### Prva vještina: osnove BJJ-a (bijeli pojas, no-gi)
Osnovni potezi koje bi bijeli pojas morao znati. Popis je sastavljen prema uobičajenim programima za bijeli pojas, prilagođen za no-gi.

**Kretanje i osnove**
- shrimp (bijeg kukovima)
- bridge / upa (most)
- technical stand-up (sigurno ustajanje s poda)
- sprawl (obrana od rušenja)
- postura u zatvorenom gardu (gornji igrač)

**Rušenja (stojeći)**
- double leg takedown
- single leg takedown
- snap down u prednju kontrolu glave (front headlock)
- povlačenje u gard (guard pull, bez bodova)

**Gardovi (donji igrač)**
- zatvoreni gard (closed guard)
- polugard (half guard)
- butterfly gard

**Sweepovi (2 boda)**
- hip bump sweep (iz zatvorenog garda)
- scissor sweep (iz zatvorenog garda)
- flower / pendulum sweep (iz zatvorenog garda)
- butterfly sweep
- underhook sweep iz polugarda (izlaz na leđa ili podizanje na noge)

**Prolazi garda (3 boda)**
- otvaranje zatvorenog garda (stojeći ili na koljenima)
- knee slice / knee cut pass (knee pass)
- toreando pass (u no-gi hvat za koljena ili gležnjeve)
- over-under pass

**Gornje pozicije**
- side control (bočna kontrola)
- knee on belly (koljeno na trbuhu, 2 boda)
- mount (4 boda)
- back mount / back control (seatbelt hvat i dvije kuke, 4 boda)
- north-south

**Prijelazi**
- side control → mount
- side control → knee on belly
- mount → back control (kad se protivnik okrene)

**Bijegovi**
- iz mounta: upa (bridge and roll) i elbow-knee bijeg (shrimp nazad u gard)
- iz side controla: shrimp nazad u gard i underhook na koljena
- iz back controla: spuštanje ramena na pod i okretanje u gard
- iz knee on bellyja: guranje koljena i shrimp

**Submissioni**
- rear naked choke (iz back controla)
- guillotine (stojeći ili iz garda)
- triangle choke (iz garda)
- armbar (iz garda i iz mounta)
- kimura (iz garda, side controla i polugarda)
- americana (iz side controla i mounta)
- straight ankle lock (ravna poluga na stopalo)

**Obrane od submissiona**
- obrana od guillotine
- obrana od triangla (postura, izvlačenje ruke)
- obrana od armbara (spajanje ruku, hitchhiker bijeg)
- obrana od rear naked chokea (borba za ruke)

Ovi potezi su ujedno i prve opcije u kritičnim trenucima borbe. Npr. kad je igrač u mountu ispod, nudi mu se upa, elbow-knee bijeg, guranje protivnika ravnim rukama (kriva opcija jer otvara armbar), okretanje na trbuh (kriva opcija jer daje leđa) itd.

### Prvi korak (MVP = testna verzija)
Jedan borac jednostavnog, ali živog 2D izgleda. Nekoliko vještina s treninzima na timer (ubrzano vrijeme, sve otključano). Desetak no-gi pozicija i tehnika. Borba protiv AI protivnika (3 runde po 3 minute ili do submissiona) s kritičnim trenucima, pet opcija i pravim BJJ bodovanjem. Napredak se sprema u pregledniku.

### Otvoreno
- tehnologija prikaza (npr. Phaser za 2D)
