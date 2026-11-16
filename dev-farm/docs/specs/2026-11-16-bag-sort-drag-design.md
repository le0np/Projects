# Torba i škrinja: sortiranje i premještanje mišem

Dogovoreno s vlasnikom 16. 11. 2026. (točka 3, prvi dio).

## Zašto
Unutar iste mreže predmeti se ne mogu presložiti ni sortirati; nova roba ide na prvo slobodno mjesto pa se nakon nekoliko dana sve izmiješa.

## Odluke vlasnika
- Gumb „Sortiraj“ (ne automatski): prema zadanom po količini, od predmeta kojeg ima najviše prema onom kojeg ima najmanje, bez praznih mjesta između.
- Igrač može mišem premjestiti predmet kamo hoće; ručni raspored ostaje dok ponovo ne sortira.

## Dizajn (odobren)
1. „Sortiraj“ iznad mreže torbe, škrinje, štanda i kombija: spoji nepune hrpe istog predmeta, složi po ukupnoj količini (pa abecedno po imenu), prazna mjesta na kraju.
2. Povlačenje unutar iste mreže: na prazno mjesto → premjesti; na isti predmet → spoji (višak ostaje); na drugi predmet → zamijene mjesta.
3. Povlačenje u drugu mrežu: na prazno mjesto ili isti predmet → hrpa ide točno tamo (koliko stane); na drugi predmet → na prvo slobodno mjesto. Vrijede postojeća pravila `moveItem` (štand i kombi samo roba za prodaju, torba nije dostupna dok je farmer u gradu, kombi samo dok je kod kuće).
4. Klik i „po 1 / po 5 / sve“ ostaju.

## Pristup
Jedan razuman put: pravila kao čiste funkcije u `src/sim.js` (`sortSlots`, `dropItem`), u sučelju browserov drag & drop na postojećim gumbima mjesta (`slotButton`). Vlastiti sustav povlačenja (pointer events) donio bi samo dodirne ekrane, koje igra još ne podržava.

## Ne radimo sada
Druge načine sortiranja, sortiranje sjemena u vrećici, dodirne ekrane.
