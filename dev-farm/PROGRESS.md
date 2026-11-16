# Napredak projekta dev-farm

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Igra je igriva u browseru. Farmer se kreće po mapi 48×32 klikovima miša (brzinom kupaca) i radi sa šest alata (ruke, sjeme, kanta, gnojivo, pecaljka, malč); svaki radi biljku po biljku, povlačenjem miša preko polja ili, preko ▾, na cijelom polju, a ruke imaju i seriju berba → sadnja → zalijevanje. Svaki posao na parceli traje 1–2 s (traka napretka, farmer se sagne ili nagne kantu). Sadi, zalijeva, gnoji i bere, skuplja u šumi, peca, drži kokoši i pčele, a plodove prodaje na štandu uz cestu ili na tržnici u gradu (sam, ili kombijem i zaposlenikom). Usjevi rastu po danima (dan traje 10 minuta, rast svako jutro), uz kišu i prognozu. Kvaliteta ploda ima pet klasa (★ do ★★★★★) i ovisi o zalijevanju, gnojivu, berbi na vrijeme i oprašivanju. Novac su zlatnici i srebrenjaci s omjerima prema hrvatskim tržišnim cijenama. Na radnom stolu se izrađuju izumi i zgrade (bunar, kokošinjac, navodnjavanje, dron, replant.py, hladnjača, pecaljka, košnica, malč, Reklame i plakati, drugo polje), a gotovo sve ima nadogradnje (tablica `UPGRADES`; koraci 1 i 2 su gotovi). Web shop s laptopa u kući donosi online narudžbe koje se pakiraju na parkiralištu i nose na poštu (korak 3, prvi dio). Mobitel služi za obavijesti, Dostavu (web shop s brojačem, otkup, uređenje, ljubimac), honorarce i priručnik, a farmer u oblačiću govori što radi i što ne može. Sva grafika je pixel art generiran u kodu.

## Napravljeno 12. studenog 2026.

### v1 – prva verzija (`873b2e9`)

- igra u čistom HTML/CSS/JS (ES moduli), bez ovisnosti i build koraka; `npm start` pokreće mali Node server, `npm test` testove
- polje 3×3 s klikom na parcelu (sadi, zalij, poberi), 5 usjeva, IT izumi (water.sh, harvest-drone, replant.py, compost-cache, git clone polje)
- pravila igre izdvojena u čisti modul `src/sim.js` (bez DOM-a) i pokrivena `node --test` testovima
- spremanje u `localStorage`, naslov taba pokazuje zrele usjeve

### v2 – svijet po kojem se hoda (`36006aa`)

- mapa 48×32 (`src/world.js`): kuća, škrinja, štand, bunar, ribnjak, radni stol, dva polja po 48 parcela
- farmer hoda na klik (traženje puta), kupci dolaze cestom do štanda i kupuju
- kvaliteta ★–★★★★ prema zalijevanju, gnojivu i pravodobnoj berbi; trulež prezrelih plodova
- energija, kava, jedenje plodova; dan i noć (10 min), spavanje sprema igru, nesvjestica u 02 h
- izumi strojeva najviše daju ★★★, zlatna kvaliteta samo iz farmerovih ruku

### v3 – detaljniji pixel art (`0e21f7b`)

- grafika na 32 px po polju, generirana piksel po piksel (`src/pixel.js`, `src/art.js`): sjenčanje, dithering, selektivni obrisi, noise teksture
- organske staze, ribnjak s obalom, trskom i lopočima; kuća od brvana s crijepom, dimnjakom i škurama
- dubinsko sortiranje (farmer može iza drveta), dim, svjetlucanje vode, noćna svjetla i krijesnice, glatka kamera

### v4 – sjeme, bunar, oblačić, mobitel, zoom (`88b1163`)

- sjeme se broji i nije besplatno: ladica u kući, nalazišta na imanju (i nova svako jutro), sjeme iz plodova (2–10), dostava preko mobitela
- kupci kupuju i ★ robu, ali samo kad nema bolje; cijena ovisi o kvaliteti
- bunara nema na početku, voda je iz ribnjaka; prskalice traže bunar
- oblačić iznad farmera za njegove misli, mobitel za obavijesti i dostavu
- zoom gumbima, kotačićem i tipkama

### v5 – skupni poslovi (`41291eb`, `b531d2f`)

- Posadi ▾ / Poberi ▾ / Zalij ▾ s izbornikom (sve ili jedna vrsta); farmer sam obilazi polje, zalijevanje samo ide po vodu kad se kanta isprazni
- bunar: na radnom stolu samo plan, farmer ga zida na gradilištu (plaća se po završetku, prekida se odlaskom)
- navodnjavanje s 10 razina (4 do 56 parcela po prskalici) i prikaz dosega
- kupovno gnojivo prebačeno na mobitel (dostava u škrinju)
- glatki zoom oko farmera

### Preslagivanje repoa (`845c09f`)

- grana `claude/funny-tesla-p4jeuy` spojena u `dev` i obrisana; projekti premješteni u korijen repoa (`dev-farm/`, `pixel-runner/`)

### v6 – rast kroz dane i realne cijene (`ed75e56`)

- usjevi rastu svako jutro (cijeli dan ako su zaliveni, pola ako nisu); zemlja presuši preko noći, prskalice zalijevaju u 06 h; dovoljno je zaliti jednom dnevno
- zreo plod čeka danima: najbolji isti dan, svaki dan gubi kvalitetu, istrune četvrto jutro
- spavanje tek od 18 h (inače bi se dani preskakali)
- cijene po kg prema hrvatskim tržnicama, urod u kilogramima, novi usjevi kupus, blitva i batat
- format spremanja v4 s prijenosom starijih farmi

### v7 – ispravci (`1d2c44d`, `489c60b`)

- izbornik skupnih poslova zatvara se nakon odabira (CSS `[hidden]` bio je nadjačan)
- novac u zlatnicima i srebrenjacima (1 zl = 100 sr) s pixel novčićima u HUD-u
- kanta vraćena kao alat za zalijevanje pojedinačnih biljaka (tipka 3), gnojivo na tipki 4

### Dokumentacija napretka (`ff5e1e6`)

- dodan ovaj `PROGRESS.md`, pravilo o njemu u korijenskom `CLAUDE.md` i predložak `_template/PROGRESS.md`

### v8 – kanta s izbornikom

- kanta je razdvojeni gumb: klik na kantu uzme je za pojedinačno zalijevanje, a ▾ uz nju otvara izbornik „sve posađeno“ ili jedna vrsta (tipka Z i dalje zalije sve)
- odvojeni gumb „Zalij ▾“ uklonjen iz alatne trake
- dok zalijevanje traje, kanta pokazuje napredak („zalijeva 2/5“), a ▾ postaje ■ za prekid

### v9 – sjeme s izbornikom

- sjeme je razdvojeni gumb kao i kanta: klik na sjeme uzme ga za sadnju biljku po biljku (vrsta se bira u vrećici ispod), a ▾ uz njega posadi sve sjeme ili samo jednu vrstu (tipka P i dalje sadi sve)
- odvojeni gumb „Posadi ▾“ uklonjen; ostao je samo „Poberi ▾“
- dok sadnja traje, sjeme pokazuje napredak („sadi 3/9“), a ▾ postaje ■ za prekid

### v10 – jednostavnija alatna traka, štand uz cestu

- svi alati su razdvojeni gumbi: Ruke ▾ (berba jedne / svih ili jedne vrste), Sjeme ▾, Kanta ▾, Gnojivo ▾ (gnoji koliko ima vreća); gumb „Poberi ▾“ uklonjen, tipke B, P, Z, G pokreću „sve“
- alatna traka sada su samo četiri alata i vrećica sa sjemenom
- prazni panel desno se skriva; pojavljuje se samo kad je otvorena zgrada
- kraći natpis štanda u HUD-u (🏪 otvoreno / 🏪 08–19 h)
- štand premješten uz cestu (kraj glavne staze), kupci dolaze ravno s ceste

### v11 – šuma, kokošinjac i honorarci (zanimacija dok usjevi rastu)

- šuma: uz rub šume niču gljive, kupine, grane (drva) i kamenje; 8 na početku (4 blizu kuće), 3–5 novih svako jutro, najviše 14; branje troši 1 energije
- novi materijali drva i kamenje; bunar sada traži 150 zl + 12 kamena + 6 drva
- prodaja i drugih stvari osim usjeva: gljive (6 zl/kg), kupine (5 zl/kg), jaja (40 sr/kom); iz njih nema sjemena
- stari kokošinjac kod kuće: popravak na radnom stolu (25 zl, 10 drva, 4 kamena), 3 kokoši (dokup do 9); svako jutro jaje po nahranjenoj kokoši (1 kg ploda), hranilica do 60 kg, jaja se skupljaju klikom; kokoši šeću i kljucaju oko kokošinjca
- honorarci na mobitelu (nova kartica „Poslovi“): 1–3 ponude svako jutro, rad u kući za laptopom (farmer se ne vidi, traka napretka nad vratima), plaća 4–28 zl, napredak ostaje ako se posao prekine
- nova grafika: oronuli i popravljeni kokošinjac, kokoši, nalazišta u šumi, ikone za drva, kamenje, jaja, gljive i kupine

### v12 – navodnjavanje iz dijelova, prskalice na križanjima

- navodnjavanje traži dijelove: vodena pumpa (montira se na bunar, kratki rad farmera), crijevo (10 m po prskalici) i prskalice; recept za prskalicu na radnom stolu uklonjen
- dijelovi se naručuju na mobitelu (Dostava → Navodnjavanje: pumpa 70 zl, crijevo 10 m 9 zl, prskalica 8 zl) ili nađu u šumi (novo nalazište „odbačeni dijelovi“)
- prskalica stoji na križanju četiri parcele i ne zauzima parcelu; doseg se računa od križanja, razine 1–10 zalijevaju 4, 12, 16, 24, 32, 44, 52, 60, 68, 80 parcela
- prskalice rade samo s pumpom; klik na prskalicu vraća nju i crijevo u torbu
- na radnom stolu popis dijelova s kvačicama (bunar, pumpa, crijevo, prskalice) i nadogradnje razina
- postavljanje: prozirna prskalica i doseg uz miš; pumpa nacrtana uz bunar
- format spremanja v5; starije farme s prskalicama dobiju pumpu, a prskalice prelaze na gornji lijevi kut svoje parcele

### v13 – građevine po istom pravilu, kokoši pojedinačno, postavke

- sve građevine idu istim putem kao bunar: plan na radnom stolu, gradnja na licu mjesta (`BUILDINGS` u `src/data.js`); kokošinjac je prvi prebačen, buduće građevine dodaju se samo zapisom
- popravljeni kokošinjac je prazan; kokoši se naručuju na mobitelu jedna po jedna (12 zl, najviše 9), stižu ujutro ravno u kokošinjac
- prebacivanje između torbe, škrinje, štanda i hranilice po 1, po 5 ili sve
- ⚙ postavke u gornjoj traci: „Vrijeme teče i kad igra nije na ekranu“ (zadano isključeno; uključeno nadoknađuje do 3 sata i javlja sažetak) i brisanje farme; donja traka uklonjena
- borovi imaju šiljaste vrhove svakog kata krošnje

### v14 – tržnica u gradu, kombi i zaposlenik (ideja vlasnika)

- uz cestu novo parkiralište s putokazom „GRAD“ (objekt „Put u grad“, `LOT` u `src/world.js`); odatle se sve vezano uz grad otvara u panelu
- klupa na tržnici se zakupi jednom (25 zl); farmer nosi robu iz torbe, ode cestom na sjever i nestane s mape (1 h puta), prodaje 07–13 h i vraća se; kupci na tržnici dolaze svakih 3–6 s i uzimaju 2–6 kg, cijene su iste kao na štandu
- dok je farmer u gradu ne može primati naredbe (klik na mapu javi to na mobitelu), torba je s njim, a kamera čeka na parkiralištu; oznaka u gornjoj traci pokazuje prodano, a klik na nju ga vraća ranije
- rabljeni kombi (800 zl) i zaposlenik Joža (30 zl dnevnice, samo na dane kad vozi): utovar iz torbe u kombi (12 mjesta), polazak svako jutro u 6 h ili „Pošalji sad“; neprodano ostaje u kombiju za sutra
- kombi nacrtan iz tri kuta (sa strane, straga, sprijeda): izlazi s parkirališta na cestu, odlazi na sjever desnom trakom i vraća se lijevom, pa se parkira unatrag
- prodaja izdvojena u `sellOne()` koju dijele štand i tržnica; putovanja u `s.market.trips` (`go` → `sell` → `back`), sve u `src/sim.js`
- format spremanja v6 (`market`, `cargo`), v4 i v5 farme se učitavaju s praznom tržnicom; putovanje u tijeku preživi ponovno učitavanje, a spavanje završi sva putovanja
- `devFarm.skip(sekunde)` u konzoli premota vrijeme s porukama (za provjere)
- 5 novih testova (zakup i put farmera, prekasno i raniji povratak, kombi sa zaposlenikom, slanje tijekom dana, spremanje i noć)

### v15 – torba i mobitel u igri, cijena gradnje, narudžbe u Dostavi (povratne informacije vlasnika)

- torba i mobitel više nisu desni stupac: ikone ispod zooma (tipke T i M) otvaraju ih kao ploče preko mape; panel zgrade također lebdi nad mapom, a torba se sama pokaže uz zgrade kojima treba (škrinja, štand, kokošinjac, radni stol, parkiralište); Esc zatvara sve
- mapa sada zauzima cijelu širinu (do 1700 px) i višu visinu (do 960 px): na 1400×1000 je 1368×830 umjesto otprilike 1000×680
- dok je mobitel zatvoren, nove poruke kratko iskaču u donjem lijevom kutu mape, a ikona mobitela ima značku s brojem nepročitanih; nova farma počinje s otvorenim mobitelom (uvod se ne gubi u iskačućim porukama); farmerov oblačić je iznad ploča
- nova pixel ikona torbe (kožna torba)
- **greška: nakon skice bunara nije pisalo koliko gradnja košta**, a pokušaj gradnje javljao je samo „Nemam dovoljno novca“. Sada: poruka gradnje kaže cijenu i sve što fali („Fali mi još 120 zl, 6 drva, 12 kamena“), nakon skiciranja farmer kaže cijenu i stiže obavijest, a radni stol ima karticu „plan je gotov“ s kvačicama za novac, drva, kamen i snagu; opis gradilišta navodi i materijale
- **Dostava:** popis „Stiže sutra ujutro“ na vrhu kartice, oznaka „naručeno N“ uz artikle, otkazivanje narudžbe do jutra (paket po paket, puni povrat, `cancelOrder()`); pumpa se ne može naručiti ako je već naručena, u torbi ili škrinji, ili montirana (`pumpStatus()`)
- **greška u spremanju:** pri učitavanju su se zadržavale samo narudžbe sjemena i gnojiva, a naručene pumpe, crijevo, prskalice i kokoši bi nestale (plaćene). Sada se čuvaju sve narudžbe iz kataloga
- 2 nova testa (dostava i otkazivanje, poruka gradnje)

### v16 – kraći rast: jeftino brzo, skupo sporije (povratna informacija vlasnika)

- čekanje od 3 dana na prvu berbu bilo je predugo; trajanje rasta sada prati vrijednost jedne parcele (urod × cijena): rotkvica i mrkva 1 dan, krumpir i kupus 2, blitva i rajčica 3, batat i bundeva 4 (prije 3–7)
- rotkvica posađena danas zrela je sutra ujutro, pa se od drugog dana svaki dan ima što prodati; bez zalijevanja i dalje raste upola sporije
- zarada po danu ostaje slična među usjevima (otprilike 2,5–4 zl po parceli dnevno za ★★), skuplji usjevi nisu nagrađeni samo time što su skupi
- spremljene farme ne trebaju prijenos: napredak se čuva kao udio, pa već posađeni usjevi samo ranije sazriju
- testovi više nemaju upisane dane rasta nego ih čitaju iz `CROPS`; novi test provjerava da skuplji usjev nikad ne raste kraće od jeftinijeg

### v17 – priručnik na mobitelu (ideja vlasnika)

- nova kartica mobitela „📖 Priručnik“: 17 tema (gnojivo, sjeme, usjevi, kvaliteta, voda, bunar, navodnjavanje, šuma, kokošinjac, energija, štand, tržnica, honorarci, radni stol, torba i dostava, dan i noć, tipke) kao popis koji se otvara klikom
- tražilica na vrhu: sve riječi, bez obzira na velika slova i č/ć/š/ž/đ; teme s riječju u naslovu idu prve i prva se sama otvori („gnojivo“ → Gnojivo); dok se tipka, prečaci igre (T, M…) ne reagiraju
- tekst je u novom modulu `src/guide.js` bez DOM-a; sve cijene, materijali, dani rasta, razine navodnjavanja i ostale brojke čitaju se iz `src/data.js`, pa priručnik prati promjene ravnoteže
- putokazi do priručnika: rečenica u uvodu nove farme, gumb „📖 Kako se što radi“ na radnom stolu (otvori temu izuma), a farmer bez gnojiva kaže kako se ono dobiva i gdje piše
- novi `tests/guide.test.js` (3 testa): teme bez „undefined/NaN“, gnojivo s pravom cijenom kao prvi rezultat, svi izumi, usjevi i troškovi gradnje su u priručniku

### v18 – pecanje, jestiva jaja (ideja vlasnika)

- nova pecaljka na radnom stolu (2 drva + 4 zl, `once: 'rod'`) postaje peti alat (tipka 5), skriven dok se ne izradi
- pecanje: s pecaljkom klik na ribnjak baci udicu (3 ⚡), za 3–8 s riba zagrize (plovak potone, „!“ iznad farmera, oblačić „Grize! Klikni!“); klik na mapu ili razmak povlači: unutar 0,45 s ★★★, unutar 0,9 s ★★, do 1,5 s ★; prerano uplaši ribu, prekasno pobjegne
- tri ribe kao nova roba (`GOODS` + `FISH` u `src/data.js`): šaran, linjak, rijetka štuka; prodaju se na štandu i tržnici, imaju kvalitetu i mogu se pojesti
- ribnjak ima 5 riba na dan (`s.pond.fish`, sprema se, puni se ujutro), da pecanje bude razonoda uz farmu, a ne zamjena za nju (otprilike 40 zl na dan)
- crtanje: štap, najlon s progibom i plovak koji se ljulja, krugovi na vodi; plovak i farmer okrenuti su prema sredini ribnjaka (`POND_CENTER`)
- jaja se mogu pojesti (+10 ⚡), gumb „Pojedi“ više nije skriven za jaja
- priručnik: nova tema „Pecanje i pecaljka“, jaja u temama energije i kokošinjca, tipke 1–5 i razmak
- 3 nova testa (pecanje u pravi čas, prerano/prekasno/izlovljeno/nova riba ujutro/spremanje pecaljke, jedenje jaja)

### v19 – novčići umjesto „zl“/„sr“, 5 dizajna novčića (povratna informacija vlasnika)

- u svim tekstovima igre cijene se pokazuju s pixel novčićima umjesto oznaka „zl“ i „sr“ („3 zl 50 sr“ → 3 + zlatnik, 50 + srebrenjak): `coinify()` u `src/ui.js` pretvara gotov DOM (paneli, mobitel, priručnik, gumbi, oblačić, obavijesti, iskačuće poruke, gornja traka, opis pod mapom); skočni opisi (title) ostaju tekst
- „+novac“ iznad štanda crta se s malim novčićima (`coinMini` 9×9)
- stari novčići bili su ružni (dithering na 16 px); novi se crtaju piksel po piksel iz širina redova (čisti krugovi, bez ditheringa), s udubljenim licem i ispupčenim znakom
- 5 skica (`COIN_STYLES` u `src/art.js`), zlato i srebro razlikuju se i oblikom: 1 Monogram (Z / S), 2 Klas (klas pšenice / grančica), 3 Nagnuti (3/4 pogled s nazubljenim bridom, zlatni s iskrom), 4 Hrpica (tri zlatna / dva srebrna), 5 Sunce i mjesec (nazubljeni rub)
- ⚙ Postavke → „Izgled novčića“: klik odmah promijeni sve novčiće u igri (`setCoinStyle`, `resetCoinArt`), izbor se pamti u postavkama; zadano je 1 (Monogram), dok vlasnik ne odabere
- srebro malo tamnije da se znak na licu bolje vidi; kartice radnog stola lome dugačke naslove u novi red

### v20 – odabran novčić „Sunce i mjesec“

- vlasnik je od 5 skica odabrao „Sunce i mjesec“: zlatnik sa suncem, srebrenjak s mjesecom, nazubljeni rub
- ostale četiri skice i izbornik „Izgled novčića“ u postavkama uklonjeni (`coin(kind)` u `src/art.js` crta samo odabrani dizajn); stara postavka `coinStyle` u spremljenim postavkama se zanemaruje

### v21 – cijene sjemena, idle pecanje, manje hrane za kokoši (povratne informacije vlasnika)

- **sjeme:** paket je ponegdje bio skuplji od 1 kg ploda (mrkva 1,50 zl naspram 0,90 zl/kg, krumpir, kupus, bundeva, batat 4 zl naspram 3,30 zl/kg). Novo pravilo: paket uvijek jeftiniji od 1 kg ploda (★★), sjemenka najviše desetina vrijednosti parcele. Paketi: rotkvica 1,50, mrkva 0,60, krumpir 0,70, kupus 0,80, blitva 1,80, rajčica 2,00, batat 2,40, bundeva 1,00 zl
- izjednačena zarada po parceli i danu: krumpir 6 kg (prije 5), blitva 3 kg (prije 2); sad svi usjevi daju otprilike 2,9–3,9 zl po parceli dnevno
- Dostava: sjeme u dva reda (naziv, „plod X/kg · N kg po parceli“), gumb s cijenom paketa, naslov „Sjeme (paket od 5 sjemenki)“
- **pecanje je potpuno idle** (umjesto klikanja na ugriz): s pecaljkom klik na ribnjak i farmer peca sam do 22 h ili dok ga ne pozoveš; 1 ⚡ na sat; ribnjak svako jutro dobije „sreću“ za taj dan (0–5 riba, težine `FISHING.daily`), ugriz svakih 40 min do 3 h igre dok ima sreće, nasumična vrsta, težina i kvaliteta (★–★★★); pecanje se sprema i nastavlja nakon ponovnog učitavanja; koliko je riba u ribnjaku se ne pokazuje, samo „ulov danas“
- **kokoši:** kokoš pojede 200 g na dan umjesto 1 kg (1 kg ploda nahrani 5 kokoši), hranilica 20 kg umjesto 60; hrana se vodi u kg na 100 g točno
- testovi: novi test pravila za cijene sjemena i zaradu po danu; testovi pecanja prepisani (cijeli dan sam, dani bez ribe i sretni dani, prekid, umor, puna torba, nastavak nakon učitavanja); test kokošinjca po 200 g

### v22 – kartice mobitela uvijek stanu (povratna informacija vlasnika)

- greška: s više od 9 nepročitanih obavijesti značka je raširila karticu „Obavijesti“ i izgurala „Priručnik“ izvan mobitela (kartice su imale širinu „koliko treba“)
- sada su četiri kartice uvijek jednako široke i stanu u mobitel; dugi natpis se skrati s „…“ (puni naziv je u opisu kartice)
- značke (obavijesti, novi poslovi) lebde u gornjem desnom kutu kartice i ne mijenjaju joj širinu; više od 99 piše „99+“ (i na ikoni mobitela)
- kartica Priručnik bez ikone 📖 da ostane mjesta

### v23 – gnojivo s kvalitetom i dozama, pet klasa ploda (povratna informacija vlasnika)

- **pet klasa ploda** umjesto četiri, farmerskim izrazima (tržne klase): ★ škart, ★★ II. klasa, ★★★ I. klasa, ★★★★ ekstra, ★★★★★ za sajam; cijene ★ 50 %, ★★ 100 %, ★★★ 130 %, ★★★★ 160 %, ★★★★★ 200 %; ★★★★★ ima ljubičaste zvjezdice
- **vreća gnojiva = 10 doza** (10 parcela); gnojivo se u torbi broji u dozama, a alat gnojiva pokazuje najbolju kvalitetu i broj doza
- **gnojivo ima kvalitetu ★–★★★** (`fertilizer:1..3`): kompost na radnom stolu od 5 kg jedne vrste ploda iz torbe (gumb „Kompost ★★“ uz svaki plod, uz „Sjeme“) daje vreću iste kvalitete kao plod, najviše ★★★; kupovno gnojivo (6 zl) je ★★; stari recept „2 kg loših plodova → 1 gnojivo“ uklonjen
- bonus kvalitete po gnojivu (`FERT_BONUS`): ★ +8, ★★ +14, ★★★ +22; pragovi klasa (`TIER_AT`) 40 / 65 / 85 / 98, pa ★★★★★ daje samo ★★★ gnojivo uz zalijevanje svaki dan i berbu isti dan; dron i dalje najviše ★★★
- parcela pamti kvalitetu gnojiva (`p.fert` 0–3); prvo se troši najbolje gnojivo iz torbe
- stare farme: gnojivo bez kvalitete postaje ★★ (isti broj doza), pognojene parcele ★★
- priručnik: nove teme o gnojivu i kvaliteti (klase, kako do ★★★★★), tekstovi „škart“ umjesto „loši plodovi“
- testovi: klase i gnojivo (★ i ★★ → ekstra, ★★★ → za sajam, dan kasnije ili dan bez vode → ekstra), kompost (5 kg, kvaliteta, najviše ★★★, jaja ne), dostava 10 doza ★★, gnojenje troši doze

### v24 – kiša, malč, obavijesti, otkup, hladnjača, narudžbe kupaca, pčele, uređenje, ljubimac

- radni stol: opis „Sjeme i kompost iz plodova“ sad je u tri retka (sjeme, kompost, pravilo za ★★★★★)
- **kiša** (`RAIN_CHANCE` 22 %): kišni dan ujutro zalije sve posađeno i sve što se posadi tog dana (vrijedi kao ručno zalijevanje), manje kupaca (60 %); prognoza za sutra (`s.tomorrow`) na mobitelu i uz sat; kiša se crta kao kosi mlazovi i hladniji ton; uz sat je i dan u tjednu
- **malč**: parcela pamti `mulch` i `wetLeft`; zalivena malčirana zemlja ostaje vlažna 2 dana; malč s radnog stola (2 drva → 10 doza) ili iz Dostave (3 zl); novi alat 6 s ▾ „malčiraj sve“; iverje se crta na parceli
- **obavijesti u browseru** (⚙ postavke, traži dopuštenje): kad igra nije u fokusu — sazrelo, štand prazan (novi događaj `standempty`), kombi se vratio, nova narudžba
- **otkup** (Dostava → Otkup): dijelovi, gnojivo, malč i ukrasi za 50 % nove cijene, paket po paket, prvo iz škrinje (`sellBack`, `buybackList`)
- **hladnjača**: bez nje svaka hrpa ploda u škrinji svako jutro ima 40 % šanse pasti za klasu; recept „Hladnjača“ (150 zl, 8 kamena) to zaustavlja, škrinja postaje ledeno plava
- **narudžbe kupaca** (`s.requests`): do 3 odjednom, 50 % šanse za novu svako jutro; „8 kg mrkve ★★★ ili bolje do petka“; predaju se na štandu iz torbe (prvo najslabija dovoljno dobra klasa), plaća +50 %; propuštene nestanu s porukom; popis i na mobitelu (Poslovi); nazivi usjeva dobili genitiv (`gen`)
- **pčele**: košnica s radnog stola (10 zl, 6 drva), postavlja se na travu (najviše 5), svaki drugi dan 1 kg meda (do 6 kg), klik skuplja; med (10 zl/kg) se prodaje ili jede; pčele zuje oko košnice
- **uređenje farme**: kamena staza, ograda (spaja se sa susjednim), cvjetna gredica, klupa, vrtni patuljak, lampion (noću svijetli) u Dostavi; postavljanje odmah na klik s prozirnim pregledom (zeleno/crveno), više komada zaredom; uklanjanje gumbom „Ukloni košnicu ili ukras“
- traženje puta sad zna za postavljene stvari (`walkFn`): košnice, ograde i klupe zaprečuju prolaz, a postavljanje koje bi zatvorilo put do kuće, svih zgrada, parcela, ceste ili izlaza u grad se odbija (`farmStaysOpen`)
- **ljubimac**: pas Šarko ili mačka Maca (5 zl, Dostava → Ljubimac); prati farmera korak iza, sjedne kad stane, čeka kod vrata kad je farmer u kući ili gradu; klik je maženje (+5 ⚡ jednom na dan)
- priručnik: 9 novih tema (vrijeme, malč, narudžbe, hladnjača, otkup, pčele, uređenje, ljubimac, obavijesti)
- testovi: 8 novih (kiša i prognoza, malč, škrinja i hladnjača, narudžbe, otkup, pčele i ukrasi, zatvaranje puta, ljubimac)

## Napravljeno 13. studenog 2026.

### v25 – Dostava kao web shop

Vlasnik je javio: kod naručivanja sjemena popis u Dostavi „skoči“ pa ga svaki put treba ponovno spuštati; na mobitelu želi brojač „− broj +“ kao u web shopovima, sitnije cijene i bez zelenog okvira oko cijene.

- **uzrok skakanja**: položaj klizača se čuvao, ali na vrh Dostave se kod svake nove narudžbe dodavao (i rastao) okvir „📦 Stiže sutra ujutro“ s redom po narudžbi, pa je sav katalog ispod odlazio prema dolje
- okvir s popisom narudžbi i oznaka „naručeno N“ su maknuti; umjesto njih na vrhu je **traka košarice** fiksne visine u jednom retku („📦 Sutra stiže 3 stavke · 2 zl“ ili „📦 Košarica je prazna“), pa se popis pri naručivanju ne pomiče ni za piksel (provjereno mjerenjem položaja reda prije i poslije klika)
- svaki artikl (vrt, navodnjavanje, kokoš, sjeme, ukrasi) ima **cijenu kao običan tekst** (11 px, manji novčići, bez gumba) i **brojač − broj +**; broj su paketi koji stižu sutra, + naruči još jedan (`orderSeeds`/`orderItem`), − otkaže jedan uz puni povrat (`cancelOrder`); tooltip na + kaže koliko novca fali ili zašto je zaključan (pumpa, kokošinjac)
- pravila u `sim.js` nisu mijenjana; priručnik (tema Dostava) i README opisuju novi brojač
- udomljavanje ljubimca i Otkup i dalje imaju gumbe s cijenom (to nije naručivanje u košaricu)

### v26 – sporiji hod, brži kombi

Vlasnik: farmer bi mogao hodati malo sporije, a Joža bi kombijem trebao stići u grad brže nego farmer pješice.

- `WALK_SPEED` 5 → 4 polja u sekundi (ljubimac i dalje stigne farmera, kupci hodaju 3)
- `MARKET.travel` (60 min za oboje) zamijenjen s `MARKET.walk` (60 min, farmer pješice) i `MARKET.drive` (20 min, kombi); `tripMinutes(who)` u `sim.js` bira trajanje za odlazak, povratak, rani povratak i provjeru „prekasno“, pa kombi može krenuti do 12:40, a farmer do 12:00
- animacija kombija i učitavanje spremanja koriste nova trajanja; tekstovi na parkiralištu, u gornjoj traci („Kombi se vraća oko 13:20“) i u priručniku pokazuju oba trajanja
- novi test: kombi i farmer krenu zajedno, kombi stiže prvi; pješice je prekasno kad kombi još može

### v27 – nadogradnje izuma, korak 1: automatizacija

Vlasnik je tražio da svaki izum s radnog stola ima nadogradnje, a dron da bere od ★★ do ★★★★★. Dogovoren je plan u tri koraka: (1) automatizacija, (2) ostali izumi, (3) online prodaja i dostava. Ovo je korak 1.

- **zajednički sustav nadogradnji**: tablica `UPGRADES` u `data.js` (linija → `of` izum, `values` po razinama, `steps` s cijenom, drvom i kamenom, `text`), razine u `s.levels`; `upgrade(s, line)`, `upgradeProblem`, `nextStep`, `levelValue` u `sim.js`. Izrađeni izum ostaje na radnom stolu kao kartica „✔ ime“ s linijama nadogradnji (mjerač, „Sad: …“, „Razina N: …“, gumb s cijenom)
- **dron**: kupnja 600 → 300 zl. Kamera ★★/★★★/★★★★/★★★★★ (bere samo plodove do te kvalitete; bolje ostavlja i ujutro javi „ostavio N parcela“; kad im kvaliteta čekanjem padne na njegovu razinu, pobere ih ipak). Motori 6/9/12 polja/s uz predah 3/2/1 s. Košara 1/3/6 parcela: dron sad stvarno nosi urod (`drone.load`) i leti do krova kad je pun ili nema više posla, pa istovari u škrinju; dok nosi, ispod njega visi sanduk
- **replant.py**: v1 posadi, v2 i zalije, v3 i pognoji najboljim gnojivom iz škrinje
- **velika kanta**: 30 → 50 → 80 zalijevanja
- **navodnjavanje iznova**: prskalica uvijek zalije 4 parcele oko križanja. Nadogradnje: **Pumpa** 6/12/24 prskalice (višak stoji blijed, postavljanje preko kapaciteta javlja „pumpa pogoni najviše…“) i **Mlaznice** 50 %/80 %/100 % ručnog zalijevanja, 4. razina fertigacija: spremnik kod pumpe (60 doza) puni se gumbom „Ulij gnojivo iz torbe“, a prskalice svako jutro pognoje nepognojeno, prvo najboljim
- **greška**: kartica nadogradnje prskalica nikad se nije prikazivala (bila je vezana uz recept „Prskalica“ koji je nestao kad su prskalice prešle u Dostavu); sad je kartica „Navodnjavanje“ na radnom stolu čim je bunar sazidan
- **greška**: popisi na pločama (radni stol, Dostava) skakali su na vrh kad bi se ploča iscrtala iznova, npr. kad se pri naručivanju promijeni novac. To je vjerojatno bio pravi uzrok vlasnikova prigovora „radni stol se resetira kad naručujem sjeme“. `renderIfChanged` sad pamti i vraća položaj svih pomičnih popisa
- **spremanje v7**: `levels`, `tank`, `drone.load`. Prijenos iz v6: dron dobiva kameru ★★★ (kao prije), mlaznice 80 % (stara voda je vrijedila 75 %; uz staru razinu navodnjavanja 5+ dobiva 100 %), pumpa dovoljno jaka za već postavljene prskalice
- priručnik: nova tema „Nadogradnje izuma“, prepravljene teme Navodnjavanje, Voda, Kvaliteta i Radni stol
- testovi: 4 nova (pumpa i mlaznice, fertigacija, dron s kamerom, košarom i motorima, replant v1–v3, kanta) i prijenos v6 spremanja; stari test 10 razina dosega maknut
- usput: pri izradi se jedna skripta greškom ispraznila `src/sim.js`; vraćen je iz gita i ponovno su primijenjene promjene iz v26 i v27 (testovi to potvrđuju)

Dogovoreno za sljedeće korake (vlasnik je odobrio sve):
- **korak 2**: pecaljka (štap: više ★★★, mamac: kraće čekanje, mreža: do 7 riba dnevno), malč (drobilica 20 doza, kora 3 dana), košnica (veća 10 kg, med svaki dan, oprašivanje susjednih parcela) + **tegle za med** (narudžba u Dostavi, 1 tegla po kg; bez tegli med ostaje u košnici; cijena meda malo viša), hladnjača (36 i 48 mjesta), kokošinjac (15 kokoši, hranilica 60 kg, inkubator), bunar (slavina uz polje), polje (staklenik: dan brže), **„Reklame i plakati“** umjesto SEO ploče: 5 razina po +10 % kupaca na štandu (plakat, letci, novine, radio, jumbo plakat); postojeća SEO ploča → razina 5
- **korak 3**: online prodaja na laptopu u kući (webshop, Google Business, SEO, društvene mreže; farmer ih radi sam kao honorarce, troše vrijeme i energiju); online narudžbe ujutro, plaćaju oko +30 %; paketi idu u kutiju za dostavu; Joža vozi pakete poslijepodne nakon tržnice uz dodatnu dnevnicu, kasnije drugi kombi s drugim vozačem samo za dostavu, i **zaposlenik za pakiranje paketa** kad Joži bude previše posla

### v28 – željezo i plastika za strojeve

Vlasnik: umjesto kamena za prskalice, dron i slične elemente koristiti metal, željezo ili plastiku.

- novi materijali **željezo** i **plastika** (`MATERIALS` u `data.js`, uz drva i kamen); `hasMats`, `useMats` i novi `matsText` u `sim.js` rade s bilo kojim materijalom, pa se novi dodaje samo u tablicu
- izvori: Dostava → „Materijal za strojeve“ (5 kom željeza 8 zl, 5 kom plastike 6 zl; stižu u škrinju, otkup za pola cijene) i odbačeni dijelovi u šumi (sad češći; osim crijeva i prskalice daju 1–3 željeza ili plastike)
- kamen ostaje samo za gradnju (bunar, kokošinjac); strojevi sad traže: dron 3 željeza + 3 plastike, kamera drona 3/6/10 plastike, motori 3/6 željeza, kanta 2/4 željeza, pumpa 4/8 željeza, mlaznice 2/4/8 plastike, hladnjača 6 željeza + 4 plastike (umjesto 8 kamena); košara drona i dalje drvo
- pixel art ikone: tri željezne šipke, hrpa plastičnih ploča (plava, bijela, zelena)
- poruke i priručnik govore odakle se željezo i plastika nabavljaju
- test: narudžba, dostava, otkup i tekst materijala; postojeći testovi strojeva sad dodaju željezo i plastiku

### v29 – nadogradnje izuma, korak 2: ostali izumi

Vlasnik je rekao „nastavi“, pa je napravljen dogovoreni korak 2 iz v27. Sve nove linije su retci u `UPGRADES` (`data.js`); radni stol ih sam crta.

- **čije su nadogradnje**: `of` sad može biti i zgrada (`well`, `coop`), `field` (uvijek tu) ili recept koji se radi više puta (`mulch`, `hive`; nadograđuje se i prije prve izrade). `owns()` u `sim.js` je jedno mjesto za tu provjeru. Radni stol ima nove kartice „✔ Bunar“, „✔ Kokošinjac“ i „Polje“, a malč i košnica imaju linije ispod svog recepta
- **pecaljka**: Štap 30/50/70 % ulova ★★★ (ostatak ★ i ★★ kao prije, 2 : 5), Mamac riba grize ×0,7 i ×0,5 brže, Mreža za ribu do 7 riba na dan (dnevna sreća 0–5 se razvuče na 0–7, pa loš dan ostaje loš)
- **malč**: Drobilica (2 drva → 20 doza; recept ima `nLine`), Kora (vlažno 3 dana). Parcela pamti koliko dana drži njen malč (`p.mulch` je broj), pa nadogradnja ne mijenja već malčirane parcele
- **košnica**: Nastavak 10 kg, Matica med svaki dan, Roj: pčele oprašuju parcele do 5 polja od košnice (+4 boda kvalitete, `p.pollen`); savršena parcela s ★★ gnojivom tako stiže do 98 = ★★★★★. **Tegle za med** u Dostavi (10 kom 3 zl): med se skuplja samo u tegle iz torbe, tegla po kilogramu, bez tegli ostaje u košnici. Med poskupio 10 → 12 zl/kg
- **hladnjača**: Police 24 → 36 → 48 mjesta (škrinja se produži odmah)
- **kokošinjac**: Prostor 9 → 12 → 15 kokoši, Hranilica 20 → 40 → 60 kg, Inkubator: jaje iz kokošinjca grije se 3 jutra i izleže se kokoš, samo dok ima mjesta (računajući i naručene kokoši)
- **bunar**: Slavina uz polje na južnoj ogradi prvog polja (`TAP` u `world.js`, pločica ograde, pa ne zaprečuje ništa); kanta se puni s staze ili iz polja, a skupno zalijevanje ide po vodu na najbliži izvor, sad i na slavinu. Crtež: cijev s crvenim kolom na ogradi
- **polje**: Staklenik (350 zl, 10 drva, 12 plastike): sve dozrijeva dan brže, najmanje 1 dan (`cropDays`); na mapi stakleni okvir nad poljima
- **Reklame i plakati** umjesto SEO ploče: plakat 20 zl (+10 %), pa letci, oglas u novinama, reklama na radiju i jumbo plakat (svaka +10 %, ukupno +50 %). Stara SEO ploča (+60 %) postaje 5. razina
- **spremanje v8**: nove razine u `levels`, `coop.hatch`, `p.pollen`, `p.mulch` kao broj dana. Prijenos iz v7: `mulch: true` → 2 dana, `seo` → Reklame 5. razina, škrinja dobiva mjesta prema policama
- poruke: „nemam tegle“, izlegla se kokoš, kokošinjac pun (s brojem iz nadogradnje); kokošinjac pokazuje jaje u inkubatoru, škrinja broj mjesta hladnjače, opis košnice koliko je meda i ima li tegli
- priručnik: nove rečenice u temama Usjevi (staklenik), Malč, Bunar, Pecanje, Kokošinjac, Štand (reklame), Hladnjača i Pčele; popis nadogradnji sad piše čija je koja linija („Pecaljka · Štap: …“)
- usput: tekst košare drona „6 parcele“ → „6 parcela“
- testovi: 9 novih (vlasnik svake linije, pecaljka, malč, košnica i oprašivanje, police, kokošinjac i inkubator, slavina i skupno zalijevanje, staklenik, reklame i prijenos SEO ploče); test crteža pokriva slavinu i ikonu tegle

### v30 – na mobitel samo bitne obavijesti, sitnice na mapi

Vlasnik: na mobitelu je previše obavijesti. Ondje trebaju samo bitne (npr. dronu je nestalo gnojiva), a tko je što kupio na štandu i koliko je dron ubrao neka se piše iznad štanda, drona i drugih odgovarajućih objekata.

- **oznake na mapi**: `renderer.note(mjesto, tekst, ton)` u `render.js`. Kratka oznaka se pojavi iznad mjesta (štand, dron, kokošinjac, škrinja, parkiralište, bunar, kuća), najviše 3 po mjestu (novija dolje, starije gore), i nestane za 5 s. Crta se zadnja, u pikselima ekrana: ista veličina na svakom zoomu, čitljiva i noću, ne izlazi preko ruba mape; oznaka drona putuje s dronom
- **preseljeno na mapu**: kupnja na štandu („🛒 3 kg mrkva ★★★ · +3 zl 51 sr“), kupac bez robe, otvaranje i zatvaranje štanda; dron („🚁 1 parcela · 4 kg u škrinju“ pri istovaru, „ostavio N parcela“ ujutro); jaja, dostavljene i izlegle kokoši; dostava u škrinju; kombi (polazak s dnevnicom, prazan kombi, povratak s prodanim kg i novcem, zaposlen/otpušten); fertigacija; kiša; plaćen honorarac
- **maknuto s mobitela** (oblačić, traka ili sam mobitel to već pokazuju): prognoza, ulov i kraj pecanja, polazak i dolazak na tržnicu, narudžba i otkazivanje u Dostavi, otkup, predana narudžba kupca, udomljen ljubimac, nove ponude poslova (značka na kartici Poslovi), niknulo u šumi i samoniklo sjeme, broj zalivenih parcela u jutarnjem izvještaju, zbirna poruka „Dron je ubrao N“ svakih 10 s
- **ostaje na mobitelu** (i iskače u kutu mape): problemi i ono što traži igrača: škrinja puna za dron, štand prazan, gladne kokoši, trulež, plodovi u škrinji gube kvalitetu, nova i propala narudžba kupca, Joža bez dnevnice, novo u katalogu, sazidan bunar ili kokošinjac i montirana pumpa, jutarnji izvještaj, uvodni savjeti
- **nova upozorenja** (`sim.js`): `droneshort` kad replant.py nema sjemena ili (v3) gnojiva u škrinji, `tankempty` kad je spremnik fertigacije prazan, a prskalice dosežu nepognojene parcele. Na mobitel stižu jednom na dan po vrsti (`warnOnce` u `main.js`), da se ne ponavljaju svaki let drona. `unloaded` (koliko je dron istovario) hrani oznaku iznad drona
- priručnik: nova tema „Obavijesti: mobitel i mapa“; README i uvodni savjet opisuju podjelu
- test: upozorenja drona (sjeme, gnojivo, ništa kad svega ima), istovar s brojem parcela i kg, prazan spremnik fertigacije

### v31 – korak 3, prvi dio: web shop i online narudžbe

v25–v30 su prvo commitani (`8ace00f`). Vlasnik je pitao što je s web shopom i odobrio da se krene; korak 3 je podijeljen na tri dijela (1. laptop i web shop, 2. Joža vozi pakete, 3. drugi kombi i pakirer). Ovo je prvi dio.

- **laptop u kući** (panel kuće): četiri kanala iz `ONLINE.channels` u `data.js`: Web shop (4 h), Google Business profil (1 h), SEO za web shop (3 h), Društvene mreže (2 h); ostali traže web shop. Rade se kao honorarac bez plaće (`buildOnline` stavi posao u `s.gigs.active` s poljem `online`; `finishGig` tada uključi kanal umjesto isplate). Troše 6 ⚡ po satu
- **online narudžbe** (`onlineOrders` u jutru): svaki gotov kanal ima svoju šansu za novu narudžbu (0,6 / 0,4 / 0,5 / 0,5), najviše 5 otvorenih. Narudžba traži plod iz kataloga u klasi ★★–★★★★ (jaja i med u ★★, ako ima kokoši ili košnica), rok 2–4 dana, plaća 30 % više od štanda (`orderPay`)
- **kutija za pakete** na parkiralištu (panel „Put u grad“): popis narudžbi, „Spakiraj iz torbe“ (1 ⚡, najslabija dovoljno dobra klasa, kao narudžbe na štandu) i „Odnesi N paketa na poštu“. Spakirani paketi se vide kao kartonske kutije kraj putokaza
- **pošta u gradu**: novi put `goToPost` koristi postojeći put farmera u grad (`trips.farmer` s `post: true`): pješice 1 h, predaja, odmah natrag; pošta radi do 17 h. Kad farmer ide na tržnicu, pakete preda pri dolasku. Plaća se na pošti (`postParcels`)
- **rok**: ujutro nakon roka narudžba propada; spakirani paket se vrati u škrinju (`items` pamti što je u njemu)
- poruke: nova online narudžba i propala narudžba idu na mobitel (traže igrača); poslani paketi kao oznaka iznad parkirališta i oblačić; gornja traka „📮 Farmer nosi pakete na poštu“; mobitel → Poslovi ima popis online narudžbi
- **spremanje v9**: `online` (kanali, narudžbe sa spakiranim sadržajem); posao na kanalu se nastavlja nakon ponovnog učitavanja
- priručnik: nova tema „Web shop i online narudžbe“; jaja i med dobili su genitiv („6 kom jaja“, „2 kg meda“)
- testovi: 4 nova (izrada kanala bez plaće, narudžbe po kanalima i cijena, pakiranje, pošta, rok i povrat u škrinju, paketi na putu na tržnicu i nastavak nakon učitavanja)

### v32 – narudžbe plaćaju klasu koju predaš (povratna informacija vlasnika)

Vlasnik: narudžbe na štandu i online ne skaliraju. Kupac traži npr. ★★ ili bolje za 10 zl; ako dobije ★★★★★, treba platiti vrijednost robe ★★★★★ plus dodatak (online +30 %).

- `goodsPay(crop, items, extra)` u `sim.js`: svaka predana jedinica po cijeni na štandu za svoju klasu, zbroj puta (1 + dodatak)
- **štand**: `fulfillRequest` plaća predanu robu + `REQUESTS.bonus` (50 %, nepromijenjeno); `requestPay(r)` bez robe je najmanja cijena (sve u traženoj klasi)
- **online**: `packOrder` upisuje u `o.pay` vrijednost paketa + `ONLINE.markup` (30 %); pošta isplaćuje taj iznos. `orderPay(o)` računa iz `o.items` kad je paket spakiran, pa učitavanje spremljene igre zadrži višu cijenu
- `orderPick(s, r)`: što bi se uzelo iz torbe (najslabija dovoljno dobra klasa prva), bez uzimanja; koriste ga predaja, pakiranje i prikaz
- kartice narudžbi (štand, kutija za pakete): „Plaća vrijednost robe +50 %/+30 %, najmanje X. U torbi: N kg → Y“, gdje je Y iznos za ono što bi se sad predalo; spakirani paket pokazuje svoj stvarni iznos
- priručnik: teme „Narudžbe kupaca“ i „Web shop i online narudžbe“ opisuju novo plaćanje
- testovi: bolja klasa na štandu plaća svoju cijenu + 50 %, mješavina ★★ i ★★★★★, paket ★★★ + ★★★★, paket ★★★★★ zadrži višu cijenu nakon učitavanja

### v33 – ljestvica cijena: štand najjeftiniji (pravilo vlasnika)

Vlasnik je pitao zašto online plaća +30 %, a narudžba na štandu +50 %. Te dvije brojke su bile odvojene odluke (štand v24 moja procjena, online iz plana za korak 3) i nisu bile usklađene. Pravilo vlasnika: štand je najjeftiniji jer nema dodatnih troškova; online, tržnica i dostava su skuplji zbog troškova tih usluga.

- ljestvica: štand cijena klase → narudžba na štandu **+10 %** (`REQUESTS.bonus`, bilo 50 %) → tržnica **+20 %** (novo `MARKET.markup`; dosad iste cijene kao štand) → online **+30 %** (`ONLINE.markup`, nepromijenjeno)
- `sellOne` dobio parametar dodatka; tržnica (farmer i kombi) prodaje s `MARKET.markup`, štand bez dodatka
- priručnik (Tržnica) i README (tržnica, narudžbe, web shop, odjeljak „Ljestvica cijena“) usklađeni
- test: svaka prodaja na tržnici plaća cijenu štanda +20 %; ljestvica narudžba < tržnica < online

### v34 – tržnica +10 %, dostava bez poštarine (odluka vlasnika)

Vlasnik je pitao je li +20 % za tržnicu previše. Puni tržni dan proda oko 160 kg (oko 40 kupaca po 2–6 kg), 320–400 zl prometa: +20 % donosi 65–80 zl više od štanda, više nego dvostruko više od Jožine dnevnice (30 zl), a +10 % otprilike koliko iznosi dnevnica. Prednost tržnice je količina, a ne cijena.

- tržnica **+10 %** (`MARKET.markup`), narudžba na štandu **+5 %** (`REQUESTS.bonus`), da ostane jeftinija od tržnice; online ostaje +30 %
- **odluka vlasnika za korak 3, drugi dio**: dostava paketa košta samo Jožinu dnevnicu; kupac plaća samo online cijenu, bez poštarine. Ne komplicirati

## Napravljeno 16. studenog 2026.

### Vraćanje v25–v34 u `dev`

Rad od v25 do v34 (commit `223ac71` i lokalni backup `d764ab8` od 14. 11.) ostao je samo na lokalnoj grani `backup-lokalno`: kad je `dev` usklađen s GitHubom, dev-farm na `dev` vratio se na v24. Vlasnik je to primijetio jer dron nije brao ★★★★★, a prskalice nisu gnojile. Mapa `dev-farm/` vraćena je iz `backup-lokalno` (samo ona, ostali projekti s te grane nisu dirani); na `dev` nije bilo dev-farm promjena kojih nema na backupu, pa nije bilo sukoba.

### v35 – rad na polju: sporiji farmer, radnje koje traju, povlačenje mišem, serija (ideja vlasnika)

Točka 1 vlasnikove nove liste (16. 11.). Dizajn: `docs/specs/2026-11-16-field-work-design.md`, plan: `docs/plans/2026-11-16-field-work.md`. Točke 2 (kupovanje parcela) i 6 (reputacija na tržnici) vlasnik je stavio na pauzu; točka 3 (sučelje) je sljedeća, a kod točke 4 (materijali) treba stati i dogovoriti se s vlasnikom.

- **hod**: `WALK_SPEED = NPC_SPEED` (3 polja/s, prije 4) – vlasnik: farmer hoda kao svi ostali na mapi
- **radnje traju** (`WORK_SECONDS` u `data.js`): sadnja, berba i čišćenje trule parcele 1,5 s, zalijevanje, gnojenje i malčiranje 1 s, punjenje kante 2 s. `arrive()` za posao na parceli postavlja `farmer.busy = { what: 'work', act, left, total, task }`, a kad istekne, `doTask()` izvrši isti kod kao prije. `workAct(s, task)` kaže koja bi se radnja izvršila; kad nema posla ili energije, zadatak se izvrši odmah (pa poruka stiže bez čekanja). Energija se troši na kraju; novi klik, Esc, spavanje, nesvjestica i odlazak u grad prekidaju radnju bez troška; ako je dron u međuvremenu pobrao parcelu, farmer je preskoči
- **poza**: `person({ pose: 'bend' | 'pour' })` u `art.js` (čučanj s rukama u zemlji koje se miču, ili ispružena ruka); uz `pour` se crta nagnuta kanta, a kod zalijevanja iz nje kaplje. Traka napretka za posao na parceli je ispod farmerovih nogu, jer bi je oblačić iznad glave prekrio
- **povlačenje mišem**: lijeva tipka preko polja s alatom; `tilesBetween` popuni pločice koje brzi miš preskoči, `dragTargets` ostavi samo otključane parcele s poslom (žuti okvir), `startJobOn` na otpuštanje pokrene posao; isti alat dok farmer radi dodaje na kraj reda, drugi alat zamijeni posao. Kratki klik radi kao prije. `jobTargets` i povlačenje dijele iste uvjete (`jobFits`, `jobCap`)
- **serija**: nova vrsta posla `series` (Ruke ▾ → „Serija: poberi, posadi, zalij“, sve ili jedna vrsta, ili Shift + povlačenje rukama). Po parceli: berba → sadnja iste vrste (bez nje vrsta iz vrećice, bez ikakvog sjemena parcela ostaje prazna i serija ide dalje) → zalijevanje (prazna kanta: farmer ode po vodu; kišni dan: nema zalijevanja). Brojač ide po parcelama („serija 2/6“), ■ prekida
- tekstovi oblačića za malčiranje i seriju (prije su falili za malč)
- priručnik: nova tema „Rad na polju: povlačenje i serija“ (trajanja iz `WORK_SECONDS`), tipke spominju povlačenje i Shift; README opisuje rad na polju i zašto je ručni rad namjerno spor
- popravci nakon završnog pregleda: (1) kad radnja istekne, izvrši se samo ako je na parceli još isti posao – pojedinačni klik više ne posadi umjesto berbe koju je dron preuzeo niti se žali „već zaliveno“ nakon kiše; (2) svaki zadatak sadnje pamti svoje sjeme, pa promjena sjemena u vrećici usred povlačenja posadi nove parcele novim sjemenom (posao staje tek kad nijedan zadatak nema sjemena); (3) Esc ili izlazak miša s mape usred povlačenja ne okida klik na pločici gdje se pusti tipka; (4) Esc prekida i pojedinačnu radnju, ne samo skupni posao
- testovi: 16 novih (brzina, promijenjena parcela kod pojedinačnog klika, promjena sjemena usred povlačenja, radnja traje i troši na kraju, prekid klikom, preskakanje promijenjene parcele, nesvjestica usred radnje, poze u crtežu, `tilesBetween`, `dragTargets`, povlačenje i dodavanje, zamjena posla i grad, serija, serija bez sjemena, kiša i umor, Shift-povlačenje) i tema priručnika; pomoćnik `walkTo` u testovima čeka i da radnja završi

## Zadnja automatizirana provjera

Provedeno 16. studenog 2026. nakon v35 i popravaka iz pregleda: `npm test` 98/98; Esc usred povlačenja ne radi ništa, a sljedeći klik radi normalno; Esc usred sadnje je prekine bez troška sjemena; headless Chromium bez JS grešaka: sadnja klikom (farmer čučne, traka ispod nogu, posađeno nakon 1,5 s), zalijevanje (nagnuta kanta s kapima, energija 100 → 97), povlačenje preko 5 parcela s preskokom miša (svih 5 u žutom okviru, „sadi 0/5“, 4/5 posađeno nakon 9 s), kratki klik i dalje šalje farmera na jednu parcelu, klik na travu usred sadnje prekida posao bez troška („Dobro, prekidam sadnju.“), Ruke ▾ → Serija → Sve zrelo („serija 0/6“, ■; parcele pobrane, posađene i zalivene), povlačenje rukama = berba, uz Shift = serija. Nakon vraćanja v25–v34 u `dev`: `npm test` 82/82, igra se učitava u headless Chromiumu bez JS grešaka (spremanje v9, sve linije nadogradnji u stanju). Provedeno 13. studenog 2026. nakon v34: `npm test` 82/82 i učitavanje igre u headless Chromiumu bez JS grešaka. Nakon v33 isto. Nakon v32 (`npm test` i učitavanje igre u headless Chromiumu bez JS grešaka; kartice narudžbi nisu klikane u pregledniku, logika je pokrivena testovima). Ranije, nakon v31:

| Provjera | Rezultat |
| --- | --- |
| `npm test` u `dev-farm/` | 82/82 testova prolazi |
| Headless Chromium (v31) | bez JS grešaka; kuća pokazuje „💻 Laptop“ s četiri kanala (ostali „prvo web shop“); „Napravi · 4 h · 24 ⚡“ → farmer kodira, web shop online (energija 76) i poruka na mobitelu; nakon dva jutra dvije narudžbe („vrtić Sunce: 5 kg rajčice ★★★ ili bolje, poslati do subote“, 25 zl 35 sr); kutija za pakete na parkiralištu, „Spakiraj iz torbe“ → „✔ Spakirano, čeka poštu“, gumb „Odnesi 1 paket na poštu“, gornja traka „📮 Farmer nosi pakete na poštu“, novac +25 zl 35 sr i farmer se vraća; mobitel → Poslovi prikazuje preostalu online narudžbu |
| Headless Chromium (v30) | bez JS grešaka; nova farma, štand s mrkvom i rotkvicom, dron s replant.py v3 bez sjemena i gnojiva, 3 sata igre: na mobitel su stigle samo 2 poruke („Dron nema sjemena (rotkvica)…“, „Dron nema gnojiva…“), iznad štanda tri oznake kupnji („🛒 3 kg mrkva ★★★ · +3 zl 51 sr“), iznad drona „🚁 1 parcela · 4 kg u škrinju“; oznake su iste veličine na svakom zoomu i ne izlaze preko ruba mape |
| Headless Chromium (v29) | bez JS grešaka; radni stol pokazuje kartice „✔ Bunar“, „✔ Kokošinjac“, „Polje“, „✔ Pecaljka“, „✔ Hladnjača“, „✔ Reklame i plakati“ i linije pod Malčem i Košnicom (22 linije); klikovi na „Nadogradi“ dovedu svih 13 novih linija do najviše razine (škrinja 48 mjesta, oblačić „Reklame, razina 5: jumbo plakat: +50 % kupaca na štandu.“); klik na slavinu na ogradi: farmer stane ispod nje i napuni kantu (12/12); staklenik se vidi nad poljem; Dostava ima „Tegle za med · 10 kom · 3“ s ikonom tegle; kokošinjac „Kokoši: 10/15“ i „U inkubatoru se grije jaje: kokoš se izleže za 2 dana“; hladnjača s 36 mjesta |
| Headless Chromium (v28) | bez JS grešaka; radni stol: „Hladnjača 150 · 6 željeza, 4 plastike“, „harvest-drone 300 · 3 željeza, 3 plastike“, gumbi „Nadogradi · 120 · 4 željeza“ (pumpa) i „Nadogradi · 80 · 2 plastike“ (mlaznice); Dostava ima grupu „Materijal za strojeve“ s ikonama šipki i ploča, Otkup nudi višak željeza i plastike |
| Headless Chromium (v27) | bez JS grešaka; radni stol s karticama „✔ Velika kanta“, „✔ harvest-drone“, „✔ replant.py“ i „Navodnjavanje · water.sh“; klik na „Nadogradi“ (pumpa → 12 prskalica, oblačić „Pumpa, razina 2: pogoni 12 prskalica.“) uz popis spušten na 500 px ostaje na 500 px; mlaznice do fertigacije, kamera do ★★★★★, motori i košara; „Ulij gnojivo iz torbe“ puni spremnik (10 × ★★★); dron nosi urod sa sandukom ispod sebe; v6 spremanje (dron, navodnjavanje v7, 9 prskalica) učitano s kamerom ★★★, mlaznicama 100 % i pumpom za 12 |
| Headless Chromium (v26) | bez JS grešaka; farmer u 1 s prijeđe 4 polja; farmer i kombi poslani zajedno u 6:05: kombi na tržnici u 6:25, farmer u 7:05; parkiralište piše „pješice 1 h, kombijem 20 min“ |
| Headless Chromium (v25) | bez JS grešaka; na 1400 i 640 px: + na krumpiru dvaput (brojač 2, traka „2 stavke“), + na mrkvi, − na krumpiru (brojač 1, novac vraćen), + na crijevu i pumpi (+ pumpe zatim zaključan „već naručena“); red na kojem se klika ostaje na istom položaju na ekranu |
| Headless Chromium (v24) | bez JS grešaka; kišni dan (🌧️ uz sat, prognoza u opisu sata, kiša na mapi), alat malča „7 doza“ i iverje na parcelama, Dostava u grupama s Uređenjem, Ljubimcem i Otkupom (prodana pumpa +35), 11 ukrasa i košnica postavljeni klikovima kroz torbu (staza, ograda, gredica, klupa, patuljak, lampion), lampion noću svijetli, pas prati farmera i maženje daje +5 ⚡, narudžba na štandu predana uz bonus, napomena o kvarenju u škrinji; stari scenariji (tržnica, cijeli dan) bez regresija |
| Headless Chromium (v23) | bez JS grešaka; kompost od 5 kg rajčica ★★★ daje vreću ★★★ (10 doza), alat gnojiva „★★★ · 10 doza“, rotkvica s ★★★ gnojivom, zalivena i ubrana na vrijeme je ★★★★★ „za sajam“ (ljubičaste zvjezdice u torbi), gnojivo u Dostavi „★★ (vreća) · 10 doza“ |
| Headless Chromium (v22) | bez JS grešaka; sa 150 nepročitanih obavijesti sve četiri kartice mobitela unutar mobitela na 1400, 900 i 640 px, značka „99+“ |
| Headless Chromium (v21) | bez JS grešaka; farmer peca sam od 6 do 22 h (3 ribe na sretan dan, −16 ⚡), nastavlja pecati nakon ponovnog učitavanja, sam spremi pecaljku u mraku s porukom o ulovu; Dostava pokazuje sjeme u dva reda; kokošinjac „2,4 kg · dosta za 3 dana“ uz 4 kokoši |
| Headless Chromium (v20) | bez JS grešaka; novčići sa suncem i mjesecom u gornjoj traci i Dostavi (18), izbornika u postavkama više nema |
| Headless Chromium (v19) | bez JS grešaka; 18 novčića u Dostavi i nijedan zaostali „zl/sr“, novčići na radnom stolu i u oblačiću, izbornik 5 dizajna u postavkama, odabir mijenja gornju traku i tekst odmah i ostaje nakon ponovnog učitavanja |
| Headless Chromium (v18) | bez JS grešaka; alat pecaljke skriven do izrade, izrada na radnom stolu, jedenje jajeta (+10 ⚡), bacanje udice, ugriz, povlačenje razmakom i ulov (štuka/linjak ★★★), plovak u vodi prema sredini ribnjaka |
| Headless Chromium (v17) | bez JS grešaka; kartica Priručnik sa 17 tema, tražilica „gnojivo“ otvara temu Gnojivo, tipke M i T u tražilici se upisuju (ne zatvaraju mobitel), gumb s radnog stola otvara temu izuma |
| Headless Chromium (v16) | bez JS grešaka; zalivene rotkvice i mrkve zrele su jutro nakon sadnje (naslov taba „🌾 12 za berbu“), krumpir na pola |
| Headless Chromium (v15) | bez JS grešaka; mapa preko cijele širine, mobitel otvoren na novoj farmi, tipke T/M, narudžba pumpe i zaključan gumb za drugu, popis „Stiže sutra“ i otkazivanje s povratom novca, radni stol s planom bunara i torbom uz njega, poruka o bunaru s onim što fali, uski prozor (900 px), ponovljeni scenariji tržnice i cijelog dana |
| `npm start` + dohvat stranice i modula | server vraća 200 za `index.html` i `src/*.js` |
| Headless Chromium preko DevTools protokola (v14) | bez JS grešaka; provjereni panel „Put u grad“, zakup klupe, farmer odlazi cestom i nestaje, prodaja na tržnici i oznaka u gornjoj traci, raniji povratak, kupnja kombija, zapošljavanje, utovar iz torbe, „Pošalji sad“, animacija kombija (izlazak, odlazak, povratak, parkiranje), nastavak putovanja nakon ponovnog učitavanja stranice, cijeli dan do nesvjestice i sljedeće jutro |
| Headless Firefox (do v13, scenariji u scratchpadu) | iscrtavanje bez JS grešaka; provjereni hodanje, škrinja, skupna sadnja, zalijevanje s odlaskom po vodu, zidanje bunara, doseg prskalice, izbornik koji se zatvara, novčići u HUD-u, izbornici sva četiri alata, prekid skupnih poslova, štand uz cestu, šuma, kokošinjac s kokošima, honorarac u kući, prskalice na križanjima s pumpom i pregledom dosega, noć |

## Poznata ograničenja

- Tempo i ekonomija nisu isprobani stvarnim igranjem; cijene, trajanje rasta i cijene izuma su procjene u `src/data.js`.
- Cijene nadogradnji (v27, v29) su procjene. Staklenik, Roj i Inkubator mogu znatno ubrzati zaradu; nije isprobano igranjem koliko.
- Ravnoteža web shopa (šanse po kanalu, +30 %, rok, trajanje izrade) nije isprobana igranjem.
- Postoci ljestvice cijena (+5 / +10 / +30 %) su procjene i nisu isprobani igranjem. Kanali se rade samo jednom i nemaju nadogradnje.
- Online narudžbe ne traže ribu, gljive ni kupine, samo plodove iz kataloga, jaja i med.
- Slavina je samo na prvom polju; drugo polje se zalijeva s nje ili s bunara.
- Nadogradnje košnice i malča mogu se kupiti i prije prve košnice ili vreće malča.
- Cijene nadogradnji (v27) su procjene. Nova farma sad počinje sa slabijom vodom iz prskalica (50 % umjesto 75 %) i dronom koji bere samo ★★, pa rana automatizacija vrijedi manje nego prije v27.
- Prva berba stiže drugo jutro (rotkvica, mrkva); prvi dan igru nose šuma, kokošinjac i honorarci. Novi tempo rasta nije isproban igranjem.
- Ako se dvije farmerove poruke dogode istovremeno, druga zamijeni prvu u oblačiću.
- Tempo ručnog rada (v35) nije isproban igranjem: serija na 48 parcela traje oko 7 sati u igri. Radnja u tijeku i red poslova ne spremaju se; nakon ponovnog učitavanja farmer stoji.
- Berba s punom torbom javi „torba puna“ tek nakon 1,5 s rada; brojač kod dodavanja sadnje povlačenjem može pokazati više parcela nego što ima sjemena (posao stane kad sjeme nestane).
- Povlačenje radi samo mišem; na dodirnom ekranu nije rađeno.
- Oznake na mapi vide se samo kad je to mjesto u kadru; što se dogodi izvan kadra (npr. kupnja dok je farmer na polju) nigdje ne ostaje zapisano. Upozorenja koja stižu jednom na dan pamte se samo do ponovnog učitavanja stranice.
- Glatkoća zooma nije provjerena automatski, samo da konačni prikaz radi.
- Dijelovi pločica ribnjaka uz uglove izgledaju kao trava, ali farmer na njih ne može.
- Ime aplikacije na mobitelu još nije odabrano (zasad „📱 Mobitel“).
- Grad se ne vidi: farmer i kombi samo odu s mape, a prodaja na tržnici se simulira. Ravnoteža tržnice (zakup, kombi, dnevnica, broj kupaca) nije isprobana igranjem.
- Na tržnici se jaja broje zajedno s kilogramima u zbroju „prodano X kg“.
- Na uskim ekranima (ispod oko 700 px) ploče nad mapom prekrivaju velik dio mape; mobilni raspored nije posebno rađen.
- Pumpa koja je već dostavljena dvaput (prije v15) ostaje u škrinji; višak se zasad ne može prodati.
- `pixel-runner` nije pokretan na ovom računalu (nema Pygame).

## Sljedeći koraci

Ideje koje su predložene, a još nisu napravljene:

0. **Vlasnikova lista od 16. 11.** (redom): ~~1. rad na polju~~ (v35); **3. sučelje**: sortiranje i premještanje u torbi i škrinji, jasnije oznake na radnom stolu za ono što fali (sa skicama), vlastiti raspored alatne trake i tipki; **4. materijali** (rezanje drva, kamenolom ili dostava kamena, čavli, čekić, boja) – **prije izrade stati i dogovoriti s vlasnikom logičan potez**; 5. staja i životinje (koze, krave, ovce), ovisi o 4. Na pauzi: 2. polje koje se kupuje parcelu po parcelu (počinje s 4 parcele; ×1,5 po parceli raste prebrzo, treba dogovoriti drugu krivulju) i 6. reputacija na tržnici.
1. **Korak 3, drugi dio**: Joža vozi pakete na poštu **prije tržnice** (odluka vlasnika 16. 11.: ionako stigne ranije i čeka da se tržnica otvori) za dodatnu dnevnicu (jedini trošak dostave; kupac plaća samo online cijenu, bez poštarine). **Treći dio**: drugi kombi s drugim vozačem samo za dostavu i zaposlenik koji pakira pakete (vidi v27).
2. Isprobati igranjem novu ravnotežu (nadogradnje iz koraka 1 i 2, tržnica, kiša, malč, med i tegle, narudžbe, hladnjača) i po potrebi prilagoditi brojke u `src/data.js`.
3. Grad kao vlastita scena po kojoj farmer hoda (tržnica s drugim prodavačima, trgovina); tržnica bi mogla imati dnevnu potražnju po vrsti ploda.
4. **Lov (ideja vlasnika):** u šumi divljač (zec, fazan, divlja svinja); treba nešto napraviti ili kupiti (npr. luk i strijele ili lovačka dozvola), idle kao pecanje, meso za prodaju ili jelo, ograničen broj po danu.
5. Odabrati ime aplikacije na mobitelu.
6. Biranje gnojiva pri gnojenju (sad se uvijek prvo troši najbolje).
7. Ime ljubimca po izboru; ljubimac s nekom korisnom navikom (pas tjera vrane, mačka miševe iz škrinje).

## Handoff za novi chat

1. Repo je `/home/leon/Desktop/Work-Stuff/Projects` (GitHub `le0np/Projects`), radi se na grani `dev`. Projekt je u `dev-farm/`.
2. Prvo pročitati korijenski `CLAUDE.md`, `dev-farm/README.md` i ovaj dokument.
3. Pokretanje: `cd dev-farm && npm start` (http://localhost:8080). Testovi: `npm test`.
4. Arhitektura: `src/data.js` (brojke) → `src/sim.js` (čista pravila, testirana) → `src/render.js` + `src/art.js` (crtanje) i `src/ui.js` (DOM) → `src/main.js` (petlja, ulaz, poruke). Pravila ne smiju ovisiti o DOM-u.
5. Novac se u stanju čuva u srebrenjacima (cijeli brojevi), cijene se u `data.js` pišu u zlatnicima (`zl()`).
6. Format spremanja je v9 (`src/save.js`); kod promjene stanja dodati prijenos starijih spremanja. Nadogradnje izuma su u `UPGRADES` (`data.js`), razine u `s.levels`; nova linija se dodaje samo u tablicu, radni stol je sam crta. `of` kaže čija je linija (`owns()` u `sim.js`): izum s `once`, `well`, `coop`, `field` ili recept koji se radi više puta (`mulch`, `hive`).
7. Provjera u browseru: `devFarm.skip(sekunde)` premota vrijeme; headless Chromium je u `~/.cache/ms-playwright/chromium-1208/` i može se voziti preko DevTools protokola (Node 24 ima ugrađen `WebSocket`).
8. Nakon svake promjene ažurirati ovaj dokument (novi odjeljak, zadnja provjera, ograničenja, sljedeći koraci).
9. Veće promjene imaju dizajn u `docs/specs/` i plan izvedbe u `docs/plans/`.
10. 14. 11. je rad v25–v34 bio ostao samo na lokalnoj grani `backup-lokalno`; vraćen je 16. 11. Prije usklađivanja grana s GitHubom provjeriti da `dev` ima sve lokalne commitove.
