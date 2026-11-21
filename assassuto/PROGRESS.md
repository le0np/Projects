# Napredak projekta Project Fourfold

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Faze 1–4 od 8 su gotove. Igra ima glavni izbornik, kreator lika u 6 koraka s 3D previewom, intro cinematic, kretanje u četiri regije, verzionirano spremanje i borbu. Borba obuhvaća combo napade, izmicanje, blok i parry s counterom, lock-on, finisher, mač, koplje i borbu bez oružja. Faza 4 je dodala četiri elementalne sposobnosti, Archera i Brutea uz Raidere u kampu, shrineove (attune, odmor, putovanje među regijama) i 3 waystonea po regiji. Oba lika i Raider su Tripo modeli. Archer i Brute koriste Raiderov model. Echo je zasad vizualni duh s osnovnim praćenjem. Ostalo je 275 Tripo kredita, a vlasnik ih zasad čuva: sve se testira sa ženskim likom.

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

### Faza 3: borba (20. studenoga 2026.)

**Tripo generiranje** (vlasnik je odobrio muški lik, Raidera i borbene animacije):
- `player_masculine`: model, rig i 5 animacija kretanja, 105 kredita. Izgleda odlično i stilski prati ženski lik.
- `enemy_raider`: model, rig i 10 animacija (idle, walk, run, slash, chop, hurt, hit_to_body_01, fall_down, dive, angry), 155 kredita. Proporcije su malo "chibi", ali je to prihvatljivo za neprijatelja.
- `player_feminine`: borbene animacije. **Greška u skripti**: fingerprint asseta uključivao je cijeli `defaults` iz manifesta, pa je ranije dodani `yawOffset` pokrenuo ponovno generiranje modela i riga. Potrošeno je 255 umjesto ~150 kredita, a ženski lik je sada **novi model** (kosa do ramena, sličan kaput, stilski bliži muškom liku). Prijenos animacija na stari kostur provjeren je i ne radi, jer Tripo retarget ovisi o kosturu (odstupanje do 30° ostaje i nakon korekcije rest poze). Zato je zadržan novi model sa svih 20 animacija. Stari model postoji u gitu (commit `6d4447f`).
- Popravak: fingerprint (`hashSpec` u `tools/tripo/manifest.ts`) sada uključuje samo polja koja mijenjaju generirani model. Kad se ona promijene, skripta asset preskoči i traži `--regenerate`. Dodan je regresijski test.
- Kredit: 790 → 275.

**Kod:**
- `config/combat.ts`: mač (10 napada: L1–L3, H1, HH, LH udarac nogom, LLH lansiranje, zračni napad, counter, finisher) i koplje (veći doseg, uži luk). Tu su i postavke izmicanja, bloka, parryja, staggera, finishera, lock-ona i pomoći pri ciljanju. `config/enemies.ts`: Raider i AI postavke.
- Čista logika borbe pokrivena testovima: `AttackRunner`, `InputBuffer`, `Combatant`, `resolveHit` i `AttackTokens`. Kuka `preventDeath` je pripremljena za Guardian's Embrace i ne okida na DoT.
- `Player` s borbom: buffer, chain, stamina po napadu, iskorak, okretanje prema meti, izmicanje s i-frameovima, blok (sporije kretanje, stamina ne regenerira), counter prozor nakon parryja, oružja 1 i 2.
- `Enemy` s AI-em: lutanje oko kampa, primjećivanje (animacija "angry"), prilaz, kruženje na udaljenosti uz traženje tokena, napad s bljeskom na oštrici prije udarca, reakcije (stagger, rušenje, ranjivost, smrt) i povratak kući uz liječenje.
- `CombatDirector`: kamp, lock-on, finisher (scripted pozicioniranje, slow-mo, bočna kamera), pogoci u oba smjera (parry, blok, guard break, izmicanje, pogodak, smrt), razdvajanje tijela i obnova kampa. Efekti su iskre, prstenovi, bljesak napada, prsten ranjivosti i ward štit.
- `CombatHud`: zdravlje igrača i oružje, trake neprijatelja nad glavama, lock reticle, oznaka finishera, brojač udaraca, brojevi štete i ekran poraza. Poraz vraća igrača na shrine i resetira kamp.
- Igra: hitstop i slow-mo preko `Time.timeScale` (kamera i UI ostaju glatki), Echo se skloni tijekom finishera, a oružje se sprema u save.
- Kamp Raidera u svakoj regiji: deterministički izbor ravnog mjesta 34–48 m od spawna, sa šatorima, sanducima i logorskom vatrom (svjetlo koje treperi).
- Mač u ruci Tripo lika: osi kosti šake izmjerene su u igri (+Z naprijed), a smjer oštrice potvrđen je brojčano.
- Prebojavanje kose generalizirano je na chroma key po modelu (`config/characters.ts`): ženski lik ima tamnoplavu kosu, a muški tamnosmeđu. Za oba je ključna boja izmjerena iz teksela vezanih uz kost glave.

### Oružje i borba bez oružja (20. studenoga 2026.)

- Vlasnik je primijetio da lik s mačem udara šakom (jab). Sada vrijedi pravilo: **s oružjem samo oružje**. Mač i koplje koriste isključivo Tripo zamahe (`slash`, `chop`) s različitim dijelovima clipa i tempom, a dotadašnji jab-ovi (`box_01`/`box_02`) i udarac nogom u combu mača zamijenjeni su zamasima. Test `weapon styles` to provjerava za svaki napad.
- Novi stil **Unarmed** (`fists` u `config/combat.ts`): tipka 3, a X sprema ili vadi zadnje oružje. Oružje se tada skida iz ruke. Napadi su direkt, kroše, udarac nogom, salto-udarac koji lansira, counter šakom i finisher saltom, uz kraći doseg, manju štetu i manji trošak stamine.
- Promjena oružja usred napada stavlja se u red i izvrši čim napad završi. Oružje se sprema u save (`equipment.weapon`).

### Faza 4: sposobnosti, Archer i Brute, otkrića (20. studenoga 2026.)

**Odluke:**
- Vlasnik: **krediti se čuvaju**, a sve se testira sa ženskim likom. Zato nema novih Tripo modela. Archer i Brute koriste Raiderov model s drugim proporcijama, bojom (tint materijala), širinom i proceduralnim oružjem. Shrine propsi i waystoneovi su proceduralni.
- GDD nije u repou, pa su detalji sposobnosti izvedeni iz opisa elemenata u kreatoru: vatra je eksplozivna, voda kontrolira, zemlja brani, zrak je pokretljivost. Sve brojke su u `config/abilities.ts`.
- Putovanje među regijama ide preko shrinea (Journey), jer bez njega ostali elementi ne bi bili dostupni. Igrač stiže na spawn ciljne regije. Spremaju se save, cooldowni i otkrića.

**Sposobnosti** (R baca, V mijenja, HUD dolje desno s cooldownom):
- Ember Burst (radijus 4,8 m, rušenje, gorenje 5 dps / 4 s), Tidal Surge (stožac 9 m, odbacivanje, usporenje 50 % / 5 s, prekida napade, ispire strijele), Stone Aegis (udarni val i 7 s oklopa: pola štete, bez staggera i rušenja), Gale Step (nalet 9 m s i-frameovima, reže i podiže, radi i u zraku).
- Affinity početnog elementa: ×1,2 šteta, ×0,8 cooldown. Cooldowni se spremaju kao `ability.<element>` u `SaveData.cooldowns`, a odabrani element u `equipment.ability`. Format je samo nadograđen, pa nije trebala migracija (sanitizer daje zadanu vrijednost).
- `Combatant` je dobio `damageTaken` i `armored`. `resolveHit` ih koristi, a DoT više nikad ne uzrokuje stagger.
- Efekti (`render/AbilityFx.ts`): vatrena kupola i plameni jezici, val, kameni krhotine oko igrača, tragovi naleta, crveni krug upozorenja i strijele.

**Neprijatelji:**
- `EnemyDef` ima `role`, `look`, `knockbackTaken` i `radius`, a napad `projectile`, `aoe` i `unblockable`.
- Archer: AI drži razmak, ima posebne tokene za strijelce (najviše jedan puca odjednom), kotrlja se unazad kad mu igrač priđe (cooldown 4 s) i puca s predviđanjem kretanja. Parry vraća strijelu (×2 šteta, oznaka "RETURNED").
- Brute: super armor, 20 % knockbacka, sweep i neblokirajući slam u području (crveni bljesak i krug na tlu).
- Soaked status usporava i kretanje i napade. Burning ispušta iskre.
- Kamp ima 4 mjesta: dva Raidera oko vatre, Archer na rubu prema spawnu i Brute uz vatru.

**Otkrića:**
- `config/discovery.ts` sadrži id-ove `shrine:<regija>` i `waystone:<regija>:<i>` te imena waystoneova po elementu.
- Shrine (E unutar 6,5 m) otvara `ShrinePanel` koji pauzira simulaciju i otpušta pointer lock. Attune bilježi otkriće, uči element (ako je nov odmah ga odabere) i pali svjetlosni stup. Rest liječi, puni sposobnosti i sprema. Journey nudi sve 4 regije.
- Waystoneovi: deterministički raspoređeni po sektorima, 26–66 m od spawna, dalje od kampa i shrinea, na suhom i ravnom terenu, s čistinom bez drveća. Pale se kad im igrač priđe (3,2 m), uz banner i liječenje.

**Ostalo:**
- e2e: `findChromium` sada pretražuje i `PLAYWRIGHT_BROWSERS_PATH` (u ovom okruženju je Chromium u `/opt/pw-browsers`).
- `tools/scratch/` (u `.gitignore`) služi za jednokratne skripte za screenshotove.

## Zadnja automatizirana provjera

Provedeno 20. studenoga 2026. (nakon faze 4):

| Provjera | Rezultat |
| --- | --- |
| `npx tsc --noEmit` | bez grešaka |
| `npm test` | 59/59 prolazi (motor 6, save i postavke 9, Tripo 9, pipeline 1, borba 18, faza 4: 16 za sposobnosti, status, strijele, aegis i super armor, AI Archera, usporenje i save sposobnosti) |
| `npm run e2e` | 46/46 prolazi: izbornik → kreator → intro → igra → save/continue (odstupanje 0,00 m) → borba i finisher → kamp ima Raidere, Archera i Brutea → R podiže Stone Aegis i pokreće cooldown → Archer puca → Brute napada → prompt kraj shrinea, E otvara shrine, attune bilježi otkriće → waystone se pali → putovanje u Emberreach, attune uči Ember Burst, V mijenja element, otkrića ostaju sačuvana → sve 4 regije, bez console grešaka |
| Ručno u pregledniku (Playwright skripte) | Sve četiri sposobnosti pogađaju neprijatelje (šteta, rušenje, usporenje, nalet od 9 m). Efekti su vidljivi, strijela pogađa igrača (160 → 148), Brute nanosi štetu, shrine panel i putovanje rade, waystoneovi su vidljivi u sve 4 regije (upaljeni i neupaljeni) |
| `npm run build` | prolazi |

Usput uočeno i popravljeno: Gale Step nije pomicao igrača (ograničenje ubrzanja u motoru), a Archerova strijela mogla je prekinuti finisher (finisher je sada nedodirljiv). Uz to se gubio pritisak na F ako je igrača u tom trenutku pogodio neprijatelj. F sada ima buffer od 0,4 s (`combatConfig.finisher.buffer`), a e2e ponavlja F dok je oznaka vidljiva.

## Poznata ograničenja

- Archer i Brute koriste Raiderov Tripo model i animacije. Napinjanje luka je početak `chop` clipa, pa ne izgleda kao pravo gađanje lukom. Luk je u desnoj ruci, a Archer nema tobolac.
- Muški lik ima samo animacije kretanja. U borbi i pri bacanju sposobnosti koristi proceduralne zamjene, pa izgleda slabije. Borbene animacije za njega koštaju ~150 kredita (krediti se čuvaju, testira se sa ženskim likom).
- Tripo animacije nisu rađene za mač (slash i chop su udarci bez oružja), pa zamasi nisu savršeno usklađeni s oštricom.
- Echo, oružje, shrine i waystoneovi su proceduralni (Tripo propsi iz manifesta nisu generirani).
- Regije nisu povezane u jedan svijet. Putuje se preko shrinea, uz učitavanje regije.
- Kamera ne izbjegava drveće (samo teren), pa je ponekad zaklanja deblo. Oko waystoneova je zato čistina od 8 m.
- Tripo nema preset animacije za avian rig, a quadruped ima samo `walk`. Animacije stvorenja i mountova bit će dijelom proceduralne.
- Svaki Tripo lik ima samo jednu frizuru. Dodatne frizure trebaju zasebne Tripo meshe kose (krediti).
- Headless Chromium sa softverskim GL-om vrti igru na nekoliko FPS-a, pa e2e koristi polling i traje nekoliko minuta. Na pravom GPU-u igra je glatka.
- XP od neprijatelja i otkrića se još ne troši (progresija je u fazi 7).

## Sljedeći koraci

1. Vlasnik isproba fazu 4: osjećaj sposobnosti (brojke su u `config/abilities.ts`), težinu Archera i Brutea, raspored waystoneova.
2. Faza 5: Echo (pametnije praćenje, kontekstualni dijalog, Spirit Ward, Guardian's Embrace preko kuke `preventDeath`). Echo može komentirati otkrića (događaji `discovered` i `elementUnlocked` već postoje).
3. Faza 6: bond sustav i stvorenja, ground mount, flying mount u Sky Trialu.
4. Faza 7: tutorial, progresija (XP iz `enemyKilled` i otkrića), zvuk i polish. Faza 8: završna provjera.
5. Kad se krediti odobre: `enemy_archer` i `enemy_brute` (promijeniti `assetId`), Tripo propsi i borbene animacije za muški lik.

## Handoff za novi chat

1. Kod je u `assassuto/`, grana `dev`. Prvo pročitaj ovaj dokument, `README.md` i plan u GDD-u (vlasnik ga je poslao u chatu: "PROJECT FOURFOLD Game Design Document v1.0").
2. Pokretanje: `npm install && npm run dev`. Testovi: `npm test`, `npm run e2e` (screenshotovi u `tools/e2e/out/`), `npm run build`.
3. Tripo: prije svakog generiranja pokreni `--dry-run`, a stanje kredita provjeri prije i poslije (`--balance`). Nikad ne pokreći `--regenerate` bez dogovora s vlasnikom.
4. Faza 4: sposobnosti su u `config/abilities.ts` i `combat/Abilities.ts`, a efekte primjenjuje `CombatDirector.applyAbility`. Neprijatelji su u `config/enemies.ts` (`campRoster` određuje sastav kampa), a otkrića u `config/discovery.ts` i `Game.updateDiscovery`.
5. Važne granice: gameplay ne dira Three.js direktno, nego ide preko `CharacterView`, `CollisionWorld` i EventBusa. Sve brojke idu u `src/config/`. Tekst u igri je na engleskom. 3D modeli dolaze samo iz Tripa (bez Quaterniusa ili drugih paketa), preko `assets-src/manifest.json`. Tajne idu samo u `.env`.
