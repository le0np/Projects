# Istraživanje tržišta, niša, gameplay i MVP za objavu — 27. 11. 2026.

Autor: QA/PM agent. Brojke su iz javnih izvora navedenih u tablici. Mnoge su procjene trećih strana (Sensor Tower, AppGoblin, SteamDB, Semrush) i tako ih treba čitati. „n/p” znači da broj nije pronađen.

**Ovo je prijedlog za vlasnika.** Dijelovi koji mijenjaju smjer igre (link sobe bez registracije, Discord, streamer način) idu developeru tek kad ih vlasnik odobri.

---

## 1. Sažetak u 5 rečenica

1. Postoji velika potražnja za „apsurdnim životom u nekoliko minuta”: BitLife ima 58 mil. instalacija na Androidu, a Tomodachi Life 8,8 mil. prodanih primjeraka.
2. Postoji i velika potražnja za „životom u gradu s prijateljima”: Brookhaven RP na Robloxu imao je 1,3 mil. igrača istovremeno.
3. Kratke društvene igre (Among Us, Gartic Phone, Jackbox, Liar's Bar) su pune, ali **sve su apstraktne** (crtanje, karte, glasanje) i nijedna ne simulira život.
4. **Prazno mjesto je: kratka (10 min) društvena igra u kojoj nastane priča o cijelom životu, s otkrivanjem tko ti je pomogao, a tko te izdao.** To naša igra već gotovo jest.
5. Najveći rizik nije igra nego **igrači**: javni lobbyji umiru, pa su ključni link za privatnu sobu (za grupu prijatelja) i botovi s osobnošću.

---

## 2. Dvadeset sličnih igara

| # | Igra | Platforma i zarada | Veličina | Partija | Igrači | Što igrači vole | Na što se žale | Pouka za nas |
|---|---|---|---|---|---|---|---|---|
| 1 | **BitLife** | mobitel, besplatno + reklame + kupnje | 58,4 mil. instalacija na Androidu ([AppGoblin](https://appgoblin.info/apps/com.candywriter.bitlife)); do ~$497 tis./tjedan u SAD-u 2025. ([Sensor Tower](https://sensortower.com/blog/2025-q2-unified-top-5-simulator%20games-revenue-us-60416e41241bc16eb8905c2f)) | 5–30 min | sam | apsurdni crni humor, cijeli život u minutama | nametljive reklame, plaćeni zidovi ([Game Brain](https://gamebrain.co/game/bitlife-life-simulator)) | Potražnja je dokazana; mi dodajemo **druge ljude**. Bez nametljivih reklama. |
| 2 | **Reigns** | mobitel/PC, plaća se | 600 tis. prodanih u mjesec dana ([MCV](https://mcvuk.com/business-news/premium-mobile-title-reigns-passes-600000-sales/)) | 5–15 min | sam | jasni izbori, duhovit tekst, smrt kao poanta | ponavljanje karata | 2 izbora su dovoljna ako je tekst oštar; eventi trebaju varijante. |
| 3 | **Sort the Court** | browser/itch.io | n/p (napravljena za 72 h) | 30–60 min | sam | šarm, jednostavnost | brzo dosadi | Browser + da/ne + čudan gradić može postati kultna igra bez budžeta. |
| 4 | **The Sims 4** | PC/konzole, osnovna igra besplatna + DLC | 85 mil. igrača (2024.) ([VGC](https://videogameschronicle.com/news/the-sims-4-now-reaches-over-70-million-players-according-to-ea)) | sati | sam | karijere, rutine, veze | skupi dodaci, greške | Univerzalna fantazija; mi je sažimamo na 10 min i radimo društvenom. |
| 5 | **Tomodachi Life: Living the Dream** | Switch, plaća se | 8,83 mil. prodanih (2026.) ([Nintendo Wire](https://nintendowire.com/news/2026/08/06/tomodachi-life-living-the-dream-sells-over-8-million-copies-according-to-latest-sales-report/)) | 10–30 min | sam, ali likovi su tvoji prijatelji | gledati prijatelje u apsurdnim situacijama, snimke zaslona | malo utjecaja | **Najjači signal 2026.:** apsurdni životi ljudi koje znaš. Kod nas ti prijatelji stvarno igraju. |
| 6 | **Animal Crossing: NH** | Switch, plaća se | 50,6 mil. ([Nintendo IR](https://www.nintendo.co.jp/ir/en/finance/software/switch.html?pubDate=20250802)) | 20–60 min dnevno | sam + posjeti | ugodan gradić, ritual | sporo | Grad kao diorama je omiljen okvir; naš preokret je crni humor. |
| 7 | **Stardew Valley** | sve platforme, plaća se | 41 mil.+ ([Game Developer](https://gamedeveloper.com/business/stardew-valley-sales-grew-to-over-41-million-by-2024-s-end)) | sati | sam/zajedno | mještani s osobnošću | spor početak | Botovi trebaju osobnost, ne samo popunjavati mjesta. |
| 8 | **RimWorld** | PC, plaća se | 1 mil. do 2018. ([Ludeon](https://ludeon.com/blog/2018/01/one-million-copies-sold)) | sati | sam | priče koje igrači prepričavaju | složenost | „Pripovjedač” koji dozira drame je srce igre (naš direktor eventa). |
| 9 | **Crusader Kings III** | PC/konzole, plaća se | 4 mil. (2025.) ([Paradox](https://www.paradoxinteractive.com/media/press-releases/paradox-interactive/crusader-kings-iii-passes-four-million-sales)); igrači 45 % češće ubijaju nego se zaljube ([PC Gamer](https://www.pcgamer.com/crusader-kings-3-celebrates-3-years-with-stats-showing-were-45-more-likely-to-do-a-murder-than-fall-in-love)) | mnogo sati | sam | spletke, tajne, izdaje | teško za naučiti | Igrači **žele** spletke; naše spletke i osveta su pravi mamac. |
| 10 | **Jackbox Party Packs** | PC/konzole, plaća se; mobitel kao upravljač | 200 mil. igrača (2020., [Wikipedia](https://en.wikipedia.com/wiki/Jackbox_Party_Pack)); publika do 10 000 | 10–20 min | u sobi + stream | bez učenja, odlično za streamere | treba domaćin koji je kupio igru | Kod sobe, ulaz iz bilo kojeg browsera, način za publiku. |
| 11 | **Town of Salem 1 i 2** | browser → Steam | ~7 mil. registriranih (2019.); ToS2 samo nekoliko stotina igrača istovremeno ([SteamDB](https://steamdb.info/app/2140510/charts)) | 10–20 min | 15 | dedukcija, uloge | igrači koji odustanu, prazni lobbyji nakon prelaska na plaćeno | Browser igra može doći do milijuna; prelazak na plaćeni Steam ju je smanjio. |
| 12 | **Among Us** | mobitel besplatno / PC plaća se | ~500 mil. mjesečnih igrača (studeni 2020., [GameSpot](https://www.gamespot.com/articles/among-us-reportedly-has-biggest-month-ever-for-active-users-in-a-game/1100-6485759/)) | 10–15 min | 4–15 | blefiranje, streameri | hakeri, prazni javni lobbyji | Viralno kroz streamere, ali javni lobbyji propadaju → privatne sobe + botovi. |
| 13 | **Goose Goose Duck** | PC/mobitel, besplatno + kozmetika | 800 tis. istovremeno (2023., [Game Developer](https://gamedeveloper.com/business/-i-goose-goose-duck-i-reaches-800-000-concurrent-players)) | 10–15 min | 4–16 | besplatno, puno uloga | rast zbog jednog slavnog streamera | Jedan veliki streamer može 10× povećati igru; kozmetika radi. |
| 14 | **Gartic Phone** | browser, besplatno + reklame | ~2,45 mil. posjeta (procjena, [Semrush](https://nl.semrush.com/website/garticphone.com/overview)) | 10–20 min | 4–30 | **smiješna reprodukcija na kraju** | reklame, trolovi | Završna reprodukcija je proizvod; naš Life Recap je ista stvar. |
| 15 | **skribbl.io** | browser, besplatno + reklame | ~7,2 mil. posjeta/mj. (procjena, [Semrush](https://www.semrush.com/website/skribbl.io/overview/)) | 10–20 min | 2–12 | link za privatnu sobu | trolovi u javnim sobama | Link za privatnu sobu je standard za Discord grupe. |
| 16 | **Blood on the Clocktower** (+ Secret Hitler) | društvena igra + web | n/p | 60–90 min | 5–20 | skrivene informacije, pripovjedač | treba vješt pripovjedač, dugo traje | Mi pripovjedača automatiziramo i skraćujemo na 10 min. |
| 17 | **Wolvesville** | mobitel/Steam, besplatno + kupnje | 322 istovremeno na Steamu ([SteamDB](https://steamdb.info/app/2502760/charts)) | 10–15 min | do 16 | brze partije | toksičnost | Klonovi „Vukodlaka” su prepuno tržište: **ne predstavljati se kao igra dedukcije.** |
| 18 | **Liar's Bar** | Steam, $6,99 | ~113 tis. istovremeno (2024., [App2top](https://app2top.com/news/the-peak-online-presence-for-liar-s-bar-on-steam-exceeded-100-000-people-272846.html)); sada ~500–1 100 | 5–15 min | 4 | crni humor + prijatelji + kratke runde | malo sadržaja, brz pad | **Najbliži po tonu.** Crni humor + 4 prijatelja = hit 2024.; zadržavanje traži puno sadržaja. |
| 19 | **Brookhaven RP** (Roblox) | Roblox, besplatno + kupnje | 1,3 mil. istovremeno (2025., [RoWatcher](https://rowatcher.com/news/brookhaven-rp-12-million-concurrent-players-record)) | bez kraja | masovno | glumljenje života u gradu s prijateljima | „dosadno, nema cilja” ([Common Sense](https://www.commonsensemedia.org/website-reviews/brookhaven-rp/)) | Dokaz da ljudi masovno žele „život u gradu s prijateljima”; njihova slabost (nema strukture ni kraja) je naša snaga. |
| 20 | **Welcome to Bloxburg** (Roblox) | Roblox, bio plaćen, besplatan od 2024. | n/p | dugo | više igrača | „Sims na Robloxu” | grind | Prelazak na besplatno proširio je publiku. |

Kontekst platformi: igranje uloga (roleplay) je najveći žanr na Robloxu (~116 mil. posjeta dnevno, [Newzoo](https://gamedevreports.substack.com/p/newzoo-roblox-as-a-platform-in-2025)); Poki ima 100 mil.+ mjesečnih igrača ([Poki](https://poki.com/blog/state-of-web-gaming-report-2026)); Discord ima 200 mil.+ mjesečnih korisnika, a 25 %+ koristi „Activities” (igre unutar poziva) ([Gigazine](https://gigazine.net/gsc_news/en/20240927-discord-new-monetization-feature)).

---

## 3. Karta tržišta

|  | **Kratka partija (5–15 min)** | **Duga igra (sati)** |
|---|---|---|
| **Sam** | BitLife, Reigns, Sort the Court — puno | Sims, Stardew, RimWorld, CK3, Animal Crossing, Tomodachi — puno, divovi |
| **S drugima** | Among Us, Jackbox, Gartic, skribbl, Town of Salem, Liar's Bar — puno, ali **sve apstraktno** | Brookhaven, Bloxburg — Roblox, mlađa publika, bez kraja |

**Prazno polje:** kratko + s drugima + **priča o životu koja nastaje sama**. Nitko ne nudi „cijeli život zajedno u 10 minuta, s recapom tko ti je pomogao, a tko te izdao”.

---

## 4. Niša

**„BitLife za tvoju grupu prijatelja”** — 10-minutna igra u browseru za grupe prijatelja od 18 do 30 godina koja na kraju da smiješnu priču o svima, spremnu za dijeljenje.

- **Kada se igra:** u Discord pozivu („još jednu”), na streamu, u pauzi za ručak, kao zagrijavanje prije duže igre.
- **Zašto je postojeće igre ne pokrivaju:** BitLife i Reigns su samo za jednog; u Tomodachi Life su prijatelji lutke; Brookhaven nema strukturu i namijenjen je mlađima; party igre su apstraktne; CK3 i RimWorld traju satima.

### Dvije tipične osobe (persone)

- **„Dina s Discorda”, 19–26:** ima server s 4–8 prijatelja, igraju Gartic, Jackbox, Among Us, Liar's Bar. Kao tinejdžerica igrala je BitLife. Želi nešto od 10 minuta nakon čega svi rade snimke zaslona. Nalazi se na Discordu, TikToku i Redditu (r/BitLife, r/jackboxgames).
- **„Mali streamer Sam”, 18–30:** do 500 gledatelja, treba igre u kojima sudjeluje chat. Nalazi se na Twitchu, YouTube Shorts, itch.io i CrazyGames/Poki.

### Rizici (iskreno)

1. **Nema dovoljno igrača.** Javni lobbyji propadaju ili postanu toksični. → Link za privatnu sobu i dobri botovi nisu opcija, nego obaveza.
2. **Botovi moraju biti zabavni.** Ako je igra s botovima prazna, igrač će radije igrati BitLife. Naši botovi već imaju osobnost i spletke, što je dobra osnova.
3. **Teško je biti primijećen.** Na portalima s web igrama 99 % vremena odlazi na jednostavne i puzzle igre ([PocketGamer.biz](https://www.pocketgamer.biz/report-hypercasual-and-puzzle-games-dominate-the-browser-gaming-space/)). Priča za više igrača tamo je iznimka.
4. **Nagli rast pa pad.** Liar's Bar i Goose Goose Duck pali su 90 %+ od vrha. Zadržavanje igrača ovisi o količini sadržaja (eventi, karijere, spletke).
5. **Kopije na Robloxu.** Ako ideja uspije, lako se kopira. Naša zaštita su kvalitetan tekst i ton za odrasle.
6. **Crni humor na portalima** namijenjenim i djeci možda neće proći. → Treba „blagi” način.
7. **Rok od 15–35 s** može prekinuti razgovor u pozivu. → Domaćin sobe bira duljinu roka.

---

## 5. Definicija gameplaya (jezgra igre)

**U jednoj rečenici:** 4–8 prijatelja (ili botova) za 10 minuta prožive 16 godina u malom gradu, odlučuju jedni o drugima, kuju spletke, a na kraju dobiju recap tko je kome pomogao i tko je koga izdao.

**Petlja jedne partije:**
1. **Ulaz:** domaćin pošalje link, prijatelji uđu bez registracije, odaberu ime i karijeru; prazna mjesta popune botovi.
2. **Život (8–10 min):** likovi sami žive rutinu; eventi se događaju na mapi; odlučuješ u 15–35 s; drugi odlučuju o tebi.
3. **Tvoja inicijativa:** spletke (plan → priprema → izvršenje), a dok čekaš, pogađaš tuđe odluke.
4. **Napetost:** gradski preokret oko 65 %, zatim finale za sve.
5. **Otkrivanje:** recap jedan po jedan („Tko ti je ispuhao gume 2031.?”), titula života, kartica za dijeljenje.
6. **„Još jednu”:** ista soba, isti ljudi, nova partija jednim klikom.

**Što NE radimo** (dosljedno ranijim odlukama vlasnika): upravljanje figuricom, stalne tajne uloge kao u Among Us, pobjednik, dug život kao cilj, „igra dedukcije” u marketingu.

---

## 6. Prijedlog MVP-a za objavu

MVP (minimalni proizvod) ovdje znači **najmanju verziju koju ima smisla pokazati pravim igračima izvan ovog projekta**. Igra je tehnički skoro spremna; nedostaje ono što dovodi i zadržava grupe prijatelja.

### Mora biti (MVP)

| # | Što | Zašto | Stanje |
|---|---|---|---|
| M1 | **Link za privatnu sobu** („Create room” → link; prijatelji ulaze odmah) | tako igraju Discord grupe (skribbl, Gartic); javni lobbyji propadaju | ❌ novo |
| M2 | **Ulaz kao gost** (samo ime, bez emaila i lozinke) | svaki korak registracije gubi igrače; račun ostaje opcija | ❌ novo |
| M3 | **Domaćin bira duljinu roka** (normalno / opušteno ×1,5 / bez roka) i trajanje sesije (5 / 8 / 10 min) | razgovor u pozivu ne smije biti prekinut | ❌ novo |
| M4 | **Recap s otkrivanjem, titulom i „Copy my life”** | proizvod koji se dijeli (Wordle, Gartic) | 🔶 u izradi (T11) |
| M5 | **„Play again” s istom sobom** | „još jedna” je glavni pokazatelj uspjeha | ❌ novo |
| M6 | **Osobni ciljevi** | razlog da igraš drukčije svaki put | 🔶 u izradi (T10) |
| M7 | **Javno postavljena igra** (jedan server, domena, HTTPS) | bez toga nema pravih igrača | ❌ novo (treba vlasnikova odluka o hostingu) |
| M8 | **Osnovna mjerenja** (bez osobnih podataka): broj partija, završene partije, klik na „Copy my life”, „Play again” | da znamo radi li | ❌ novo |

### Poslije MVP-a (po prioritetu)

1. **Discord Activity** (igra unutar Discord poziva): najbolji kanal za ciljanu publiku, ali traži prijavu aplikacije kod Discorda.
2. **Način za streamere/publiku**: gledatelji pogađaju i glasaju za botove.
3. **Paketi sadržaja**: novi eventi, karijere i spletke (mogući budući izvor prihoda).
4. **Blagi način** za portale (CrazyGames, Poki).
5. **Kozmetika** (odjeća, izgled recapa). **Nikad nametljive reklame** (najveća pritužba na BitLife).

### Kako znamo da MVP radi (cilj za prvih 100 partija s pravim ljudima)

| Mjera | Cilj |
|---|---|
| Partije igrane do kraja | ≥ 80 % |
| Grupe koje odmah igraju još jednu | ≥ 40 % |
| Igrači koji kliknu „Copy my life” | ≥ 25 % |
| Prosječno ljudi po sobi | ≥ 3 |

---

## 7. Odluke za vlasnika

1. **Prihvaćaš li nišu „BitLife za grupu prijatelja”** (prvo privatne sobe, javni matchmaking drugi)? Moja preporuka: **da**, jer to izravno rješava najveći rizik (nema igrača).
2. **Smijemo li uvesti ulaz kao gost** (M2) uz postojeće račune? Preporuka: **da**.
3. **Hosting za javnu verziju** (M7): treba odlučiti gdje i tko plaća. Preporuka: najjeftiniji jedan server s ugrađenom bazom (PGlite) za početak.
4. **Discord Activity** odmah nakon MVP-a ili kasnije? Preporuka: odmah nakon MVP-a, ako prvih 100 partija pokaže ≥ 40 % „još jednu”.

Kad vlasnik odobri, QA/PM će M1–M3, M5 i M8 napisati kao Sprint 4 u `INSTRUCTIONS_FOR_AGENT.md`.
