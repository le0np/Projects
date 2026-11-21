# Project Fourfold

Third-person fantasy akcijski RPG za desktop browser, smješten u svijet četiri elementa (vatra, voda, zemlja, zrak). Igrač stvara lika, bira element i Echo duha čuvara, pa kreće u avanturu u jednoj od četiri regije. Projekt se radi po GDD-u u fazama. Gotove su **faze 1–4 od 8** prvog igrivog vertical slicea.

**Status:** 🚧 u izradi (faza 4/8: elementalne sposobnosti, Archer i Brute, shrineovi, otkrića i putovanje među regijama)

## Pokretanje

```bash
cd assassuto
npm install
npm run dev          # igra na http://localhost:5173
```

Ostale naredbe:

```bash
npm test             # jedinični testovi (Vitest): fizika, save, Tripo, pipeline, borba, sposobnosti, strijele, AI
npm run e2e          # Playwright: izbornik → kreator → intro → igra → save/continue → borba → sposobnost, Archer, Brute → shrine, waystone, putovanje → sve 4 regije; screenshotovi u tools/e2e/out/
npm run build        # provjera tipova + produkcijski build u dist/
```

Za razvoj: `?play&element=fire|water|earth|air` preskače izbornik i kreira testnog lika (prepisuje save!), `&body=masculine` bira tijelo, `?quality=low` isključuje sjene i bloom.

### Tripo modeli (3D likovi i stvorenja)

Svi 3D modeli nastaju u [Tripu](https://www.tripo3d.ai/). Dok model ne postoji, igra koristi proceduralni zamjenski model.

```bash
cp .env.example .env                     # upiši TRIPO_API_KEY (https://developers.tripo3d.ai/en/keys)
npm run assets:generate -- --dry-run     # plan i procjena kredita, ništa se ne šalje
npm run assets:generate -- --only player_feminine --anims phase1   # jedan lik + 5 animacija (~105 kredita)
# promjena prompta NE pokreće ponovno generiranje bez --regenerate (zaštita kredita)
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
- **Borba** (GDD 8):
  - Napadi: lagani (LMB/J) i teški (RMB/K), s combo grafom (L-L-L, L-L-H lansira neprijatelja, L-H široki zamah, H-H rušenje) i input bufferom od 0,25 s. Napad u zraku, kratki iskorak u napad, pomoć pri ciljanju.
  - **S oružjem lik koristi samo oružje** (zamasi mačem ili kopljem), nikad šake ni noge. **Bez oružja** (tipka 3, ili X za spremanje i vađenje oružja) bori se rukama i nogama: direkt, kroše, udarac nogom i salto-udarac. Taj stil je brži i jeftiniji, ali ima kraći doseg i manju štetu. Promjena oružja usred napada izvrši se čim napad završi.
  - Obrana: izmicanje (C/Alt) s i-frameovima, blok (Q) koji troši staminu i može se slomiti, te perfect parry (Q tik prije udarca) koji usporava vrijeme i otvara counter.
  - Neprijatelji imaju poise: kad se slomi, postaju ranjivi i dobiju zlatni prsten, a F pokreće finisher s kinematografskim kadrom.
  - Lock-on (Tab/srednji klik), hitstop, tresenje kamere, iskre u boji elementa, brojevi štete, brojač udaraca i ward štit pri bloku.
  - Tri stila (1 mač, 2 koplje, 3 bez oružja) s drukčijim dosegom, lukom i combom.
  - Igrač ima zdravlje. Nakon poraza vraća se na shrine, a kamp se resetira.
- **Elementalne sposobnosti** (GDD 7). R baca odabranu sposobnost, a V mijenja element. Početni element je otključan od početka i ima "affinity": 20 % više štete i 20 % kraći cooldown. Ostali se otključavaju na shrineu svoje regije.
  - **Ember Burst** (vatra): eksplozija oko igrača ruši neprijatelje i pali ih (šteta kroz vrijeme).
  - **Tidal Surge** (voda): val u stošcu ispred igrača odbacuje neprijatelje, prekida im napade, usporava ih na pola brzine i ispire strijele u letu.
  - **Stone Aegis** (zemlja): udarni val i kameni oklop na 7 s. Dok traje, igrač prima pola štete i ne može se zateturati ni srušiti.
  - **Gale Step** (zrak): nalet od 9 m kroz neprijatelje, nedodirljiv za vrijeme naleta. Pogođene reže i podiže u zrak. Radi i u skoku.
  - Cooldowni se prikazuju u HUD-u (dolje desno) i spremaju u save kao preostalo vrijeme igre.
- **Tri vrste neprijatelja** (GDD 10), svi na Tripo modelu Raidera, pa nisu trebali dodatni krediti:
  - **Dune Raider**: uravnotežen borac s mačem.
  - **Raider Archer**: drži 8–15 m razmaka i puca strijele najavljene bljeskom. Strijela se može blokirati ili izbjeći, a perfect parry je vraća strijelcu s dvostrukom štetom. Kad mu igrač priđe, otkotrlja se unazad. Lako se slomi.
  - **Ironhide Brute**: velik, spor, ima super armor (udarci ga ne prekidaju) i jedva se pomiče od udaraca. Udarac o tlo je **neblokirajući**: najavljuje ga crveni bljesak i crveni krug na tlu, pa ga treba izbjeći.
- **Shrine** u svakoj regiji (E kad si blizu):
  - **Attune** bilježi otkriće i uči sposobnost elementa te regije. Nakon toga iz shrinea kreće svjetlosni stup vidljiv preko cijele regije.
  - **Rest** vraća zdravlje, staminu i sposobnosti te sprema igru.
  - **Journey** vodi u bilo koju od četiri regije. Igrač stiže na spawn kraj tamošnjeg shrinea.
- **Waystoneovi**: u svakoj regiji su 3 elementalna obilježja (Ember Brazier, Frost Lantern, Rune Monolith, Wind Chime), raštrkana 26–66 m od spawna. Kad im igrač priđe, upale se, jednom vrate zdravlje i sposobnosti, pokažu natpis i spreme se kao otkriće.
- **Raider kamp** u svakoj regiji: šatori, sanduci i logorska vatra, s dva Raidera, Archerom i Bruteom. AI ih vodi kroz stanja: lutanje, primjećivanje, prilaz, kruženje i napad. Odjednom napada najviše jedan borac izbliza i jedan strijelac. Napad najavljuju bljeskom na oštrici (znak za parry), reagiraju na stagger, rušenje i ranjivost, a vraćaju se kući ako igrač pobjegne. Kamp se obnavlja kad ga igrač napusti.
- Četiri regije sa svojim terenom, nebom, paletom, vegetacijom i atmosferom: **Emberreach Canyons** (vatra, jug), **Glacemere Shores** (voda, sjever), **Thornwall Highlands** (zemlja, zapad) i **Galecrest Heights** (zrak, istok). Svaka ima elementalni shrine kao orijentir.
- Kretanje u trećem licu: hodanje, trčanje, sprint sa staminom, skok s buffer-om i coyote time-om, kolizija s drvećem i kamenjem, ograničenje strmine.
- Kamera iza ramena: miš (pointer lock), zoom kotačićem, izbjegavanje terena, FOV efekt pri sprintu.
- Stilizirani izgled: toon sjenčanje s rim svjetlom, trava i krošnje na vjetru, anime nebo s oblacima, magla, bloom i meke sjene.
- Oba lika (ženski i muški) i Raider su Tripo modeli s rigom i animacijama. Ženski lik ima 20 animacija (kretanje i borba), muški 5 (samo kretanje), Raider 10.
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
| C ili Alt | izmicanje |
| LMB / J | lagani napad |
| RMB / K | teški napad |
| Q (držati) / L | blok, tik prije udarca parry |
| Tab ili srednji klik | lock-on |
| F | finisher (kad je neprijatelj "BROKEN") |
| 1 / 2 / 3 | mač / koplje / bez oružja |
| X | spremi ili izvadi oružje |
| R | elementalna sposobnost |
| V | promjena elementa |
| E | shrine (attune, odmor, putovanje) |
| H, F3, Esc | pomoć, debug, pauza |

## Kako je napravljeno

- **TypeScript + Three.js + Vite**, prema GDD-u. Bez game enginea i bez fizičkog enginea. Kretanje je kinematička kapsula nad heightfieldom s cilindričnim colliderima, što je za ovu fazu jednostavnije i potpuno predvidljivo. Sučelje `CollisionWorld` dopušta da se kasnije ubaci Rapier.
- **Odvojeni slojevi** (GDD 17): `core/` (petlja s fiksnim korakom od 60 Hz, EventBus, Time s timeScaleom za kasniji slow-mo), `config/` (sve brojke za igrača, kameru, elemente i regije), `input/` (akcije umjesto tipki), `physics/`, `world/`, `render/`, `animation/`, `entities/`, `ui/` i `assets/`. Logika igrača ne zna kakav se model prikazuje.
- **Prikaz lika preko sučelja `CharacterView`**: `PlaceholderHumanoid` (proceduralni) ili `GltfCharacter` (Tripo GLB s AnimationMixerom). Igra sama bira GLB ako postoji u `public/assets/manifest.runtime.json`.
- **Tripo umjesto gotovih asset paketa**, na vlasnikov zahtjev. Koristi se Tripo REST API v3. Biped likovi se riggaju modelom `v1.0-20240301` jer on ima 90+ preset animacija (slash, chop, box, kick, cast_a_spell, hug, hit reakcije, dive…), dok noviji `v3.0` ima samo 11. To je ključno za combat i Guardian's Embrace u kasnijim fazama. Animacije su "in place" jer kretanje radi kod. Retarget prima najviše 5 animacija po pozivu, a skripta pamti napredak u `.tripo-state.json` da se ništa ne plati dvaput.
- **Save je nepovjerljiv ulaz**: `sanitizeSave` svako polje provjerava i ograničava, pa pokvaren ili ručno izmijenjen save nikad ne sruši igru. Migracije idu verziju po verziju (`save/SaveManager.ts`), a backend je sučelje (`SaveBackend`) kako bi se kasnije mogao dodati cloud. Cooldowni se spremaju kao preostalo vrijeme igre.
- **Kosa na Tripo modelu**: Tripo daje jedan mesh s jednom teksturom, a kosa dijeli tamnoplavu boju s čarapama i rukavicama. Zato prebojavanje traži oba uvjeta: težinu kostiju glave i trupa (preko vertex atributa iz skin weighta) i plavu boju teksela. Tako se noge, rukavice i čizme ne diraju. Postavke su u `config/characters.ts`.
- **Toon sjenčanje Tripo modela**: PBR materijal (metalness 1) zamijenjen je toon materijalom s istom teksturom i normal mapom, da lik vizualno pripada stiliziranom svijetu.
- **Borba je čista logika odvojena od prikaza**: `AttackRunner` (combo graf, hit prozori, cancel točke), `Combatant` (zdravlje, poise, stanja), `resolveHit` (i-frameovi, parry, blok, guard break, stagger, rušenje, ranjivost, smrt i kuka `preventDeath` za Guardian's Embrace) i `AttackTokens` (red napadača) pokriveni su testovima. Sve brojke su u `config/combat.ts` i `config/enemies.ts`. Animacije se vremenski skaliraju na trajanje iz konfiguracije, pa izgled ne mijenja balans.
- **Sposobnosti su podatak, a ne kod po elementu**: `config/abilities.ts` drži sve brojke, a `combat/Abilities.ts` (otključano, odabrano, cooldowni, affinity) i `combat/Status.ts` (gorenje i usporenje) čista su logika pokrivena testovima. Igrač samo javi da je sposobnost aktivirana (`abilityEvent`), a `CombatDirector` je primijeni na svijet. Tako gameplay i efekti ostaju odvojeni.
- **Strijele** (`combat/Projectiles.ts`) lete s gravitacijom i pod-koracima, pa brza strijela ne može proletjeti kroz tijelo. Pogađaju samo suprotnu stranu, a parry ih prebaci na stranu igrača.
- **Archer i Brute bez novih Tripo kredita** (odluka vlasnika: krediti se čuvaju). Oba koriste Raiderov model i animacije, uz drugu visinu, širinu, boju i proceduralno oružje (luk, buzdovan). Napinjanje luka koristi početak `chop` clipa, a izmicanje `dive`. Kad se jednom generiraju `enemy_archer` i `enemy_brute`, dovoljno je promijeniti `assetId` u `config/enemies.ts`.
- **Putovanje među regijama ide preko shrinea.** Svijet je zasad četiri zasebne regije, a ne jedna povezana mapa. Bez putovanja se ostali elementi ne bi mogli otkriti, a ovo je najjednostavnije rješenje koje to omogućuje.
- **Shrine propsi i waystoneovi su proceduralni** dok se ne generiraju Tripo propsi iz manifesta (`prop_shrine`, `prop_fire_brazier`…).
- **Mač u ruci**: na Tripo kosturu `R_Hand` ima +Y niz prste i +Z prema naprijed. Oštrica je zato zakrenuta na +Z (`gripPose` u `combat/WeaponModels.ts`), što je izmjereno u igri. Oružje je zasad proceduralno dok se ne generiraju Tripo `weapon_sword` i `weapon_spear`.
- **Teren, nebo, trava i drveće su proceduralni** (shaderi i instancing), a ne Tripo, jer to daje veće i lakše svjetove. Tripo služi za likove, stvorenja, oružje i ključne propse.
- Fontovi Cinzel i Nunito Sans dolaze s Google Fontsa. Bez mreže igra koristi sistemske fontove.

## Struktura

```
assassuto/
├── index.html
├── src/
│   ├── core/        Game (orkestracija), FixedLoop, EventBus, Time, math
│   ├── config/      player, camera, elements, regions, creator, echo, characters, combat, enemies, abilities, discovery — sve podesive vrijednosti
│   ├── input/       InputManager, akcije i tipke
│   ├── physics/     CharacterMotor (kapsula, skok, kolizije, strmina)
│   ├── world/       Heightfield, Region (teren, voda, propsi, trava, shrine, waystoneovi, kamp), CollisionGrid, noise
│   ├── render/      Renderer (post-processing), CameraRig (lock-on, shake), Atmosphere, SkyDome, ToonMaterials, SpiritMaterial, Fx, AbilityFx
│   ├── animation/   CharacterView, PlaceholderHumanoid, GltfCharacter, characterFactory, SpiritCreatures
│   ├── entities/    Player, Enemy (+ AI), Stamina, Appearance, EchoView
│   ├── assets/      AssetRegistry, runtime manifest
│   ├── combat/      AttackRunner, Combatant, resolveHit, InputBuffer, CombatDirector, WeaponModels, Abilities, Status, Projectiles
│   ├── ai/          AttackTokens
│   ├── save/        SaveSchema (+ sanitizacija), SaveManager (migracije, backend), Settings, restore
│   └── ui/          MainMenu, CharacterCreator, IntroOverlay, SettingsPanel, CreditsPanel, Hud, CombatHud (+ traka sposobnosti), ShrinePanel
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

Plan faza 5–8 nalazi se u [`PROGRESS.md`](PROGRESS.md): Echo i Guardian's Embrace, stvorenja i mountovi, tutorial, progresija i zvuk.
