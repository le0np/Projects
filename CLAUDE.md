# Upute za Claude

Ovaj repo je zbirka nepovezanih projekata koje vlasnik zamisli, a Claude izradi. Komunikacija s vlasnikom i dokumentacija su na hrvatskom; kod, imena datoteka i commit poruke na engleskom.

## Pravila

- Svaki projekt ide u vlastitu mapu u korijenu repoa: `<ime-projekta>/` (kebab-case, kratko i opisno). U korijenu su osim toga samo zajedničke datoteke (`README.md`, `CLAUDE.md`, `IDEJE.md`, `.gitignore`, `_template/`).
- Radi se na grani `dev`.
- Projekti su samostalni: vlastite ovisnosti, konfiguracija i `.gitignore` po potrebi. Nema dijeljenog koda između projekata.
- Svaki projekt ima `README.md` napravljen prema `_template/README.md` — obavezno s točnim, isprobanim naredbama za instalaciju i pokretanje.
- Nakon dodavanja projekta ili promjene njegovog statusa, ažuriraj tablicu u korijenskom `README.md`. Ako je ideja bila u `IDEJE.md`, makni je odande.
- Odluke koje vlasnik nije precizirao (tehnologija, struktura, dizajn) donesi sam, biraj jednostavnije rješenje i ukratko ih obrazloži u README-u projekta.
- Svaki projekt ima `PROGRESS.md` (trenutno stanje, kronološki popis napravljenog, zadnja provjera, poznata ograničenja, sljedeći koraci, handoff za novi chat). Nakon svake promjene projekta dopiši novi odjeljak i osvježi provjeru, ograničenja i sljedeće korake; važne ranije odluke se ne brišu.
- Prije nego projekt proglasiš gotovim, pokreni ga i provjeri da stvarno radi.
- Tajne (API ključevi, lozinke) nikad ne idu u repo; koristi `.env` i priloži `.env.example`.
