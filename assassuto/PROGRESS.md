# Napredak projekta Project Fourfold

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Faza 1 od 8 je gotova. Igra se pokreće u browseru, a igrač u stiliziranom 3D-u bira jednu od četiri regije i u njoj se kreće (trčanje, sprint, skok, kamera iza ramena). Lik je zasad proceduralni placeholder. Tripo pipeline je napravljen i testiran na sintetičkom modelu, ali nijedan pravi Tripo model još nije generiran jer `TRIPO_API_KEY` još nije upisan.

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

## Zadnja automatizirana provjera

Provedeno 20. studenoga 2026.:

| Provjera | Rezultat |
| --- | --- |
| `npx tsc --noEmit` | bez grešaka |
| `npm test` | 15/15 prolazi (motor 6, Tripo klijent i manifest 8, pipeline 1) |
| `npm run e2e` | sve prolazi: naslovni ekran i 4 regije (spawn na tlu, skok i doskok, kretanje, potrošnja stamine), bez console grešaka |
| `npm run build` | prolazi, JS 700 kB (187 kB gzip) |
| GLB lik u igri | sintetički riggani GLB je prošao `optimizeAll`, igra ga je učitala kao igrača (`view: gltf`) i animacija pomiče kost |
| `assets:generate --dry-run` | svi asseti ~1730 kredita (gornja procjena), prvi test ~105 kredita |

## Poznata ograničenja

- Nijedan pravi Tripo model još nije generiran, jer API ključ još nije upisan. Orijentaciju modela (`yawOffset`), imena clipova i kvalitetu riga treba provjeriti na prvom pravom modelu.
- Tripo nema preset animacije za avian rig, a quadruped ima samo `walk`. Animacije stvorenja i mountova bit će dijelom proceduralne.
- Kustomizacija frizure s Tripo modelima (zasebni meshevi kose na head boneu) još nije isprobana. Testira se u fazi 2 nakon prvog lika.
- Headless Chromium sa softverskim GL-om vrti igru na ~12 FPS-a, pa e2e test zbog toga koristi polling. Na pravom GPU-u igra je glatka.
- Naslovni ekran je privremen (faza 2 donosi pravi glavni izbornik i kreator lika).

## Sljedeći koraci

1. Vlasnik upisuje `TRIPO_API_KEY` u `assassuto/.env` i odobrava trošak. Zatim `npm run assets:generate -- --only player_feminine --anims phase1` i `npm run assets`, pa provjera izgleda, riga i animacija u igri.
2. Faza 2: glavni izbornik (New Game, Continue, Settings, Credits), kreator lika u 6 koraka s live 3D previewom, Echo upitnik, verzionirani save (localStorage).
3. Faza 3: combat jezgra (combo graf, hitboxovi, poise i stagger, dodge, block, parry, counter, finisher) i Raider s AI-em.
4. Faza 4: četiri elementalne sposobnosti, Archer i Brute, discovery na shrineovima, Tripo propsi.
5. Faza 5: Echo (praćenje, dijalog po osobnosti, Spirit Ward, Guardian's Embrace) i intro.
6. Faza 6: bond sustav i stvorenja, ground mount, flying mount u Sky Trialu.
7. Faza 7: tutorial, progresija, zvuk i polish. Faza 8: završna provjera.

## Handoff za novi chat

1. Kod je u `assassuto/`, grana `dev`. Prvo pročitaj ovaj dokument, `README.md` i plan u GDD-u (vlasnik ga je poslao u chatu: "PROJECT FOURFOLD Game Design Document v1.0").
2. Pokretanje: `npm install && npm run dev`. Testovi: `npm test`, `npm run e2e` (screenshotovi u `tools/e2e/out/`), `npm run build`.
3. Važne granice: gameplay ne dira Three.js direktno, nego ide preko `CharacterView`, `CollisionWorld` i EventBusa. Sve brojke idu u `src/config/`. Tekst u igri je na engleskom. 3D modeli dolaze samo iz Tripa (bez Quaterniusa ili drugih paketa), preko `assets-src/manifest.json`. Tajne idu samo u `.env`.
