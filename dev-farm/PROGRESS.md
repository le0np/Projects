# Napredak projekta dev-farm

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Igra je igriva u browseru. Farmer se kreće po mapi 48×32 klikovima miša i radi s četiri alata (ruke, sjeme, kanta, gnojivo); svaki radi biljku po biljku ili, preko ▾, na cijelom polju. Može otkrivati sjeme, saditi, zalijevati, gnojiti i brati, a plodove prodaje na štandu uz cestu ili na tržnici u gradu (sam, ili kasnije kombijem i zaposlenikom). Usjevi rastu po danima: dan traje 10 minuta, a rast se događa svako jutro. Kvaliteta ploda (★ do ★★★★) ovisi o zalijevanju, gnojivu i pravodobnoj berbi, a cijena o kvaliteti. Novac su zlatnici i srebrenjaci s omjerima prema stvarnim tržišnim cijenama u Hrvatskoj. Na radnom stolu se izrađuju izumi: plan bunara, prskalice s 10 razina navodnjavanja, dron, replant.py, SEO ploča i drugo polje. Mobitel služi za obavijesti i dostavu sjemena i gnojiva, a farmer u oblačiću govori što radi i što ne može. Sva grafika je pixel art generiran u kodu.

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

## Zadnja automatizirana provjera

Provedeno 12. studenog 2026. nakon v24:

| Provjera | Rezultat |
| --- | --- |
| `npm test` u `dev-farm/` | 63/63 testova prolazi |
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
- Prva berba stiže drugo jutro (rotkvica, mrkva); prvi dan igru nose šuma, kokošinjac i honorarci. Novi tempo rasta nije isproban igranjem.
- Ako se dvije farmerove poruke dogode istovremeno, druga zamijeni prvu u oblačiću.
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

1. Isprobati igranjem novu ravnotežu (tržnica, kiša, malč, med, narudžbe, hladnjača) i po potrebi prilagoditi brojke u `src/data.js`.
2. Grad kao vlastita scena po kojoj farmer hoda (tržnica s drugim prodavačima, trgovina); tržnica bi mogla imati dnevnu potražnju po vrsti ploda.
3. **Lov (ideja vlasnika):** u šumi divljač (zec, fazan, divlja svinja); treba nešto napraviti ili kupiti (npr. luk i strijele ili lovačka dozvola), idle kao pecanje, meso za prodaju ili jelo, ograničen broj po danu.
4. Odabrati ime aplikacije na mobitelu.
5. Biranje gnojiva pri gnojenju (sad se uvijek prvo troši najbolje).
6. Ime ljubimca po izboru; ljubimac s nekom korisnom navikom (pas tjera vrane, mačka miševe iz škrinje).

## Handoff za novi chat

1. Repo je `/home/leon/Desktop/Work-Stuff/Projects` (GitHub `le0np/Projects`), radi se na grani `dev`. Projekt je u `dev-farm/`.
2. Prvo pročitati korijenski `CLAUDE.md`, `dev-farm/README.md` i ovaj dokument.
3. Pokretanje: `cd dev-farm && npm start` (http://localhost:8080). Testovi: `npm test`.
4. Arhitektura: `src/data.js` (brojke) → `src/sim.js` (čista pravila, testirana) → `src/render.js` + `src/art.js` (crtanje) i `src/ui.js` (DOM) → `src/main.js` (petlja, ulaz, poruke). Pravila ne smiju ovisiti o DOM-u.
5. Novac se u stanju čuva u srebrenjacima (cijeli brojevi), cijene se u `data.js` pišu u zlatnicima (`zl()`).
6. Format spremanja je v6 (`src/save.js`); kod promjene stanja dodati prijenos starijih spremanja.
7. Provjera u browseru: `devFarm.skip(sekunde)` premota vrijeme; headless Chromium je u `~/.cache/ms-playwright/chromium-1208/` i može se voziti preko DevTools protokola (Node 24 ima ugrađen `WebSocket`).
8. Nakon svake promjene ažurirati ovaj dokument (novi odjeljak, zadnja provjera, ograničenja, sljedeći koraci).
