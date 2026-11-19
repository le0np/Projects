# dev-farm

2D farma za browser za ITjevce koji sanjaju o selu. Vodiš farmera po imanju klikovima miša: sadiš, zalijevaš, gnojiš i bereš, a kvalitetnu robu prodaješ na štandu uz cestu i na tržnici u gradu. Navečer ideš spavati, čime se igra sprema. Kako farma raste, developer u tebi gradi izume koji preuzimaju dio posla: prskalice, dron, skripte.

**Status:** 🚧 u izradi (v14 igriva)

## Pokretanje

Treba samo [Node.js](https://nodejs.org) 20 ili noviji, bez instalacije paketa.

```bash
cd dev-farm
npm start          # server na http://localhost:8080
npm test           # testovi pravila igre
```

Otvori `http://localhost:8080`. Drugi port: `PORT=3000 npm start`. Dvoklik na `index.html` ne radi jer browseri ne učitavaju JavaScript module s `file://`. Radi i bilo koji statički server, npr. `python3 -m http.server 8080` u ovoj mapi.

## Kako se igra

- **Kretanje:** klikni bilo gdje na mapi i farmer ode tamo najkraćim putem. Klik na zgradu ili parcelu znači „idi tamo i napravi nešto“.
- **Rad na polju traje:** farmer hoda 3 polja u sekundi (kao kupci), a svaki posao na parceli traje: sadnja, berba i čišćenje trule parcele 1,5 s, zalijevanje, gnojenje i malčiranje 1 s, punjenje kante 2 s. Za to vrijeme se sagne ili nagne kantu, a ispod njega ide traka napretka. Energija se troši kad je posao gotov; klik negdje drugdje ga prekida bez troška.
- **Povlačenje mišem:** drži lijevu tipku i povuci preko polja. Parcele na kojima odabrani alat ima posla dobiju žuti okvir, a kad pustiš tipku, farmer ih obiđe redom. Povlačenje istim alatom dok farmer radi dodaje parcele na kraj popisa.
- **Trule parcele:** „Poberi sve“ (▾ uz ruke ili tipka B) i povlačenje rukama beru zrele i usput čiste trule parcele (1,5 s i 1 ⚡ po parceli); serija trulu parcelu očisti, posadi istom vrstom i zalije. Na alatu ruku piše „zrelih: N · trulih: M“. Dron i replant.py trulež ne diraju.
- **Serija (berba → sadnja → zalijevanje):** ▾ uz ruke → „Serija: poberi, posadi, zalij“ (sve ili jedna vrsta), ili povlačenje rukama uz Shift. Farmer pobere, posadi istu vrstu (ako nje nema, onu iz vrećice; ako nema ni nje, parcela ostaje prazna) i zalije.
- **Zoom:** gumbi + / − u kutu mape, kotačić miša ili tipke + i −. Zoom je gladak i uvijek oko farmera. Odabrani zoom se pamti.
- **Sortiranje i premještanje mišem:** gumb „Sortiraj“ iznad torbe, škrinje, štanda i kombija spoji hrpe iste stvari i složi ih po količini (najviše prvo, pa abecedno), bez praznih mjesta između. Predmet se može povući mišem: na prazno mjesto, na isti predmet (spoje se, višak ostaje) ili na drugi (zamijene mjesta); povučen u drugu mrežu (npr. iz torbe u škrinju) ide točno na mjesto gdje ga pustiš, uz ista pravila kao klik (na štand i u kombi samo roba za prodaju). Ručni raspored ostaje dok opet ne sortiraš.
- **Torba i mobitel su dio igre:** ikone ispod zooma (ili tipke **T** i **M**) otvaraju ih preko mape, desno. Kad je otvorena zgrada kojoj treba torba (škrinja, štand, kokošinjac, radni stol, parkiralište), torba se sama pokaže uz nju. Esc zatvara sve. Dok je mobitel zatvoren, nove poruke nakratko iskoče u donjem lijevom kutu mape, a na ikoni mobitela piše koliko ih nisi pročitao. Nova farma počinje s otvorenim mobitelom i uputama.
- **Skupni poslovi (▾ uz alat, ili tipke B, P, Z, G):** farmer sam obiđe polje, red po red. Sadnja troši sjeme, berba na kraju kaže koliko je čega po kvaliteti, zalijevanje kad se kanta isprazni samo ode po vodu (bunar ili ribnjak) i nastavi, a gnojenje pognoji onoliko biljaka koliko ima vreća gnojiva. Posao staje kad ponestane sjemena, gnojiva, energije ili mjesta u torbi. Klik na mapu ili Esc ga prekida.
- **Alati (tipke 1–6): ✋ ruke, 🌱 sjeme, 🪣 kanta, 🧪 gnojivo, 🎣 pecaljka, 🪵 malč.** Svaki alat ima dva dijela. Klik na sam alat radi jednu po jednu biljku: ruke beru, sjeme sadi (vrsta se bira u vrećici uz alate), kanta zalijeva (piše koliko je vode u njoj), gnojivo gnoji. ▾ uz alat radi isto na svim parcelama ili samo za jednu vrstu, a dok posao traje ▾ postaje ■ za prekid. Zrelu biljku ruke beru, a i bilo koji alat je bere klikom. Pecaljka (tipka 5) se pojavi kad je izradiš, a malč (tipka 6) kad ga imaš u torbi.
- **Vlastiti raspored alata i tipki** (⚙ postavke → Alatna traka i tipke): ◀ ▶ pomiču alat na traci, klik na tipku pa nova tipka je promijeni (ako je zauzeta, dvije akcije se zamijene), „Vrati zadano“ vraća sve. Mijenjaju se tipke alata, skupnih poslova (P, B, Z, G), torbe, mobitela i zooma; Esc uvijek prekida i zatvara. Raspored se pamti u browseru, kao i ostale postavke. Tipke spomenute u ovom README-u i priručniku su zadane.
- **Sjeme se broji i nije besplatno.** Na početku ga nema. Vrećica ispod alata pokazuje koliko kojeg imaš. Sjeme se dobiva na tri načina:
  - **Otkrivanjem:** u ladici u kući, a na imanju rastu stara rotkvica, divlja mrkva i divlji krumpir. Svako jutro nešto novo može niknuti samo od sebe.
  - **Iz plodova** na radnom stolu: neprodani plod daje 2–10 sjemenki, nasumično. Tako jedan usjev donosi puno novih.
  - **Dostavom:** naručiš na mobitelu („Dostava“), paket od 5 sjemenki stiže sutra ujutro. Katalog se širi kako zarađuješ. Ondje se naručuje i gnojivo ★★ (6 zl za vreću od 10 doza), koje stiže u škrinju.
- **Šuma:** uz rub šume svako jutro nikne nekoliko stvari: gljive i kupine (prodaju se na štandu ili jedu), grane (drva), kamenje i ponekad odbačeni dijelovi (komad crijeva ili prskalica). Drva i kamenje su materijal za gradnju (bunar, kokošinjac, košnica). **Željezo i plastika** su materijal za strojeve (dron, pumpa, mlaznice, kanta, hladnjača): naručuju se na mobitelu (Dostava → Materijal za strojeve: 5 kom željeza 8 zl, 5 kom plastike 6 zl) ili se nađu među odbačenim dijelovima u šumi.
- **Navodnjavanje se slaže iz dijelova:** vodena pumpa (montira se na bunar klikom na bunar), crijevo (10 m po prskalici) i prskalice. Dijelovi se naručuju na mobitelu (pumpa 70 zl, crijevo 10 m 9 zl, prskalica 8 zl) ili nađu u šumi. Prskalica se postavlja na **križanje četiri parcele**, pa ne zauzima nijednu, i svako jutro u 6 h zalije četiri parcele oko tog križanja (cijelo polje = 12 prskalica). Klik na postavljenu prskalicu vraća nju i crijevo u torbu. Pumpa pogoni ograničen broj prskalica (6, nadogradnjom 12 i 24); one koje ne pogoni stoje blijede.
- **Kokošinjac:** gradi se kao bunar: na radnom stolu se skicira plan popravka, a farmer ga popravlja na licu mjesta (25 zl, 10 drva, 4 kamena). Popravljen je prazan: kokoši se naručuju na mobitelu jedna po jedna (12 zl, najviše 9). Kokoši šeću oko njega i svako jutro snesu jaje ako je u hranilici bilo hrane: kokoš pojede oko 200 g na dan, pa 1 kg ploda nahrani 5 kokoši (hranilica drži 20 kg), idealno loši (★) plodovi. Hrani se klikom na plod u torbi dok je kokošinjac otvoren, a jaja se skupe klikom na kokošinjac i prodaju na štandu (40 sr po komadu) ili pojedu (+10 ⚡ po jajetu).
- **Pecanje (idle):** pecaljka se izradi na radnom stolu (2 drva i 4 zl za najlon i udicu). Uzmi je (tipka 5) i klikni ribnjak: farmer sjedne uz vodu i peca sam cijeli dan, dok ga ne pozoveš (klik drugdje ili Esc) ili dok ne padne mrak u 22 h. Pecanje nije naporno: troši samo 1 ⚡ na sat. Ulov je nasumičan: svako jutro ribnjak ima svoju sreću za taj dan (0–5 riba), pa farmer nekad upeca nekoliko riba, a nekad nijednu. Ribe su šaran (1–3 kg, 4 zl 50 sr/kg), linjak (1–2 kg, 7 zl/kg) i rijetka štuka (2–4 kg, 9 zl/kg), nasumične kvalitete ★ do ★★★. Ulov ide u torbu i prodaje se na štandu i tržnici ili pojede. Pecanje se nastavlja i nakon ponovnog učitavanja stranice.
- **Honorarci (mobitel → Poslovi):** svako jutro stigne 1–3 ponude poput „Susjedi Mari ne radi WiFi“ ili „Web stranica za OPG Horvat“. Prihvaćeni posao farmer radi kod kuće za laptopom (1–4 sata u igri, troši energiju) i odmah je plaćen (4–28 zl). Ako ga pozoveš van, napredak ostaje.
- **Usjevi rastu po danima, ne po sekundama.** Svako jutro biljka naraste jedan dan ako je dan prije bila zalivena, a pola dana ako nije. Zemlja ostaje vlažna cijeli dan i presuši preko noći, pa je **dovoljno zaliti jednom dnevno**. Ostatak dana tab može mirno stajati sa strane. Rast se vidi ujutro.
- **Kvaliteta ploda ima pet klasa, kao na tržnici: ★ škart, ★★ II. klasa, ★★★ I. klasa, ★★★★ ekstra, ★★★★★ za sajam** (plod koji osvaja nagrade na seoskom sajmu). Ovisi o tri stvari:
  - koliko je dana rasta biljka bila zalivena
  - je li pognojena i kojim gnojivom: bez gnojiva najviše ★★★, uz ★ ili ★★ gnojivo ★★★★, a **★★★★★ samo uz ★★★ gnojivo**
  - koliko je dana prošlo otkad je sazrela: najbolja je isti dan, svaki dan čekanja joj oduzima kvalitetu, a četvrto jutro istrune
- **Gnojivo:** jedna vreća ima 10 doza, dosta za 10 parcela, a u torbi se broji u dozama. Gnojivo ima kvalitetu ★ do ★★★: kompost na radnom stolu pravi se od 5 kg jedne vrste ploda i iste je kvalitete kao plod (škart daje ★, II. klasa ★★, I. klasa i bolje ★★★), a kupovno gnojivo je ★★. Gnoji se tipkom 4 ili ▾ uz gnojivo (G). Prvo se troši najbolje gnojivo iz torbe, osim ako dok je gnojivo u ruci u vrećici ispod alata odabereš jedno (★, ★★ ili ★★★): tada se troši samo ono, a ostalo se čuva.

- **Novac: zlatnici (zl) i srebrenjaci (sr), 1 zl = 100 sr.** U igri se umjesto „zl“ i „sr“ uz cijene crtaju pixel novčići: u panelima, na mobitelu, u priručniku, oblačiću i iznad štanda kad kupac plati. Zlatnik nosi sunce, a srebrenjak mjesec, oba s nazubljenim rubom (odabrano između 5 skica). Cijene prate stvarne tržišne cijene u Hrvatskoj: 1 zlatnik vrijedi otprilike koliko 1 € na tržnici.
- **Usjevi i cijene** (po kilogramu, za ★★):

  | Usjev | Raste | Urod po parceli | Cijena/kg | Paket sjemena (5 kom) |
  | --- | --- | --- | --- | --- |
  | Rotkvica | 1 dan | 1 kg | 3 zl 50 sr | 1 zl 50 sr |
  | Mrkva | 1 dan | 4 kg | 90 sr | 60 sr |
  | Krumpir | 2 dana | 6 kg | 1 zl | 70 sr |
  | Kupus | 2 dana | 5 kg | 1 zl 25 sr | 80 sr |
  | Blitva | 3 dana | 3 kg | 3 zl 90 sr | 1 zl 80 sr |
  | Rajčica | 3 dana | 4 kg | 3 zl | 2 zl |
  | Batat | 4 dana | 4 kg | 3 zl 30 sr | 2 zl 40 sr |
  | Bundeva | 4 dana | 9 kg | 1 zl 60 sr | 1 zl |

  **Sjeme nikad nije skuplje od ploda:** paket od 5 sjemenki uvijek košta manje od 1 kg tog ploda, a jedna sjemenka najviše desetinu onoga što njezina parcela donese. Zato svaka parcela zaradi otprilike 3–4 zl na dan (★★, sjeme plaćeno), bez obzira na usjev. U Dostavi uz svako sjeme piše po čemu se plod prodaje i koliko kg daje parcela. Što parcela više vrijedi, to dulje raste. Rotkvica i mrkva posađene danas zrele su sutra ujutro, pa se od drugog dana svaki dan ima što prodati, a skuplji usjevi traže više strpljenja. Bez zalijevanja sve raste upola sporije (i rotkvici tada trebaju dva dana).

  Skuplji usjevi pojavljuju se u katalogu dostave kako ukupno zarađuješ. Igra počinje s 30 zlatnika.
- **Štand uz cestu:** stavi plodove na štand. Kupci dolaze cestom od 08 do 19 h i uvijek uzmu najbolje što vide. Kupuju 1–4 kg odjednom. **Cijena ovisi o kvaliteti:** ★ pola cijene, ★★ tržišna cijena, ★★★ +30 %, ★★★★ +60 %, ★★★★★ dvostruko. Škart kupuju samo kad na štandu nema boljeg. Plodovi se mogu i pojesti za energiju, pretvoriti u kompost ili u sjeme.
- **Tržnica u gradu:** uz cestu je parkiralište s putokazom „GRAD“. Ondje se jednom zakupi klupa na tržnici (25 zl za cijelu sezonu). Grad je cestom na sjever: farmer pješice treba 1 h, a kombi 20 min; a tržnica radi 07–13 h: kupaca je puno više nego na štandu, uzimaju po 2–6 kg i plaćaju 10 % više nego na štandu. Farmer nosi robu iz **torbe**: sa „Idi na tržnicu s torbom“ ode cestom i nestane s mape, prodaje dok ne proda sve ili dok se tržnica ne zatvori, pa se vrati (najkasnije oko 14 h). Za to vrijeme farma radi bez njega, a u gornjoj traci piše koliko je prodao. Klik na tu oznaku (🧺 … ↩) ga vraća ranije.
- **Web shop (prodaja preko interneta):** na laptopu u kući (klik na kuću) farmer sam napravi web shop (4 h), a zatim Google Business profil (1 h), SEO (3 h) i društvene mreže (2 h). To je rad kao honorarac, ali bez plaće: troši vrijeme i energiju, a svaki kanal donosi više online narudžbi (web shop sam otprilike 3 narudžbe u 5 dana, sva četiri oko dvije na dan, najviše 5 otvorenih). Narudžba traži plod iz kataloga (ili jaja i med, kad ih imaš) u nekoj klasi, ima rok od 2–4 dana i plaća vrijednost robe u paketu po cijeni na štandu plus 30 % (bolja klasa od tražene po svojoj cijeni). Pakira se iz torbe u **kutiju za pakete** na parkiralištu (1 ⚡), a farmer pakete nosi na **poštu u grad** (pješice 1 h, pošta radi do 17 h) ili ih ponese kad ide na tržnicu. Plaća se na pošti. Što se ne pošalje na vrijeme propadne, a spakirani paket se vrati u škrinju. Kod kutije za pakete može se zaposliti **pakirica Kata**: svako jutro u 6 h spakira nove narudžbe iz škrinje (najslabiju dovoljno dobru robu) za 6 zl, samo na dane kad nešto spakira.
- **Kombi i zaposlenik:** na parkiralištu se kupi rabljeni kombi (800 zl) i zaposli vozač Joža. Robu utovariš u kombi (klik na plod u torbi dok je parkiralište otvoreno, 12 mjesta). Joža svako jutro u 6 h sam odveze sve što je u kombiju na tržnicu (vožnja traje 20 min, triput brže nego pješice) i vrati se oko 13:20 s novcem. Dnevnica je 30 zl i plaća se samo na dane kad vozi: prazan kombi ostaje doma i ništa ne košta. Kombi se može poslati i tijekom dana („Pošalji sad“), ako stigne prije zatvaranja; zbog kraće vožnje može krenuti i do 12:40, kad je pješice već prekasno. Neprodano ostaje u kombiju i ide opet sutra. **Joža vozi i pakete:** kad krene, uzme sve spakirane pakete iz kutije i prvo ih preda na pošti (tržnica se ionako otvara tek u 7 h), za 10 zl povrh dnevnice. Ako u kombiju nema robe, vozi samo pakete na poštu, za tih 10 zl. Na tržnici se jaja broje u komadima, odvojeno od kilograma („prodano 12 kg i 10 jaja“).
- **Kuća:** spavanje (od 18 h) završava dan, vraća svu energiju i **sprema igru**. Ranije se ne može, inače bi se spavanjem preskakali dani rasta. Kava (1 zl 50 sr) daje +35 energije. Tko ostane budan do 02 h, zaspi na nogama i budi se s pola energije.
- **Energija:** svaki posao troši energiju (sadnja 2, zalijevanje, gnojenje i berba po 1). Hodanje je besplatno.
- **Voda:** na početku samo **ribnjak** puni kantu (12 zalijevanja; velika kanta 30, nadogradnjama 50 i 80). **Bunara nema:** kod kuće je gradilište. Na radnom stolu se skicira plan, a onda farmer ode na gradilište i zida (nekoliko sekundi, 150 zl, 12 kamena, 6 drva i 30 energije; plaća se tek kad je gotovo, a ako farmer ode, zidanje stane). Kad je sazidan, voda je blizu polja i postaje izvor za **navodnjavanje** (vidi gore). Nadogradnja bunara **Slavina uz polje** (60 zl, 3 željeza, 2 plastike) stavi slavinu na južnu ogradu prvog polja: kanta se puni ondje, i kod skupnog zalijevanja.
- **Škrinja** (24 mjesta) za višak. Torba ima samo 8 mjesta. Plodovi u škrinji polako gube kvalitetu (svako jutro 40 % šanse da hrpa padne za klasu); **hladnjača** s radnog stola (150 zl, 6 željeza, 4 plastike) to zaustavlja i škrinja postane plava. Police u hladnjači (nadogradnja) daju 36 pa 48 mjesta.
- **Kiša i prognoza:** otprilike svaki peti dan pada kiša i ujutro zalije sve posađeno (i ono što se posadi tog dana), kao ručno zalijevanje. Po kiši dolazi manje kupaca. Prognoza za sutra stiže svako jutro na mobitel i piše uz sat u gornjoj traci (☀️/🌧️). Uz sat je i dan u tjednu.
- **Malč:** malčirana zemlja ostaje vlažna dva dana, pa je dovoljno zalijevati svaki drugi dan. Radi se na radnom stolu (2 drva → 10 doza) ili naručuje (3 zl za 10 doza); stavlja se alatom 6 ili ▾ na sve parcele i ostaje do berbe. Nadogradnje: **Drobilica** (2 drva → 20 doza) i **Kora** (zemlja vlažna 3 dana; vrijedi za parcele malčirane nakon nadogradnje).
- **Narudžbe kupaca:** ponekad se ujutro javi kupac („8 kg mrkve ★★★ ili bolje do petka“), najviše tri odjednom. Predaju se na štandu iz torbe; kupac plaća predanu robu po cijeni na štandu plus 5 % (bolja klasa od tražene po svojoj cijeni); ako se ne predaju do roka, propadnu. Popis je i na mobitelu (Poslovi).
- **Otkup:** na mobitelu (Dostava → Otkup) se višak dijelova, gnojiva, malča i ukrasa prodaje za pola cijene, prvo iz škrinje pa iz torbe.
- **Pčele i med:** košnica s radnog stola (10 zl, 6 drva) postavi se na travu (najviše 5). Svaki drugi dan napuni 1 kg meda (najviše 6 kg), koji se klikom skupi **u tegle** (Dostava → Tegle za med, 10 kom za 3 zl; jedna tegla po kilogramu, bez tegli med ostaje u košnici) i prodaje po 12 zl/kg ili pojede. Nadogradnje (vrijede za sve košnice): **Nastavak** (10 kg), **Matica** (med svaki dan) i **Roj** (pčele oprašuju parcele do 5 polja od košnice: +4 boda kvalitete, pa savršena parcela s ★★ gnojivom daje ★★★★★).
- **Uređenje farme:** na mobitelu (Dostava → Uređenje farme) se naručuju kamena staza, ograda, cvjetna gredica, klupa, vrtni patuljak i lampion (noću svijetli). Iz torbe se postave na travu („Postavi na travu“, pa klik, više komada zaredom), a uklanjaju se gumbom „Ukloni košnicu ili ukras“. Ograda, klupa i košnica zaprečuju prolaz, ali igra ne dopušta da zatvore put do kuće, polja, zgrada ili ceste.
- **Ljubimac:** pas Šarko ili mačka Maca iz skloništa (5 zl, Dostava → Ljubimac) prati farmera i sjedne kad stane; klik na ljubimca je maženje, a jednom na dan daje +5 ⚡. Ime mu biraš sam (Dostava → Ljubimac → „Promijeni ime“).
- **Obavijesti:** na mobitel (i u kut mape) stiže samo ono što traži igrača: dronu fali sjeme ili gnojivo, škrinja je puna, štand je prazan, gladne kokoši, trulež, prazan spremnik gnojiva, narudžbe kupaca i jutarnji izvještaj. Ponavljajuća upozorenja stižu jednom na dan. Sitnice (kupac na štandu, berba drona, jaja, dostava, kombi) pišu se kratko na mapi, iznad štanda, drona, kokošinjca, škrinje ili parkirališta, i nestanu za 5 s.
- **Obavijesti u browseru** (⚙ postavke): kad igra nije u fokusu, browser javi da je nešto sazrelo, da je štand prazan, da se kombi vratio ili da je stigla narudžba kupca.
- **Radni stol (izumi):** svaka kartica ima sličicu onoga što se radi i oznake za sve što treba: zeleno ✔ kad to imaš, crveno koliko imaš od potrebnog (4/6 drva) i koliko novca fali, a ispod piše gdje se nabavlja ono što fali.

  | Izum | Što radi |
  | --- | --- |
  | Sjeme iz plodova | 1 plod → 2–10 sjemenki |
  | Kompost | 5 kg ploda → vreća gnojiva (10 doza) iste kvalitete, najviše ★★★ |
  | Plan popravka kokošinjca | skica; kokošinjac popravlja farmer na licu mjesta |
  | Plan bunara | skica; bunar zida farmer na gradilištu |
  | Navodnjavanje (kad je bunar sazidan) | nadogradnje **Pumpa** (6 → 12 → 24 prskalice; 120 zl + 4 željeza, 300 zl + 8 željeza) i **Mlaznice** (voda vrijedi 50 % → 80 % → 100 % ručnog zalijevanja → fertigacija; 80 zl + 2 plastike, 200 + 4, 400 + 8). Fertigacija: gnojivo iz torbe ulije se u spremnik kod pumpe (60 doza), a prskalice svako jutro pognoje sve što raste i nije pognojeno, prvo najboljim |
  | Bunar (kad je sazidan) | nadogradnja **Slavina uz polje** (60 zl + 3 željeza, 2 plastike): kanta se puni na ogradi polja |
  | Kokošinjac (kad je popravljen) | **Prostor** 9 → 12 → 15 kokoši (40 zl + 6 drva, 2 kamena; 80 zl + 10 drva, 4 kamena), **Hranilica** 20 → 40 → 60 kg (30 zl + 4 drva; 60 zl + 3 željeza), **Inkubator** (90 zl + 2 željeza, 3 plastike): jaje iz kokošinjca grije se 3 jutra i izleže se nova kokoš, dok ima mjesta |
  | Polje | **Staklenik** (350 zl + 10 drva, 12 plastike): sve na poljima dozrijeva dan brže, najmanje 1 dan |
  | Pecaljka (2 drva, 4 zl) | peti alat: pecanje na ribnjaku. **Štap** 30 → 50 → 70 % ulova ★★★ (40 zl + 3 drva; 120 zl + 2 željeza, 2 plastike), **Mamac** riba grize 30 % pa 50 % brže (25 zl, 70 zl), **Mreža za ribu** do 7 riba na dan umjesto 5 (100 zl + 4 plastike) |
  | Malč (2 drva) | vreća malča, 10 doza; **Drobilica** 20 doza (60 zl + 3 željeza), **Kora** 3 dana vlage (50 zl + 4 drva) |
  | Košnica (10 zl, 6 drva) | med svaki drugi dan; **Nastavak** 10 kg (30 zl + 4 drva), **Matica** med svaki dan (60 zl), **Roj** oprašivanje (80 zl) |
  | Hladnjača (150 zl, 6 željeza, 4 plastike) | plodovi u škrinji ne gube kvalitetu; **Police** 36 → 48 mjesta (120 zl + 4 željeza, 2 plastike; 250 zl + 6 željeza, 4 plastike) |
  | Velika kanta (15 zl) | 30 zalijevanja umjesto 12; nadogradnje 50 (40 zl + 2 željeza) i 80 (90 zl + 4 željeza) |
  | `harvest-drone` (300 zl, 3 željeza, 3 plastike) | sam bere zrele usjeve, nosi ih u košari i istovari u škrinju. **Kamera** određuje do koje kvalitete bere: ★★ → ★★★ → ★★★★ → ★★★★★ (250 zl + 3 plastike, 500 + 6, 900 + 10); bolje plodove ostavlja farmeru i ujutro javi koliko ih je ostavio. **Motori**: 6 → 9 → 12 polja/s i kraći predah (150 zl + 3 željeza, 350 + 6). **Košara**: 1 → 3 → 6 parcela po letu prije povratka do škrinje (200 zl + 4 drva, 400 + 8) |
  | `replant.py` (150 zl) | dron nakon berbe ponovno posadi isto, ako ima sjemena; v2 (120 zl) i zalije, v3 (250 zl) i pognoji gnojivom iz škrinje |
  | Reklame i plakati (20 zl) | plakat uz cestu: +10 % kupaca na štandu; nadogradnje letci, oglas u novinama, reklama na radiju i jumbo plakat, svaka još +10 % (40, 80, 150, 250 zl), ukupno +50 %. Stara SEO ploča (+60 %) postala je jumbo plakat |
  | `git clone polje` (400 zl) | otključava drugo, zaraslo polje (još 48 parcela) |

  Izrađeni izum ostaje na radnom stolu kao kartica s nadogradnjama (bunar, kokošinjac i polje imaju svoje kartice, a malč i košnica nadogradnje na kartici recepta): razina, što donosi sljedeća i gumb „Nadogradi“ s cijenom i materijalom. Na početku strojevi zaostaju za rukama (prskalica 50 % ručnog zalijevanja, dron do ★★), a nadogradnjama se penju do ★★★★★. Tako je potpuno automatska farma cilj za kasnu igru, a ne poklon na početku.
- **Farmer govori u oblačiću:** kad nešto ne može (nema sjemena, kanta je prazna, nema snage) ili pronađe i ubere nešto, to kaže iznad glave.
- **Mobitel** ima obavijesti (samo bitne, vidi gore), Dostavu, Poslove i Priručnik. (Ime appa još biramo.)
- **📖 Priručnik (mobitel → Priručnik):** kako se što radi i pravi: gnojivo, sjeme, bunar, navodnjavanje, kokošinjac, šuma, energija, prodaja, tržnica, honorarci, svi izumi s radnog stola i tipke. Tražilica na vrhu (npr. „gnojivo“) otvori najbolju temu, a radni stol ima gumb „Kako se što radi“. Sve brojke u priručniku čitaju se iz `src/data.js`, pa su uvijek iste kao u igri.
- **Dostava:** radi kao web shop: svaki artikl ima cijenu (sitno, samo zlatnici i srebrenjaci) i brojač „− broj +“. Broj je koliko paketa stiže sutra; + naruči još jedan, − ga otkaže uz povrat novca u cijelosti. Traka na vrhu („📦 Sutra stiže 3 stavke · …“) je uvijek jedan red, pa se popis pri naručivanju ne pomiče i red koji gledaš ostaje na mjestu. Vodena pumpa se ne može naručiti dvaput: bunar treba samo jednu, pa je + zaključan kad je pumpa naručena, u torbi ili škrinji, ili već na bunaru.
- **Gradnja (bunar, kokošinjac):** cijena piše na kartici plana, a nakon skiciranja radni stol pokazuje popis s kvačicama (novac, drva, kamen, snaga): što imaš, a što još fali. Ako farmer pokuša graditi bez svega, kaže točno što mu fali.
- **Prebacivanje:** kad je otvorena škrinja, štand, kokošinjac ili kombi na parkiralištu, uz torbu biraš koliko jedan klik prebacuje: po 1, po 5 ili sve.
- **⚙ Postavke:** „Vrijeme teče i kad igra nije na ekranu“ (zadano isključeno) i brisanje farme.
- **Uz posao:** naslov taba pokazuje koliko je usjeva zrelo (`🌾 3 za berbu`). Dok je tab skriven, vrijeme stoji, pa ništa ne istrune dok si na sastanku. Igra se tiho sprema i kad zatvoriš tab, pa ne gubiš napredak ni bez spavanja.

## Kako je napravljeno

- **Čisti HTML, CSS i JavaScript (ES moduli)**, bez frameworka, build koraka i ovisnosti.
- **Sva pravila su u `src/sim.js`** kao čiste funkcije nad jednim objektom stanja, bez DOM-a: kretanje, rast, kvaliteta, kupci, dron, spavanje. Zato se testiraju izravno iz Nodea (`node --test`), a browser samo crta i prosljeđuje klikove.
- **Mapa (48×32 polja) se gradi u kodu** (`src/world.js`) od pravokutnika i deterministički raspoređenog drveća. Svaki put ista, a lako se mijenja.
- **Traženje puta:** Dijkstra po mreži. Farmer ide najkraćim putem, a kupci preferiraju cestu i stazu i ne gaze po poljima.
- **Pixel art se generira u kodu, piksel po piksel** (`src/pixel.js` + `src/art.js`), bez ijedne slike. Polje je 32×32 piksela, likovi 24×32, kuća 208×192. Za izgled se brinu:
  - sjenčanje kao da svjetlo pada odozgo lijevo, pa svaki oblik ima volumen
  - ditherani prijelazi između tonova
  - obrisi u tamnijoj nijansi susjedne boje umjesto crne linije
  - noise za travu, zemlju, koru i crijep

  Teren (organski rubovi staza, obala ribnjaka, trska, cvijeće) iscrta se jednom u veliki pozadinski canvas. Drveće, zgrade, ograde i likovi crtaju se po dubini, pa farmer može stati iza drveta.
- **Atmosfera:** dim iz dimnjaka, svjetlucanje vode, prskanje prskalice, a noću zaseban sloj svjetla: prozori i lampioni bacaju toplu svjetlost, uz krijesnice.
- Grafika se skalira samo cijelim brojevima piksela (ovisno o ekranu), pa pikseli ostaju oštri.
- **Ljestvica cijena (pravilo vlasnika):** štand je najjeftiniji jer nema dodatnih troškova; svaki kanal s troškom plaća više: narudžba na štandu +5 %, tržnica +10 % (na punom tržnom danu otprilike Jožina dnevnica), online +30 % (pakiranje, pošta). Dostava paketa košta samo Jožinu dnevnicu; kupac plaća samo online cijenu, poštarina se ne računa. Narudžbe plaćaju predanu robu, svaku klasu po njezinoj cijeni. Postoci su u `src/data.js` (`REQUESTS.bonus`, `MARKET.markup`, `ONLINE.markup`).
- **Grad je izvan mape:** farmer i kombi odlaze cestom na sjever i nestaju s ruba mape, a prodaja na tržnici se simulira u `src/sim.js` (isti kupci kao na štandu, samo češće i veće količine). Tako nije trebalo graditi drugu scenu, a putovanje se ipak vidi: farmer hoda cestom, kombi izlazi s parkirališta, vozi se i vraća (pixel art iz tri kuta: sa strane, straga i sprijeda).
- **Ručni rad je namjerno spor (odluka vlasnika):** radnje traju kao u igrama tog žanra, a farmer hoda brzinom kupaca. Serija na polju od 48 parcela traje oko 7 sati u igri, pa se rastom farme isplate dron, replant.py i prskalice; ručni rad ostaje put do najbolje kvalitete. Tehnički, dolazak na parcelu ne izvršava posao odmah nego postavlja `farmer.busy = { what: 'work' }`, a kad istekne, izvrši se isti kod kao prije; povlačenje i serija samo pune postojeći red skupnih poslova.
- **Vrijeme:** 1 sekunda = 2 minute u igri, pa dan od 06 do 02 h traje 10 minuta. Usjevi rastu jednom dnevno, u jutarnjem koraku simulacije (`newDay` u `src/sim.js`). Noć je tamni sloj preko mape, a prozori kuće svijetle.
- **Novac** se u stanju igre čuva u srebrenjacima (cijeli brojevi), da nema grešaka zaokruživanja. Cijene se u `src/data.js` pišu u zlatnicima.
- **Spremanje:** `localStorage`. Farme iz starijih verzija prenose se automatski: stare kovanice se pretvaraju u nove (1 stara kovanica = 40 sr), a v2 farme zadrže bunar i dobiju 10 sjemenki rotkvice. Spavanje sprema „službeno“, uz to se tiho sprema svakih 30 s i pri zatvaranju taba. Ako je farmer ili kombi u gradu kad se tab zatvori, putovanje se nastavlja nakon učitavanja. Učitani podaci se provjeravaju polje po polje, a pokvaren ili stari zapis znači novu farmu umjesto rušenja.
- **Nadogradnje izuma** su jedna tablica `UPGRADES` u `src/data.js` (polje `of` kaže čija je linija: izum, zgrada `well`/`coop`, `field` ili recept koji se radi više puta, `mulch`/`hive`): svaka linija (kamera drona, pumpa, mlaznice…) ima vrijednosti po razinama i cijenu svakog koraka, a radni stol iz nje sam crta kartice. Novi izum s nadogradnjama dobiva ih dodavanjem retka, bez novog koda u sučelju. Doseg prskalice više se ne nadograđuje (12 prskalica pokrije polje već na prvoj razini, pa razine nisu imale smisla); umjesto toga pumpa ograničava broj prskalica, a mlaznice kvalitetu vode.
- **Odluke od 19. 11. (vlasnik je rekao da odlučim sam, a pitanja ostavim za kraj):** Jožin dodatak za poštu je 10 zl (trećina dnevnice, jer je pošta usput i traje kraće od tržnice), a ako nema robe za tržnicu, vozi samo pakete za tih 10 zl; pakirica Kata dobiva 6 zl na dan kad pakira, pakira samo iz škrinje (ne iz torbe, koju farmer nosi sa sobom) i radi ujutro prije Jožinog polaska. Vlastite tipke i raspored alata su postavka browsera (kao „vrijeme teče i kad igra nije na ekranu“), ne dio spremljene farme. Ime ljubimca se mijenja kroz prozorčić browsera (`prompt`), jer bi polje za upis na mobitelu gubilo upisano svaki put kad se mobitel iscrta iznova. „Skice“ na radnom stolu su sličice 16×16 piksela u stilu ostale grafike.
- Kad se ploča ili popis iscrta iznova (npr. jer se promijenio novac), popisi koji se pomiču zadrže položaj, pa radni stol i Dostava ne skaču na vrh.
- Žanr je inspiriran igrama poput Graveyard Keepera (farmer, poslovi, kuća, prodaja), ali grafika, likovi i svijet su originalni.
- U konzoli browsera `devFarm.state` pokazuje cijelo stanje igre, a `devFarm.skip(30)` premota 30 sekundi (1 sat u igri) s porukama, za debugiranje.

## Struktura

```
.
├── index.html        # stranica: HUD, mapa s gumbima i pločama (zgrada, torba, mobitel), alati
├── style.css         # tamna "IDE" tema
├── server.js         # mali statički server za npm start
├── package.json
├── src/
│   ├── data.js       # brojke: usjevi, cijene, vremena, recepti
│   ├── world.js      # mapa, zgrade, gdje se stoji da se nešto koristi
│   ├── path.js       # traženje puta (Dijkstra)
│   ├── sim.js        # pravila igre (čista logika)
│   ├── save.js       # spremanje i provjera učitanog
│   ├── pixel.js      # alat za pixel art: oblici, svjetlo, dithering, obrisi
│   ├── art.js        # sva grafika: teren, zgrade, likovi, usjevi, ikone
│   ├── render.js     # kamera, svijet, likovi, noć, efekti
│   ├── ui.js         # HUD, alati, torba, paneli, mobitel
│   ├── guide.js      # priručnik na mobitelu (teme s brojkama iz data.js, tražilica)
│   ├── keys.js       # vlastiti raspored alata i tipki (čista logika)
│   └── main.js       # petlja, klikovi, tipke, poruke
└── tests/
    ├── sim.test.js
    ├── keys.test.js
    └── guide.test.js
```

## Moguća poboljšanja

- Ravnoteža brojki nakon pravog igranja: cijene, trajanje dana i potrošnja energije su procjene.
- Unutrašnjost kuće kao zasebna scena (kuhinja, krevet, nadogradnje kuće).
- Grad kao vlastita scena po kojoj se hoda (tržnica, trgovina, drugi prodavači).
- Godišnja doba (kiša i prognoza već postoje).
- Reputacija štanda (narudžbe kupaca već postoje).
- Zvukovi s gumbom za isključivanje.
- Upravljanje tipkovnicom (WASD) uz klikove.
