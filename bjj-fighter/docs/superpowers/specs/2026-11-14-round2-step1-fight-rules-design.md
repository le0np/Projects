# bjj-fighter — 2. krug, korak 1: pravila borbe (dizajn)

Odobreno od vlasnika 14. 11. 2026. (plan u 3 koraka; ovo je prvi).

## Zašto
S testiranja: igračeve greške se kažnjavaju, protivnikove ne; isti borac napada više puta zaredom („spam”); log je kratak i ne objašnjava bodove; odluka bi trebala biti u ~30 % situacija (70/30 u korist simulacije), a vještina iz dvorane treba doći do izražaja.

## Odluke vlasnika
- Protivnik griješi, a postotak ovisi o pojasu i razini vještine.
- Potez za potez: inicijativa se strogo izmjenjuje; propali potez predaje red drugom borcu, koji odlučuje sljedeći potez.
- Sweep u mount ostaje 2 + 4, ali log to mora precizno ispisati.
- 70/30: odluka se traži u oko 30 % razmjena.
- Kartice u bojama po klasi: napad, obrana, kontrola, pozicija.
- Brzina odluke utječe na ishod.
- Cijeli log u pregledniku tijekom borbe, s mogućnošću kopiranja (da ga vlasnik zalijepi u chat).

## Odluke (Claude)
- Šansa greške: pojas — bijeli 25 %, plavi 18 %, ljubičasti 12 %, smeđi 8 %, crni 5 %; minus 1,5 postotna boda za svaku razinu poteza iznad 1; najmanje 2 %.
- Greška protivnika: njegov potez propada, a igrač dobiva kritični trenutak „Protivnik je pogriješio — prilika!”. Igračevi automatski potezi griješe po istoj tablici, ali njegova greška samo propada (protivnik ne dobiva kritični trenutak, jer protivnik ne odlučuje kroz opcije).
- Razmjene svakih 6–9 s igraćeg vremena (sporije, više animacije).
- Bonus za brzinu: odgovor u prvoj trećini roka daje +10 postotnih bodova šanse uspjeha.
- Klase i boje: napad (submissioni, sweepovi, prolazi, rušenja) crveno; obrana (obrane, bijegovi) plavo; kontrola (gornje pozicije, gardovi, prijelazi) zeleno; pozicija (kretanje i osnove) žuto.
- Log: svaka stavka ima rundu i sat („R1 2:13”); bodovi se ispisuju razloženo („+6: Flower sweep 2 + mount 4”); gumb „Kopiraj log” kopira cijeli log s rezultatom.
