# Project Fourfold

Third-person fantasy akcijski RPG za desktop browser, smješten u svijet četiri elementa (vatra, voda, zemlja, zrak). Igrač stvara lika, bira element i Echo duha čuvara, pa kreće u avanturu u jednoj od četiri regije. Projekt se radi po GDD-u u fazama, a ovo je **faza 1 od 8** prvog igrivog vertical slicea.

**Status:** 🚧 u izradi (faza 1: kretanje, kamera, četiri regije, Tripo pipeline)

## Pokretanje

```bash
cd assassuto
npm install
npm run dev          # igra na http://localhost:5173
```

Ostale naredbe:

```bash
npm test             # jedinični testovi (Vitest): fizika, Tripo klijent, manifest, pipeline asseta
npm run e2e          # Playwright smoke test: naslovni ekran + sve 4 regije, screenshotovi u tools/e2e/out/
npm run build        # provjera tipova + produkcijski build u dist/
```

Korisni URL parametri: `?element=fire|water|earth|air` bira regiju, `&play` preskače naslovni ekran, `&body=masculine` bira tijelo, `&quality=low` isključuje sjene i bloom.

### Tripo modeli (3D likovi i stvorenja)

Svi 3D modeli nastaju u [Tripu](https://www.tripo3d.ai/). Dok model ne postoji, igra koristi proceduralni zamjenski model.

```bash
cp .env.example .env                     # upiši TRIPO_API_KEY (https://developers.tripo3d.ai/en/keys)
npm run assets:generate -- --dry-run     # plan i procjena kredita, ništa se ne šalje
npm run assets:generate -- --only player_feminine --anims phase1   # prvi test: jedan lik + 5 animacija (~105 kredita)
npm run assets                           # optimizira GLB-ove u public/assets/ i ažurira manifest za igru
```

Bez API ključa: `npm run assets:prompts` napravi `assets-src/TRIPO-PROMPTS.md` s gotovim promptovima za Tripo Studio. Izvezeni GLB spremi kao `assets-src/incoming/<id>/rigged.glb` (ili `base.glb`) i pokreni `npm run assets`.

## Što može (faza 1)

- Naslovni ekran s izborom elementa (koji određuje početnu regiju) i tijela, uz živi prikaz odabrane regije u pozadini.
- Četiri regije sa svojim terenom, nebom, paletom, vegetacijom i atmosferom: **Emberreach Canyons** (vatra, jug), **Glacemere Shores** (voda, sjever), **Thornwall Highlands** (zemlja, zapad) i **Galecrest Heights** (zrak, istok). Svaka ima elementalni shrine kao orijentir.
- Kretanje u trećem licu: hodanje, trčanje, sprint sa staminom, skok s buffer-om i coyote time-om, kolizija s drvećem i kamenjem, ograničenje strmine.
- Kamera iza ramena: miš (pointer lock), zoom kotačićem, izbjegavanje terena, FOV efekt pri sprintu.
- Stilizirani izgled: toon sjenčanje s rim svjetlom, trava i krošnje na vjetru, anime nebo s oblacima, magla, bloom i meke sjene.
- Ženski lik je pravi Tripo model (anime stil, rig, animacije idle/walk/run/jump/fall). Muški lik je zasad proceduralni zamjenski model u bojama odabranog elementa.
- Tripo pipeline: manifest svih ~20 asseta, API skripta (model, rig, animacije), optimizacija GLB-ova i automatska zamjena placeholdera pravim modelom.
- HUD: stamina, naziv regije pri ulasku, kontrole (H), debug (F3), pauza (Esc).

## Kontrole

| Tipka | Radnja |
| --- | --- |
| W A S D | kretanje |
| miš / kotačić | kamera / zoom |
| Shift | sprint |
| Ctrl ili C | hodanje |
| Space | skok |
| H, F3, Esc | pomoć, debug, pauza |

## Kako je napravljeno

- **TypeScript + Three.js + Vite**, prema GDD-u. Bez game enginea i bez fizičkog enginea. Kretanje je kinematička kapsula nad heightfieldom s cilindričnim colliderima, što je za ovu fazu jednostavnije i potpuno predvidljivo. Sučelje `CollisionWorld` dopušta da se kasnije ubaci Rapier.
- **Odvojeni slojevi** (GDD 17): `core/` (petlja s fiksnim korakom od 60 Hz, EventBus, Time s timeScaleom za kasniji slow-mo), `config/` (sve brojke za igrača, kameru, elemente i regije), `input/` (akcije umjesto tipki), `physics/`, `world/`, `render/`, `animation/`, `entities/`, `ui/` i `assets/`. Logika igrača ne zna kakav se model prikazuje.
- **Prikaz lika preko sučelja `CharacterView`**: `PlaceholderHumanoid` (proceduralni) ili `GltfCharacter` (Tripo GLB s AnimationMixerom). Igra sama bira GLB ako postoji u `public/assets/manifest.runtime.json`.
- **Tripo umjesto gotovih asset paketa**, na vlasnikov zahtjev. Koristi se Tripo REST API v3. Biped likovi se riggaju modelom `v1.0-20240301` jer on ima 90+ preset animacija (slash, chop, box, kick, cast_a_spell, hug, hit reakcije, dive…), dok noviji `v3.0` ima samo 11. To je ključno za combat i Guardian's Embrace u kasnijim fazama. Animacije su "in place" jer kretanje radi kod. Retarget prima najviše 5 animacija po pozivu, a skripta pamti napredak u `.tripo-state.json` da se ništa ne plati dvaput.
- **Teren, nebo, trava i drveće su proceduralni** (shaderi i instancing), a ne Tripo, jer to daje veće i lakše svjetove. Tripo služi za likove, stvorenja, oružje i ključne propse.
- Fontovi Cinzel i Nunito Sans dolaze s Google Fontsa. Bez mreže igra koristi sistemske fontove.

## Struktura

```
assassuto/
├── index.html
├── src/
│   ├── core/        Game (orkestracija), FixedLoop, EventBus, Time, math
│   ├── config/      player, camera, elements, regions — sve podesive vrijednosti
│   ├── input/       InputManager, akcije i tipke
│   ├── physics/     CharacterMotor (kapsula, skok, kolizije, strmina)
│   ├── world/       Heightfield, Region (teren, voda, propsi, trava, shrine), CollisionGrid, noise
│   ├── render/      Renderer (post-processing), CameraRig, Atmosphere, SkyDome, ToonMaterials
│   ├── animation/   CharacterView, PlaceholderHumanoid, GltfCharacter
│   ├── entities/    Player, Stamina, Appearance
│   ├── assets/      AssetRegistry, runtime manifest
│   └── ui/          TitleScreen, Hud
├── assets-src/
│   ├── manifest.json        svi Tripo asseti: promptovi, rig, animacije
│   └── TRIPO-PROMPTS.md     generirani promptovi za ručni rad u Tripo Studiju
├── public/assets/           optimizirani GLB-ovi + manifest.runtime.json (čita ga igra)
├── tools/
│   ├── tripo/       API klijent, generate, prompts, mapiranje clipova
│   ├── assets/      optimize (gltf-transform: WebP teksture ≤1k, meshopt)
│   └── e2e/         Playwright smoke test
└── tests/           Vitest testovi
```

## Moguća poboljšanja

Plan faza 2–8 nalazi se u [`PROGRESS.md`](PROGRESS.md): kreator lika i save, combat, elementalne sposobnosti, Echo i Guardian's Embrace, stvorenja i mountovi, tutorial i zvuk.
