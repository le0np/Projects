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
- **Disciplina:** prvo BJJ, MMA kasnije.

### Borba
Borba teče sama, ovisno o vještinama oba borca. U kritičnim trenucima (protivnik kreće u submission, otvori se prilika za sweep ili prolaz garda, kraj runde...) vrijeme se uspori i igrač dobije pet opcija. Jedna ili više može biti točna, a jedna ili više kriva. Odluka ima ograničeno vrijeme. Ishod ovisi o izboru:
- dobra odluka → bolja pozicija, bodovi, submission
- loša odluka → gubitak pozicije, negativni bodovi, poraz submissionom
- (MMA kasnije: KO, nokdaun)

Prijedlog: pozicije su graf (stojeći, zatvoreni gard, polugard, side control, mount, leđa...). Svaka ima svoje moguće akcije, prijelaze i submissione. Bodovanje je kao u BJJ-u (takedown/sweep 2, prolaz garda 3, mount/leđa 4) uz pobjedu submissionom.

### Razvoj lika
Razvoj je u stilu Clash Royalea (building strategy): treninzi i nadogradnje traju određeno stvarno vrijeme i odvijaju se dok igrač nije u igri. Igrač ne mora stalno igrati: navrati, pokrene trening, vrati se kad završi.

Prijedlozi:
- vještine po područjima (npr. gard, prolazi, kontrola, submissioni, obrana, kondicija) i pojedinačne tehnike koje se otključavaju
- napredak kroz pojaseve (bijeli → plavi → ljubičasti → smeđi → crni)
- dvorana/klub koji se nadograđuje (bolja oprema, treneri, sparing partneri → brži ili jači treninzi)
- valuta se zarađuje u borbama i troši na treninge i nadogradnje

Mogućnost za razmotriti: vještine lika utječu na to koje se opcije nude i koliko su uspješne.

### Prvi korak (MVP)
Jedan borac, nekoliko vještina s timer-treninzima, desetak BJJ pozicija i tehnika, borba protiv AI protivnika s kritičnim trenucima i pet opcija, spremanje napretka u pregledniku.

### Otvoreno
- tehnologija prikaza (npr. Phaser za 2D)
- izgled borca (customizacija?) i likovni stil
- spremanje napretka: samo lokalno ili račun na serveru
- koliko traju treninzi i borbe
