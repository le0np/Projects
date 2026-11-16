# Rad na polju: sporiji farmer, radnje koje traju, povlačenje mišem, serija

Dogovoreno s vlasnikom 16. 11. 2026. (točka 1 nove liste ideja).

## Zašto

- Farmer treba hodati brzinom kupaca, „radi dojma“: sad je brži od svih na mapi.
- Radnje na polju ne smiju biti trenutne: svaka traje barem sekundu, kao u igrama tog tipa.
- Kad je ručni rad spor, treba ga moći zadati odjednom: povlačenjem preko polja i serijom berba → sadnja → zalijevanje.
- Posljedica koju je vlasnik prihvatio: ručni rad postaje skup, pa igrač ulaže u strojeve (dron s kamerom do ★★★★★, replant.py v3, fertigacija) dok farma ne radi sama.

## Ciljevi

1. `WALK_SPEED` = `NPC_SPEED` (3 polja/s; sad 4).
2. Trajanja (stvarne sekunde; 1 s = 2 min igre): sadnja 1,5, berba 1,5, čišćenje trule parcele 1,5, punjenje kante 2, zalijevanje 1, gnojenje 1, malčiranje 1. Isto za pojedinačni klik i za skupne poslove.
3. Povlačenje lijevom tipkom preko parcela: parcele na kojima trenutni alat ima posla dobiju obrub; na otpuštanje farmer ih obiđe redom (`route`). Ruke beru, sjeme sadi odabranu vrstu, kanta zalijeva, gnojivo gnoji, malč malčira. Kratki klik ostaje kao sada.
4. Serija na parceli: poberi → posadi istu vrstu (ako je nema, vrstu iz vrećice; ako ni nje nema, parcela ostaje prazna) → zalij (kad je kanta prazna, ide po vodu; na kišni dan nema što zaliti). Pokreće se iz izbornika Ruke ▾ („Serija: sve zrelo“, „Serija: samo [vrsta]“) i povlačenjem rukama uz Shift.

## Pravila ponašanja

- Za vrijeme radnje: traka napretka nad farmerom (kao kod gradnje bunara) i poza rada (sagne se; kod zalijevanja nagnuta kanta s kapima).
- Energija se troši kad radnja završi. Novi klik na mapi prekida radnju; ništa se ne troši.
- Ako se parcela u međuvremenu promijenila (dron, kiša), farmer je preskoči.
- Povlačenje dok farmer radi isti posao dodaje parcele na kraj reda; drugi posao zamjenjuje trenutni.
- Napredak na gumbu alata („sadi 3/9“) i ■ za prekid kao kod postojećih skupnih poslova.

## Ne radimo sada

- Radnika na polju (razvoj ide preko strojeva).
- Promjene u dronu, prskalicama i fertigaciji.
- Spremanje reda poslova pri učitavanju (kao i dosad, red se ne sprema).

## Pristup

Jedan razuman put: proširiti postojeći mehanizam skupnih poslova (`f.queue`, `f.job`, `continueJob`, `route` u `src/sim.js`) i stanje `farmer.busy` s trakom napretka (`src/render.js`). Povlačenje i serija samo pune red; trajanje je novo `busy` stanje za radnje na parceli. Zaseban sustav za povlačenje ili seriju bio bi dvostruki kod iste logike.

## Ostavljeno graditelju

- Točan izgled poza i obruba povlačenja.
- Kako se zapisuju trajanja u `src/data.js` (npr. `WORK_SECONDS`).
- Prag koji razlikuje klik od povlačenja.
