# Napredak projekta Project Fourfold

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Faze 1 i 2 od 8 su gotove. Igra ima glavni izbornik, kreator lika u 6 koraka (izgled, ime, element, Echo, regija, sažetak) s 3D previewom, intro cinematic, kretanje u četiri regije i verzionirano spremanje s nastavkom igre. Ženski lik je pravi Tripo model (prilagodljive visine, građe i boje kose). Muški lik je još proceduralni placeholder. Echo je zasad vizualni duh s osnovnim praćenjem.

## Napravljeno 20. studenoga 2026.

### Plan i odluke

- Vlasnik je poslao GDD (Project Fourfold v1.0). Dogovoreno je da igra ide u mapu `assassuto/` i da se vertical slice radi u 8 faza. Nakon faze 1 stajemo radi pregleda izgleda i osjećaja igre.
- **Modeli idu kroz Tripo, ne Quaternius** (odluka vlasnika). Asseti se generiraju preko Tripo API-ja s ključem u `.env`, a ručni rad u Tripo Studiju ostaje kao alternativa.
- Tripo API v3 je provjeren u službenoj dokumentaciji (developers.tripo3d.ai). Endpointi su po operaciji (`/generation/text-to-model`, `/animations/rig`, `/animations/retarget`, `/tasks/{id}`), URL-ovi rezultata brzo istječu, a retarget prima do 5 animacija po pozivu.
- Rig `v1.0-20240301` za biped likove: 90+ preset animacija naspram samo 11 kod `v3.0`. Combat animacije koje ni tamo ne postoje radit će se u kodu na istom kosturu.

### Faza 1: kostur igre i asset pipeline

- Vite + TypeScript (strict) + Three.js projekt s Vitestom i Playwrightom.
- Jezgra: petlja s fiksnim korakom od 60 Hz i interpolacijom prikaza, tipizirani EventBus, `Time` s timeScaleom.
- Ulaz preko akcija (rebind je samo promjena konfiguracije), pointer lock, edge-triggered pritisci koji se ne gube između koraka.
- `CharacterMotor`: ubrzanje i kočenje, gravitacija, skok s bufferom (0,15 s) i coyote time-om (0,12 s), cilindrični collideri sa slide-om, ograničenje strmine, granica svijeta.
- Četiri regije iz konfiguracije: heightfield (simplex fbm, grebeni, zaravan oko spawna, planinski obod), vertex-color teren, voda, instancirani propsi (hrast, bor, breza, stijena, bazaltni šiljak, kristal, stup, lebdeći otok), trava na vjetru, placeholder shrine sa svjetlećim kristalom elementa.
- Izgled: vlastito anime gradijent nebo s oblacima i IBL-om, toon materijali s rim svjetlom, low-contrast ramp za vegetaciju (bez crnih stražnjih strana), magla, bloom, sjene koje prate igrača.
- Kamera iza ramena: orbit mišem, zoom, kolizija s terenom, FOV boost pri sprintu.
- `PlaceholderHumanoid` (anime proporcije, šal i pojas u boji elementa, mač na leđima) s proceduralnim idle/hod/trk/sprint/skok/pad/doskok animacijama. `GltfCharacter` za Tripo modele (crossfade i usklađivanje brzine koraka).
- Tripo pipeline: `assets-src/manifest.json` (21 asset po fazama, zajednički stilski sufiks, negative prompt), `tools/tripo/client.ts`, `generate.ts` (dry-run s procjenom kredita, nastavak bez dvostrukog plaćanja, mapiranje clipova), `prompts.ts` (TRIPO-PROMPTS.md), `tools/assets/optimize.ts` (WebP teksture ≤1024, meshopt, runtime manifest).
- Naslovni ekran (privremen do faze 2) i HUD (stamina, banner regije, pomoć, debug, pauza).

### Prvi Tripo model (`player_feminine`)

- Vlasnik je uplatio 1000 API kredita. Stanje prije generiranja: 970 kredita (+30 zamrznutih od ranijeg zadatka), poslije: 790.
- Prema izvještajima zadataka: model 30, rig 25, retarget 5 animacija u jednom pozivu. Ukupan pad stanja je 180 kredita (uključujući ranije zamrznutih 30), što je više od procjene od ~105. Procjene u `--dry-run` zato treba shvatiti kao donju granicu.
- Rezultat: anime avanturistica u bijelom kaputu s kapuljačom, duga tamna kosa, 41 kost (Root, Hip, Pelvis, L_Thigh…). Clipovi su točno imenovani (`idle`, `walk`, `run`, `jump`, `fall`), pa mapiranje ide po imenu.
- Optimizacija: 9,9 MB → 0,66 MB model + 0,24 MB animacije.
- Ispravak: Tripo izvozi modele okrenute prema +X, a igra očekuje +Z. Zato je u manifestu dodan `defaults.yawOffset = -π/2` za sve Tripo modele.

### Faza 2: izbornik, kreator lika, Echo, save (20. studenoga 2026.)

- Vlasnik je odobrio fazu 2. Krediti se nisu trošili (790 ostaje), a pitanje o daljnjem generiranju je još otvoreno.
- **Save sustav** (`src/save/`): `SaveData` v1 sadrži sve iz GDD 14 (lik, Echo, tutorial, pozicija, progresija, oprema i oružja, stvorenja i bond, mount, cooldowni, otkrića, zastavice). Sekcije za kasnije faze već postoje pa se format samo nadograđuje. Uz to idu `sanitizeSave`, lanac migracija, `SaveBackend` (localStorage, memorija za testove), meta podaci (tutorial jednom završen) i postavke kao zaseban ključ. `resolveLoadPosition` vraća igrača na sigurnu poziciju.
- **Glavni izbornik** s potvrdom prije prepisivanja postojećeg savea, **Settings** (primjena odmah, kvaliteta bez reloada) i **Credits**.
- **Kreator lika** (`ui/CharacterCreator.ts`) sa 6 koraka i validacijom imena (slova, razmaci, apostrof, crtica, 2–18 znakova). Promjene se odmah vide u previewu: lik stoji na platou shrinea odabrane regije, a promjena elementa ili regije mijenja svijet iza njega.
- **Prilagodba Tripo lika** (`GltfCharacter.applyAppearance`): visina preko skaliranja modela, građa preko kostiju trupa i udova (animacije nemaju scale trake pa to ostaje sačuvano), boja kose shaderom s maskom iz skin weighta i plave boje teksela, te sijeda kosa iznad 45 godina. Toon materijal zamjenjuje metalni PBR. Teksture likova su 2k zbog bliskih kadrova (model 0,9 MB).
- **Echo** (`entities/EchoView.ts`): spirit materijal (fresnel, aditivno, bloom) i čestice. Oblici su čovjek (placeholder humanoid bez mača), vuk i ptica (proceduralni, `SpiritCreatures.ts`), a boja se bira. Replike za intro ovise o osobnosti (`config/echo.ts`).
- **Intro cinematic**: kamera od širokog kadra do igrača, Echo se materijalizira, titlovi s imenima i upisanim sjećanjem, letterbox. Preskače se.
- **Pauza** sa spremanjem, autosave svake minute te spremanje pri izlasku u izbornik i zatvaranju taba.
- Echo prati igrača bočno u odnosu na kameru (GDD 6.1: ne zaklanja pogled), uz teleport ako zaostane više od 15 m.
- Sitnice: manji kristal shrinea, muški placeholder s jaknom umjesto suknje, Esc radi i kad preglednik ne otpusti pointer lock.

## Zadnja automatizirana provjera

Provedeno 20. studenoga 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npx tsc --noEmit` | bez grešaka |
| `npm test` | 24/24 prolazi (motor 6, save i postavke 9, Tripo klijent i manifest 8, pipeline 1) |
| `npm run e2e` | sve prolazi: izbornik (Continue onemogućen bez savea, settings, credits) → kreator (preview Tripo lika, boja kose, građa, muško tijelo, odbijeno prazno ime, Water → Glacemere, Echo vuk) → intro s titlovima → igra (Aria u Glacemereu s Echom, kretanje) → pauza i spremanje → izbornik (Continue prikazuje Ariu) → reload → Continue (ista pozicija, odstupanje 0,00 m) → sve 4 regije (spawn, skok, doskok, kretanje), bez console grešaka |
| `npm run build` | prolazi |
| GLB lik u igri | sintetički riggani GLB je prošao `optimizeAll` i animacija pomiče kost. Pravi Tripo `player_feminine` je učitan u igri (`view: gltf`), screenshotovi sprijeda, straga, u trku i skoku ispravni, bez console grešaka |
| `npm run e2e` s Tripo modelom | sve prolazi |
| `assets:generate --dry-run` | svi asseti ~1730 kredita (gornja procjena), prvi test ~105 kredita |

## Poznata ograničenja

- Generiran je samo `player_feminine` i to samo s 5 locomotion animacija. Combat animacije (slash, chop, box, kick, cast_a_spell, hug, hit reakcije…) još nisu retargetirane.
- Kosa i odjeća Tripo modela su prilično sjajni zbog PBR materijala. Materijal treba ugoditi prema toon izgledu u fazi 2 ili 7.
- Tripo nema preset animacije za avian rig, a quadruped ima samo `walk`. Animacije stvorenja i mountova bit će dijelom proceduralne.
- Kustomizacija frizure s Tripo modelima (zasebni meshevi kose na head boneu) još nije isprobana. Testira se u fazi 2 nakon prvog lika.
- Headless Chromium sa softverskim GL-om vrti igru na ~12 FPS-a, pa e2e test zbog toga koristi polling. Na pravom GPU-u igra je glatka.
- Za Tripo ženski lik postoji samo jedna frizura (ona koju je model dobio). Dodatne frizure trebaju zasebne Tripo meshe kose (krediti). Plave oči mogu dobiti malo nijanse boje kose jer su u istoj zoni i slične boje.
- Muški lik i Echo su proceduralni placeholderi dok se ne generiraju `player_masculine`, `echo_human`, `echo_wolf` i `echo_bird`.
- Headless e2e sa softverskim GL-om i Tripo modelom vrti se na nekoliko FPS-a, pa test koristi polling. Na pravom GPU-u to nije problem.

## Sljedeći koraci

1. Uz odobrenje vlasnika potrošiti preostale kredite (790) redom: combat animacije za `player_feminine` (nužno za fazu 3), zatim `player_masculine` i `enemy_raider`. Ostale modele raditi u kodu dok ne bude novih kredita.
2. Faza 3: combat jezgra (combo graf, hitboxovi, poise i stagger, dodge, block, parry, counter, finisher) i Raider s AI-em.
3. Faza 4: četiri elementalne sposobnosti, Archer i Brute, discovery na shrineovima, Tripo propsi.
4. Faza 5: Echo (pametnije praćenje, kontekstualni dijalog, Spirit Ward, Guardian's Embrace). Intro i osnovno praćenje su već napravljeni u fazi 2.
5. Faza 6: bond sustav i stvorenja, ground mount, flying mount u Sky Trialu.
6. Faza 7: tutorial, progresija, zvuk i polish. Faza 8: završna provjera.

## Handoff za novi chat

1. Kod je u `assassuto/`, grana `dev`. Prvo pročitaj ovaj dokument, `README.md` i plan u GDD-u (vlasnik ga je poslao u chatu: "PROJECT FOURFOLD Game Design Document v1.0").
2. Pokretanje: `npm install && npm run dev`. Testovi: `npm test`, `npm run e2e` (screenshotovi u `tools/e2e/out/`), `npm run build`.
3. Važne granice: gameplay ne dira Three.js direktno, nego ide preko `CharacterView`, `CollisionWorld` i EventBusa. Sve brojke idu u `src/config/`. Tekst u igri je na engleskom. 3D modeli dolaze samo iz Tripa (bez Quaterniusa ili drugih paketa), preko `assets-src/manifest.json`. Tajne idu samo u `.env`.
