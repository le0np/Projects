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
- **Bodovanje:** kao u pravom BJJ-u (IBJJF no-gi pravila): takedown 2, sweep 2, koljeno na trbuhu 2, prolaz garda 3, mount 4, leđa 4. Bodovi se dobivaju tek kad se pozicija zadrži 3 sekunde. Uz to postoje prednosti (advantage) i kazne. Pobjeđuje se submissionom, a ako ga nema, bodovima.
- **Trajanje borbe:** 3 runde po 3 minute ili do submissiona.
- **Spremanje napretka:** za sada samo u pregledniku. Račun dolazi kasnije.
- **Izgled lika:** za sada jednostavan, ali dovoljno dobar da borbe izgledaju zanimljivo.
- **Testna i prava verzija:** testna verzija ima sve otključano i vrijeme ubrzano do 10x (igrač bira ubrzanje). Prava verzija ima napredovanje kroz vrijeme, gdje svaki sljedeći razvoj vještine traje duže od prethodnog, kao u drugim igrama tog tipa.

### Borba
Borba teče sama, ovisno o vještinama oba borca. U kritičnim trenucima (protivnik kreće u submission, otvori se prilika za sweep ili prolaz garda, kraj runde...) vrijeme se uspori i igrač dobije pet opcija. Jedna ili više može biti točna, a jedna ili više kriva. Odluka ima ograničeno vrijeme. Ishod ovisi o izboru:
- dobra odluka → bolja pozicija, bodovi, submission
- loša odluka → gubitak pozicije, negativni bodovi, poraz submissionom
- (MMA kasnije: KO, nokdaun)

Prijedlog: pozicije su graf (stojeći, zatvoreni gard, polugard, butterfly gard, side control, koljeno na trbuhu, mount, leđa...). Svaka ima svoje moguće akcije, prijelaze i submissione. No-gi naglašava tehnike poput heel hooka i drugih leg lockova, guillotine, darcea i rear naked chokea.

### Razvoj lika
Razvoj je u stilu Clash Royalea (building strategy): treninzi i nadogradnje traju određeno stvarno vrijeme i odvijaju se dok igrač nije u igri. Igrač ne mora stalno igrati: navrati, pokrene trening, vrati se kad završi.

Prijedlozi:
- vještine po područjima (npr. gard, prolazi, kontrola, submissioni, obrana, kondicija) i pojedinačne tehnike koje se otključavaju
- napredak kroz pojaseve (bijeli → plavi → ljubičasti → smeđi → crni)
- dvorana/klub koji se nadograđuje (bolja oprema, treneri, sparing partneri → brži ili jači treninzi)
- valuta se zarađuje u borbama i troši na treninge i nadogradnje

Mogućnost za razmotriti: vještine lika utječu na to koje se opcije nude i koliko su uspješne.

Trajanje treninga raste sa svakom razinom (npr. razina 1 traje minute, a više razine sate, pa i dane). U testnoj verziji isti sustav radi s vremenom ubrzanim do 10x.

### Prvi korak (MVP = testna verzija)
Jedan borac jednostavnog, ali živog 2D izgleda. Nekoliko vještina s treninzima na timer (ubrzano vrijeme, sve otključano). Desetak no-gi pozicija i tehnika. Borba protiv AI protivnika (3 runde po 3 minute ili do submissiona) s kritičnim trenucima, pet opcija i pravim BJJ bodovanjem. Napredak se sprema u pregledniku.

### Otvoreno
- tehnologija prikaza (npr. Phaser za 2D)
- customizacija izgleda borca
- točna trajanja treninga po razinama
