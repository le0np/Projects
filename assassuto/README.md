# Project Fourfold

Third-person fantasy akcijski RPG za desktop browser, smješten u svijet četiri elementa (vatra, voda, zemlja, zrak). Igrač stvara lika, bira element i Echo duha čuvara, pa kreće u avanturu u jednoj od četiri regije. Projekt se radi po GDD-u u fazama. Gotove su **faze 1 i 2 od 8** prvog igrivog vertical slicea.

**Status:** 🚧 u izradi (faza 2/8: izbornik, kreator lika, Echo, spremanje igre)

## Pokretanje

```bash
cd assassuto
npm install
npm run dev          # igra na http://localhost:5173
```

Ostale naredbe:

```bash
npm test             # jedinični testovi (Vitest): fizika, save sustav, Tripo klijent, manifest, pipeline asseta
npm run e2e          # Playwright: izbornik → kreator → intro → igra → spremi → nastavi + sve 4 regije; screenshotovi u tools/e2e/out/
npm run build        # provjera tipova + produkcijski build u dist/
```

Za razvoj: `?play&element=fire|water|earth|air` preskače izbornik i kreira testnog lika (prepisuje save!), `&body=masculine` bira tijelo, `?quality=low` isključuje sjene i bloom.

### Tripo modeli (3D likovi i stvorenja)

Svi 3D modeli nastaju u [Tripu](https://www.tripo3d.ai/). Dok model ne postoji, igra koristi proceduralni zamjenski model.

```bash
cp .env.example .env                     # upiši TRIPO_API_KEY (https://developers.tripo3d.ai/en/keys)
npm run assets:generate -- --dry-run     # plan i procjena kredita, ništa se ne šalje
npm run assets:generate -- --only player_feminine --anims phase1   # prvi test: jedan lik + 5 animacija (~105 kredita)
npm run assets                           # optimizira GLB-ove u public/assets/ i ažurira manifest za igru
```

Bez API ključa: `npm run assets:prompts` napravi `assets-src/TRIPO-PROMPTS.md` s gotovim promptovima za Tripo Studio. Izvezeni GLB spremi kao `assets-src/incoming/<id>/rigged.glb` (ili `base.glb`) i pokreni `npm run assets`.

## Što može

- **Glavni izbornik**: New Game, Continue (prikazuje ime, element, regiju i vrijeme igranja), Settings, Credits. Iza izbornika polako kruži kamera nad regijom zadnjeg savea.
- **Kreator lika u 6 koraka** (GDD 12) s live 3D previewom na platou shrinea (povlačenjem se lik okreće):
  1. Izgled: tijelo, dob, visina, građa, frizura, boja kose. Na Tripo modelu visina i građa rade preko kostiju, a kosa se prebojava shaderom samo na kosi. Starijim likovima kosa posijedi.
  2. Ime, s provjerom i prijedlozima.
  3. Element.
  4. Echo upitnik: ime, odnos, osobnost, oblik duha (čovjek, vuk, ptica), boja, sjećanje ili lekcija, priroda veze. Echo se odmah pojavljuje u previewu.
  5. Početna regija: preporučena po elementu, ali se može promijeniti.
  6. Sažetak.
- **Intro cinematic** (~15 s, preskače se sa Space, Enter ili Esc): široki kadar regije, Echo se materijalizira uz igrača i izgovara replike ovisne o osobnosti, a na kraju se prikazuje sjećanje koje je igrač upisao.
- **Spremanje** (GDD 14): verzionirani JSON u localStorageu, autosave svake minute, ručno spremanje u pauzi, spremanje pri izlasku i zatvaranju taba. Continue vraća igrača na ispravnu poziciju (ako je pozicija nevaljana, na spawn). Postavke se spremaju zasebno.
- **Pauza** (Esc): Resume, Save game, Settings, Save & quit. **Postavke**: glasnoća (zvuk dolazi kasnije), osjetljivost miša, invertiranje Y osi, kvaliteta grafike (mijenja se odmah), prikaz kontrola.
- Echo prati igrača sa strane (s obzirom na kameru) i ne zaklanja pogled. Ovo je osnovno praćenje, a puno ponašanje dolazi u fazi 5.
- Četiri regije sa svojim terenom, nebom, paletom, vegetacijom i atmosferom: **Emberreach Canyons** (vatra, jug), **Glacemere Shores** (voda, sjever), **Thornwall Highlands** (zemlja, zapad) i **Galecrest Heights** (zrak, istok). Svaka ima elementalni shrine kao orijentir.
- Kretanje u trećem licu: hodanje, trčanje, sprint sa staminom, skok s buffer-om i coyote time-om, kolizija s drvećem i kamenjem, ograničenje strmine.
- Kamera iza ramena: miš (pointer lock), zoom kotačićem, izbjegavanje terena, FOV efekt pri sprintu.
- Stilizirani izgled: toon sjenčanje s rim svjetlom, trava i krošnje na vjetru, anime nebo s oblacima, magla, bloom i meke sjene.
- Ženski lik je pravi Tripo model (anime stil, rig, animacije idle/walk/run/jump/fall, toon sjenčanje). Muški lik je zasad proceduralni zamjenski model u bojama odabranog elementa.
- Tripo pipeline: manifest svih ~20 asseta, API skripta (model, rig, animacije), optimizacija GLB-ova i automatska zamjena placeholdera pravim modelom.
- HUD: stamina, naziv regije pri ulasku, kontrole (H), debug (F3), pauza (Esc).
- Tripo pipeline: manifest asseta, generiranje preko API-ja, optimizacija GLB-ova.

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
- **Save je nepovjerljiv ulaz**: `sanitizeSave` svako polje provjerava i ograničava, pa pokvaren ili ručno izmijenjen save nikad ne sruši igru. Migracije idu verziju po verziju (`save/SaveManager.ts`), a backend je sučelje (`SaveBackend`) kako bi se kasnije mogao dodati cloud. Cooldowni se spremaju kao preostalo vrijeme igre.
- **Kosa na Tripo modelu**: Tripo daje jedan mesh s jednom teksturom, a kosa dijeli tamnoplavu boju s čarapama i rukavicama. Zato prebojavanje traži oba uvjeta: težinu kostiju glave i trupa (preko vertex atributa iz skin weighta) i plavu boju teksela. Tako se noge, rukavice i čizme ne diraju. Postavke su u `config/characters.ts`.
- **Toon sjenčanje Tripo modela**: PBR materijal (metalness 1) zamijenjen je toon materijalom s istom teksturom i normal mapom, da lik vizualno pripada stiliziranom svijetu.
- **Teren, nebo, trava i drveće su proceduralni** (shaderi i instancing), a ne Tripo, jer to daje veće i lakše svjetove. Tripo služi za likove, stvorenja, oružje i ključne propse.
- Fontovi Cinzel i Nunito Sans dolaze s Google Fontsa. Bez mreže igra koristi sistemske fontove.

## Struktura

```
assassuto/
├── index.html
├── src/
│   ├── core/        Game (orkestracija), FixedLoop, EventBus, Time, math
│   ├── config/      player, camera, elements, regions, creator, echo, characters — sve podesive vrijednosti
│   ├── input/       InputManager, akcije i tipke
│   ├── physics/     CharacterMotor (kapsula, skok, kolizije, strmina)
│   ├── world/       Heightfield, Region (teren, voda, propsi, trava, shrine), CollisionGrid, noise
│   ├── render/      Renderer (post-processing), CameraRig, Atmosphere, SkyDome, ToonMaterials
│   ├── animation/   CharacterView, PlaceholderHumanoid, GltfCharacter, characterFactory, SpiritCreatures
│   ├── entities/    Player, Stamina, Appearance, EchoView
│   ├── assets/      AssetRegistry, runtime manifest
│   ├── save/        SaveSchema (+ sanitizacija), SaveManager (migracije, backend), Settings, restore
│   └── ui/          MainMenu, CharacterCreator, IntroOverlay, SettingsPanel, CreditsPanel, Hud
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

Plan faza 3–8 nalazi se u [`PROGRESS.md`](PROGRESS.md): combat, elementalne sposobnosti, Echo i Guardian's Embrace, stvorenja i mountovi, tutorial i zvuk.
