# bjj-fighter: HUD borbe i efekti (dizajn)

Odobreno od vlasnika 14. 11. 2026. Prvi korak grafičkog kruga.

## Zašto
Vlasnik želi grafiku blisku stilu MMA Managera (stiliziran 3D, efekti, veliki portreti), ali ne kopiju. Krajnji prikaz borbe bit će 3D, bez „lutaka” i bez zdepastih proporcija. Ovaj korak radi samo ono što preživi prelazak na 3D: HUD i efekte koji su HTML preko slike, neovisni o rendereru. Testiranje igre teče usporedno, pa se pravila borbe ne diraju.

## Redoslijed grafičkog kruga
1. HUD i efekti (ovaj dokument).
2. 3D borba: Three.js i besplatan CC0 humanoidni model (opcija A), poze iz igre primijenjene na kostur. Model se kasnije može zamijeniti AI-generiranim ili naručenim. Ima vlastiti dizajn.
3. Klub kao izometrijska dvorana.

## Pristupi koji su razmatrani
- **HUD kao HTML preko canvasa (odabrano):** radi jednako s 2D i 3D prikazom, tekst je oštar i pristupačan, a postojeći semafor i kartice već su HTML.
- **HUD nacrtan u canvasu:** izgleda kao skica, ali bi se morao ponovno napisati za 3D.
- **Prvo novi 2D borci (ideja 1 iz skica):** odbačeno jer se baca čim stigne 3D.

## Odluke vlasnika
- Stil blizak MMA Manageru, ali ne kopija. Krajnji proizvod je 3D.
- Likovi normalnih, atletskih proporcija, ne zdepasti.
- Redoslijed: HUD i efekti, zatim 3D borba (opcija A), zatim klub.
- Odobren prijedlog HUD-a i efekata u nastavku.

## Što se radi
- **Semafor kao TV traka unutar slike borbe** (zamjenjuje traku iznad slike):
  - lijeva i desna pločica s mjestom za portret u okviru boje pojasa, imenom, pojasom, velikim bodovima i A/K
  - energija kao traka od 10 segmenata: zelena, žuta ispod 50, crvena ispod 20 (iste granice kao sad)
  - sat i runda (i faza turnira) na nagnutoj jantarnoj pločici u sredini
  - greška, snaga i kondicija ostaju sitnije ispod imena (trebaju za testiranje)
- **Portret:** silueta u okviru boje pojasa dok ne stigne 3D model, tada prikaz glave modela.
- **Kartice kritičnog trenutka:**
  - deblje kartice s obojenim zaglavljem (napad, sweep, obrana, iste klase i boje kao sad), imenom tehnike, razinom u 10 točkica, detaljem (šansa ili opis) i brojem tipke 1–5
  - kartica koju predlaže osjećaj svijetli (i dalje s retkom „Osjećaj ti govori”)
  - traka odbrojavanja postaje crvena u zadnjoj trećini
- **Efekti (HTML sloj iznad canvasa):**
  - uspješna tehnika s bodovima ili završni submission: nagnuti natpis preleti preko slike (TAKEDOWN!, SWEEP!, PROLAZ!, MOUNT!, LEĐA!, TAP!)
  - kad se bodovi stvarno upišu (nakon 3 s držanja), uz semafor tog borca iskoči značka „+2”, „+3” ili „+4”
  - kod uspješnog rušenja i sweepa slika se kratko trese
  - uz `prefers-reduced-motion` nema tresenja ni preleta, natpis se samo pojavi i nestane
- **Tipografija:** Barlow Condensed (OFL) spremljen u projekt kao woff2, bez vanjskog učitavanja. Igra i dalje radi bez interneta i bez paketa.
- **Mobitel:** HUD se sažme (manji portreti, ime se skraćuje), kartice idu jedna ispod druge kao sad, bez horizontalnog scrolla.

## Što se ne radi
- Novi 2D borci i prasak na mjestu kontakta (ovisi o položaju boraca, dolazi s 3D-om).
- Promjene pravila, enginea i loga.

## Ograničenja
- `src/engine` se ne mijenja. UI čita `fight.lastAction`, `fight.score` i `fight.ended` koje već postoje.
- Bez novih ovisnosti i build koraka.

## Ostavljeno izvođaču
- Točne veličine, razmaci i animacijske krivulje.
- Kako UI prepoznaje događaj za natpis (npr. novi `lastAction.seq` s `success === true` i vrstom akcije) i za značku (porast `score[w].pts`).
- Gdje se drži `pos-label` i poruka povratne informacije da se ne sudaraju s novim HUD-om.
