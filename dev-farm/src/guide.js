// The handbook on the phone: how things are made and how the farm works.
// Every number comes from data.js, so the handbook stays right when the balance changes.
// No DOM here: topics are plain data ({ id, icon, title, body }), the UI draws them.
// A body block is a paragraph (string) or a list ({ list: [...] }).

import {
  CROPS, RECIPES, BUILDINGS, SHOP_ITEMS, GOODS, FORAGE, COOP, MARKET, GIGS, CAN_SIZES, COFFEE, EAT_ENERGY,
  ENERGY_COST, TIER_PRICE, MACHINE_MAX_TIER, SEEDS_FROM_FRUIT, SEED_PACK, HOUSE_SEEDS, FERTILIZER_PRICE,
  TIER_NAMES, FERT_BONUS, FERT_DOSES, COMPOST_KG, BOUGHT_FERT_TIER,
  RAIN_CHANCE, RAIN_CUSTOMERS, MULCH_DAYS, CHEST_DECAY, REQUESTS, HIVES, DECOR, PETS, BUYBACK,
  IRRIGATION_COSTS, HOSE_PER_SPRINKLER, ROT_DAY, SHOP_OPEN, SHOP_CLOSE, SLEEP_FROM, BAG_SIZE, CHEST_SIZE,
  STAND_SIZE, CUSTOMER_KG, SEO_BONUS, GIG_ENERGY_PER_HOUR, MAX_ENERGY, FISH, FISHING, GAME_MIN_PER_SEC,
} from './data.js';
import { sprinklerReach } from './sim.js';

// zlatnici (as written in data.js) → "3 zl 50 sr"
const zl = (z) => {
  const sr = Math.round(z * 100);
  const g = Math.floor(sr / 100);
  const s = sr % 100;
  return g ? (s ? `${g} zl ${s} sr` : `${g} zl`) : `${s} sr`;
};
const hour = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')} h`;
const days = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'dan' : 'dana'}`;
const shop = (id) => SHOP_ITEMS.find((i) => i.id === id);
const recipe = (id) => RECIPES.find((r) => r.id === id);
const build = (b) => `${zl(b.price)}, ${b.wood} drva, ${b.stone} kamena i ${b.energy} ⚡`;
const stars = (n) => '★'.repeat(n);
const tierList = TIER_NAMES.slice(1).map((name, k) => `${stars(k + 1)} ${name}`).join(', ');

export function guideTopics() {
  return [
    {
      id: 'fertilizer', icon: '🧪', title: 'Gnojivo',
      body: [
        `Jedna vreća gnojiva ima ${FERT_DOSES} doza: dosta za ${FERT_DOSES} parcela. U torbi se gnojivo broji u dozama.`,
        'Gnojivo ima kvalitetu (★ do ★★★). Dobiva se na dva načina:',
        { list: [
          `Kompost na radnom stolu: ${COMPOST_KG} kg jedne vrste ploda iz torbe daju 1 vreću (${FERT_DOSES} doza). Kompost je iste kvalitete kao plod: od škarta (★) je ★ gnojivo, od II. klase ★★, a od I. klase i boljeg ★★★.`,
          `Mobitel → Dostava → Gnojivo: ${zl(FERTILIZER_PRICE)} za vreću (${FERT_DOSES} doza) gnojiva ${stars(BOUGHT_FERT_TIER)}. Stiže sutra ujutro u škrinju, a odande ga prebaci u torbu.`,
        ] },
        `Gnoji se biljka koja još raste (ne zrela). Uzmi gnojivo u ruku (tipka 4) i klikni biljku, ili ▾ uz gnojivo (tipka G) pognoji sve redom, koliko ima doza u torbi. Jedna doza = jedna biljka, ${ENERGY_COST.fertilize} ⚡. Prvo se troši najbolje gnojivo iz torbe.`,
        `Što je gnojivo bolje, to bolji plod: ★ gnojivo +${FERT_BONUS[1]}, ★★ +${FERT_BONUS[2]}, ★★★ +${FERT_BONUS[3]} bodova kvalitete. Plod ★★★★★ (${TIER_NAMES[5]}) može dati samo ★★★ gnojivo, uz zalijevanje svaki dan i berbu isti dan kad sazri.`,
      ],
    },
    {
      id: 'seeds', icon: '🌱', title: 'Sjeme',
      body: [
        'Sjeme se broji i nije besplatno. Dobiva se ovako:',
        { list: [
          `U kući: pri prvom ulasku u ladici je ${HOUSE_SEEDS.n} sjemenki (rotkvica).`,
          'Na imanju: ponegdje raste divlja ili samonikla biljka (žuti cvat). Klikni je i farmer uzme sjeme. Svako jutro može niknuti nova.',
          `Iz plodova na radnom stolu: 1 plod iz torbe daje ${SEEDS_FROM_FRUIT[0]}–${SEEDS_FROM_FRUIT[1]} sjemenki, nasumično. Neprodani plod je najbolji izvor sjemena.`,
          `Dostavom: mobitel → Dostava, paket od ${SEED_PACK} sjemenki stiže sutra ujutro ravno u vrećicu. Skuplji usjevi pojave se u katalogu kad ukupno dovoljno zaradiš.`,
        ] },
        `Sadnja: uzmi sjeme (tipka 2), u vrećici ispod alata odaberi vrstu i klikni praznu parcelu (${ENERGY_COST.plant} ⚡). ▾ uz sjeme (tipka P) posadi sve slobodne parcele.`,
      ],
    },
    {
      id: 'crops', icon: '🥕', title: 'Usjevi: rast, urod i cijena',
      body: [
        'Usjevi rastu svako jutro: cijeli dan ako su dan prije bili zaliveni, pola dana ako nisu. Što parcela više vrijedi, to dulje raste.',
        { list: CROPS.map((c) => `${c.name}: ${days(c.days)} · ${c.yield} kg po parceli · ${zl(c.price)}/kg (★★) · sjeme ${zl(c.pack)}${c.unlock ? ` · u katalogu od ${zl(c.unlock)} ukupne zarade` : ''}`) },
        `Zreo plod najbolji je isti dan. Svaki dan čekanja oduzima kvalitetu, a ${ROT_DAY}. jutro istrune (klik očisti parcelu).`,
      ],
    },
    {
      id: 'quality', icon: '⭐', title: 'Kvaliteta i cijena',
      body: [
        `Kvaliteta ploda ima pet klasa: ${tierList}. Ovisi o tri stvari:`,
        { list: [
          'koliko je dana rasta biljka bila zalivena (ručno vrijedi više od prskalice)',
          'je li pognojena i kojim gnojivom (★ do ★★★)',
          'je li ubrana isti dan kad je sazrela',
        ] },
        { list: [
          'zaliveno svaki dan, bez gnojiva: ★★★ I. klasa',
          '+ ★ ili ★★ gnojivo: ★★★★ ekstra',
          `+ ★★★ gnojivo: ★★★★★ ${TIER_NAMES[5]}`,
          'svaki dan čekanja zrelog ploda ili dan bez vode spušta klasu',
        ] },
        `Cijena prema kvaliteti: ★ ${Math.round(TIER_PRICE[1] * 100)} %, ★★ tržišna cijena, ${[3, 4, 5].map((t) => `${stars(t)} +${Math.round((TIER_PRICE[t] - 1) * 100)} %`).join(', ')}. Kupci škart uzimaju samo kad nema boljeg.`,
        `Dron bere najviše ${stars(MACHINE_MAX_TIER)}, a voda iz prskalice vrijedi manje od ručnog zalijevanja. Najbolji plodovi idu iz farmerovih ruku.`,
        `Škart nije bačen: od njega je ★ gnojivo (${COMPOST_KG} kg = 1 vreća) ili hrana za kokoši.`,
      ],
    },
    {
      id: 'water', icon: '💧', title: 'Voda i zalijevanje',
      body: [
        `Kanta se puni na ribnjaku (ili na bunaru kad ga sazidaš) i drži ${CAN_SIZES[0]} zalijevanja. Velika kanta s radnog stola drži ${CAN_SIZES[1]}.`,
        `Uzmi kantu (tipka 3) i klikni biljku (${ENERGY_COST.water} ⚡), ili ▾ uz kantu (tipka Z) zalije sve: farmer sam ode po vodu kad se kanta isprazni.`,
        'Zemlja ostaje vlažna cijeli dan i presuši preko noći, pa je dovoljno zaliti jednom dnevno.',
      ],
    },
    {
      id: 'weather', icon: '🌧️', title: 'Vrijeme i kiša',
      body: [
        `Otprilike svaki ${Math.round(1 / RAIN_CHANCE)}. dan pada kiša. Kiša ujutro zalije sve posađeno, a i ono što se posadi tog dana: zalijevanje taj dan ne treba. Kiša vrijedi kao ručno zalijevanje.`,
        `Po kiši na štand dolazi manje kupaca (oko ${Math.round(RAIN_CUSTOMERS * 100)} %).`,
        'Prognoza za sutra stiže svako jutro na mobitel, a piše i kad mišem prijeđeš preko sata u gornjoj traci (☀️ ili 🌧️).',
      ],
    },
    {
      id: 'mulch', icon: '🪵', title: 'Malč',
      body: [
        `Malčirana zemlja ostaje vlažna ${MULCH_DAYS} dana umjesto jednog: dovoljno je zaliti svaki drugi dan, a biljka raste kao da je zalivena svaki dan.`,
        { list: [
          `Radni stol → „${recipe('mulch').name}“: ${recipe('mulch').mats.wood} drva → vreća malča (${recipe('mulch').n} doza).`,
          `Mobitel → Dostava → Malč: ${zl(shop('mulch').price)} za ${shop('mulch').n} doza.`,
        ] },
        'Malč je šesti alat (tipka 6), vidi se kad ga imaš u torbi. Klik na posađenu parcelu je malčira, a ▾ malčira sve. Jedna doza = jedna parcela; malč ostaje do berbe.',
      ],
    },
    {
      id: 'well', icon: '🪣', title: 'Bunar',
      body: [
        'Bunar se gradi u dva koraka:',
        { list: [
          'Radni stol → „Plan bunara“ (besplatno): skica.',
          `Klikni gradilište kod kuće i farmer zida. Gradnja traži ${build(BUILDINGS.well)} (drva i kamen u torbi). Plaća se tek kad je gotovo, a ako farmer ode, zidanje stane.`,
        ] },
        'Nakon skice radni stol pokazuje popis s kvačicama: što imaš, a što još fali.',
        'Bunar je izvor vode blizu polja i treba ga navodnjavanje (pumpa ide na bunar).',
      ],
    },
    {
      id: 'irrigation', icon: '🚿', title: 'Navodnjavanje (prskalice)',
      body: [
        'Prskalice same zalijevaju svako jutro u 6 h. Sustav se slaže od dijelova:',
        { list: [
          'sazidan bunar',
          `vodena pumpa (Dostava, ${zl(shop('pump').price)}): klikni bunar s pumpom u torbi i farmer je montira; treba samo jedna`,
          `crijevo: ${HOSE_PER_SPRINKLER} m po prskalici (Dostava, ${shop('hose').n} m za ${zl(shop('hose').price)})`,
          `prskalice (Dostava, ${zl(shop('sprinkler').price)}); crijevo i prskalice ponekad se nađu u šumi`,
        ] },
        'Klikni prskalicu u torbi → „Postavi na križanje“ i odaberi mjesto gdje se dodiruju četiri parcele. Klik na postavljenu prskalicu vraća nju i crijevo u torbu.',
        `Radni stol → Navodnjavanje: nadogradnje za sve prskalice. ${IRRIGATION_COSTS.slice(1).map((c, k) => `v${k + 2}: ${sprinklerReach(k + 2, 0, 0).length} parcela (${zl(c)})`).join(', ')}. Na početku (v1) prskalica zalije ${sprinklerReach(1, 0, 0).length} parcele.`,
      ],
    },
    {
      id: 'woods', icon: '🌲', title: 'Šuma: drva, kamen, gljive',
      body: [
        'Uz rub šume svako jutro nikne nekoliko stvari. Klikni ih i farmer ubere (1 ⚡):',
        { list: FORAGE.map((f) => `${f.name}${f.item === 'wood' ? ' → drva' : f.item === 'stone' ? ' → kamen' : f.loot ? ' → komad crijeva ili prskalica' : ' → za prodaju ili jelo'}`) },
        'Drva i kamen su materijal za gradnju (bunar, kokošinjac) i moraju biti u torbi.',
        `Za prodaju: ${GOODS.filter((g) => FORAGE.some((f) => f.id === g.id)).map((g) => `${g.name.toLowerCase()} ${zl(g.price)}/${g.unit}`).join(', ')}.`,
      ],
    },
    {
      id: 'fishing', icon: '🎣', title: 'Pecanje i pecaljka',
      body: [
        `Pecaljka se izrađuje na radnom stolu: ${recipe('rod').mats.wood} drva u torbi i ${zl(recipe('rod').price)} za najlon i udicu. Nakon toga je u alatima kao peti alat (tipka 5).`,
        { list: [
          'Uzmi pecaljku (5) i klikni ribnjak: farmer sjedne uz vodu i peca sam, bez tvoje pomoći.',
          `Peca cijeli dan, sve dok ga ne pozoveš (klik bilo gdje na mapi ili Esc) ili dok ne padne mrak u ${hour(FISHING.until)}.`,
          `Pecanje nije teško: troši samo ${FISHING.energyPerHour} ⚡ na sat.`,
          'Ulov je u torbu. Kad se torba napuni, farmer prestane.',
        ] },
        `Ulov je nasumičan. Svako jutro ribnjak ima svoju sreću za taj dan, od 0 do ${FISHING.daily.length - 1} riba: neke dane farmer upeca nekoliko riba, a neke nijednu. Kad ima sreće, riba zagrize svakih ${FISHING.every[0] * GAME_MIN_PER_SEC} min do ${(FISHING.every[1] * GAME_MIN_PER_SEC) / 60} h (vrijeme u igri).`,
        { list: FISH.map((f) => {
          const g = GOODS.find((x) => x.id === f.id);
          return `${g.name}: ${f.kg[0]}–${f.kg[1]} kg, ${zl(g.price)}/kg (★★)${f.weight <= 1 ? ', rijetka' : ''}`;
        }) },
        'Kvaliteta ribe je nasumična (★ do ★★★). Riba se prodaje na štandu i tržnici ili pojede.',
      ],
    },
    {
      id: 'coop', icon: '🐔', title: 'Kokošinjac i jaja',
      body: [
        { list: [
          'Radni stol → „Plan popravka kokošinjca“.',
          `Klikni stari kokošinjac kod kuće i farmer ga popravlja: ${build(BUILDINGS.coop)}.`,
          `Kokoši se naručuju na mobitelu (Dostava → Kokoš nesilica, ${zl(shop('hen').price)}), jedna po jedna, najviše ${COOP.maxHens}. Stižu ujutro ravno u kokošinjac.`,
        ] },
        `Hranjenje: otvori kokošinjac i klikni plod u torbi, ide u hranilicu (najviše ${COOP.feedCap} kg). Kokoš pojede oko ${COOP.feedPerHen * 1000} g na dan, pa 1 kg ploda nahrani ${Math.round(1 / COOP.feedPerHen)} kokoši. Najbolje za to je škart (★).`,
        `Svako jutro svaka nahranjena kokoš snese jaje. Jaja se skupe klikom na kokošinjac i prodaju po ${zl(GOODS.find((g) => g.id === 'egg').price)} komad ili pojedu (+${EAT_ENERGY[2]} ⚡ po jajetu).`,
      ],
    },
    {
      id: 'energy', icon: '⚡', title: 'Energija',
      body: [
        `Energije ima ${MAX_ENERGY}. Poslovi je troše (sadnja ${ENERGY_COST.plant}, zalijevanje, gnojenje i berba po 1), a hodanje je besplatno.`,
        { list: [
          `kava u kući: ${zl(COFFEE.price)}, +${COFFEE.energy} ⚡`,
          `pojedi nešto iz torbe (plod, jaje, gljive, ribu): +${EAT_ENERGY[1]} do +${EAT_ENERGY[4]} ⚡ po kg ili komadu, ovisno o kvaliteti (jaje +${EAT_ENERGY[2]} ⚡)`,
          `spavanje (od ${hour(SLEEP_FROM)}) vraća svu energiju`,
        ] },
        'Tko ostane budan do 02 h, zaspi na nogama i budi se s pola energije.',
      ],
    },
    {
      id: 'stand', icon: '🏪', title: 'Prodaja na štandu',
      body: [
        `Štand uz cestu ima ${STAND_SIZE} mjesta. Otvori ga i klikni plod u torbi (po 1, po 5 ili sve).`,
        `Kupci dolaze cestom od ${hour(SHOP_OPEN)} do ${hour(SHOP_CLOSE)}, kupuju ${CUSTOMER_KG[0]}–${CUSTOMER_KG[1]} kg i uvijek uzmu najbolje što vide. SEO ploča s radnog stola dovodi ${Math.round((SEO_BONUS - 1) * 100)} % više kupaca.`,
        'Za veće količine postoji tržnica u gradu (vidi „Tržnica, kombi i zaposlenik“).',
      ],
    },
    {
      id: 'market', icon: '🧺', title: 'Tržnica, kombi i zaposlenik',
      body: [
        `Parkiralište s putokazom „GRAD“ uz cestu. Ondje se jednom zakupi klupa na tržnici (${zl(MARKET.stall)}).`,
        `Tržnica radi ${hour(MARKET.open)}–${hour(MARKET.close)}, do grada je ${MARKET.travel / 60} h. Kupaca je puno više nego na štandu i uzimaju ${MARKET.kg[0]}–${MARKET.kg[1]} kg, po istim cijenama.`,
        { list: [
          'Sam: napuni torbu robom i na parkiralištu klikni „Idi na tržnicu s torbom“. Farmer se vraća kad sve proda ili kad se tržnica zatvori. Klik na 🧺 u gornjoj traci vraća ga ranije.',
          `Kombi (${zl(MARKET.van)}) i vozač ${MARKET.worker}: utovari robu u kombi (${MARKET.vanSize} mjesta). ${MARKET.worker} svako jutro u 6 h odveze sve na tržnicu i vrati se s novcem. Dnevnica je ${zl(MARKET.wage)}, samo na dane kad vozi.`,
        ] },
      ],
    },
    {
      id: 'requests', icon: '📝', title: 'Narudžbe kupaca',
      body: [
        `Ponekad se ujutro javi kupac s narudžbom, npr. „${REQUESTS.kg[1]} kg mrkve ★★★ ili bolje do petka“. Istodobno ih je najviše ${REQUESTS.max}.`,
        `Narudžba se predaje na štandu (gumb „Predaj iz torbe“), a plaća se ${Math.round(REQUESTS.bonus * 100)} % više od cijene na štandu za tu klasu. Bolja klasa od tražene također vrijedi; prvo se daje najslabija dovoljno dobra.`,
        'Popis narudžbi je i na mobitelu (Poslovi). Ako se ne preda do roka, kupac odustane.',
      ],
    },
    {
      id: 'gigs', icon: '💼', title: 'Honorarci',
      body: [
        `Mobitel → Poslovi: svako jutro stigne nekoliko ponuda. Prihvaćeni posao farmer radi kod kuće za laptopom (${Math.min(...GIGS.map((g) => g.hours))}–${Math.max(...GIGS.map((g) => g.hours))} h, ${GIG_ENERGY_PER_HOUR} ⚡ po satu) i odmah je plaćen (${zl(Math.min(...GIGS.map((g) => g.pay[0])))}–${zl(Math.max(...GIGS.map((g) => g.pay[1])))}).`,
        'Ako ga pozoveš van, napredak ostaje. Posao se nastavlja iz kuće ili s mobitela.',
      ],
    },
    {
      id: 'workbench', icon: '🔧', title: 'Radni stol: svi izumi',
      body: [
        `Na radnom stolu se izvadi sjeme iz plodova, od ${COMPOST_KG} kg ploda napravi vreća komposta (vidi „Gnojivo“) i izrađuje sve ovo:`,
        { list: RECIPES.map((r) => {
          const b = Object.values(BUILDINGS).find((x) => x.plan === r.id);
          const cost = b ? `plan besplatno, gradnja ${build(b)}` : r.price ? zl(r.price) : 'besplatno';
          return `${r.name} (${cost}): ${r.desc}`;
        }) },
        `Navodnjavanje se nadograđuje u 10 razina (vidi „Navodnjavanje“).`,
      ],
    },
    {
      id: 'storage', icon: '🎒', title: 'Torba, škrinja i dostava',
      body: [
        `Torba ima ${BAG_SIZE} mjesta, škrinja kod kuće ${CHEST_SIZE}. Torba i mobitel su ikone desno na mapi (tipke T i M).`,
        'Sve naručeno stiže sutra ujutro: sjeme u vrećicu, kokoši u kokošinjac, ostalo u škrinju. Na vrhu Dostave je popis „Stiže sutra ujutro“, a do jutra se svaka narudžba može otkazati uz povrat novca.',
      ],
    },
    {
      id: 'coldroom', icon: '❄️', title: 'Škrinja i hladnjača',
      body: [
        `Plodovi u škrinji polako gube kvalitetu: svako jutro svaka hrpa ploda ima ${Math.round(CHEST_DECAY * 100)} % šanse pasti za jednu klasu (do škarta).`,
        `Radni stol → „${recipe('coldroom').name}“ (${zl(recipe('coldroom').price)}, ${recipe('coldroom').mats.stone} kamena): škrinja postaje hladnjača i plodovi u njoj više ne gube kvalitetu. Škrinja tada postane plava.`,
      ],
    },
    {
      id: 'buyback', icon: '♻️', title: 'Otkup: prodaja viška',
      body: [
        `Mobitel → Dostava → Otkup: dijelovi (pumpa, crijevo, prskalice), gnojivo, malč i ukrasi koji ti ne trebaju prodaju se za ${Math.round(BUYBACK * 100)} % nove cijene, novac odmah.`,
        'Prodaje se paket po paket (npr. 10 m crijeva ili vreća gnojiva), prvo iz škrinje pa iz torbe.',
      ],
    },
    {
      id: 'bees', icon: '🐝', title: 'Pčele i med',
      body: [
        `Radni stol → „Košnica“ (${zl(recipe('hive').price)}, ${recipe('hive').mats.wood} drva). Iz torbe: „Postavi na travu“, pa klik na travu. Najviše ${HIVES.max} košnica.`,
        `Svaki ${HIVES.every}. dan košnica napuni 1 kg meda (najviše ${HIVES.cap} kg). Klik na košnicu: farmer skupi med.`,
        `Med se prodaje (${zl(GOODS.find((g) => g.id === 'honey').price)}/kg) ili pojede.`,
      ],
    },
    {
      id: 'decor', icon: '🏡', title: 'Uređenje farme',
      body: [
        'Mobitel → Dostava → Uređenje farme. Ukrasi stižu u škrinju, a iz torbe se postave na travu („Postavi na travu“, pa klik, može više komada zaredom; Esc za kraj).',
        { list: Object.values(DECOR).map((d) => `${d.name}: ${d.n} kom za ${zl(d.price)}${d.block ? ', zaprečuje prolaz' : ''}`) },
        'Ograda i klupa zaprečuju prolaz, ali igra ne dopušta da zatvore put do kuće, polja, zgrada ili ceste. Lampion noću svijetli.',
        'Za uklanjanje: Dostava → „Ukloni košnicu ili ukras“, pa klik na njega; vraća se u torbu. Višak se može prodati na otkupu.',
      ],
    },
    {
      id: 'pet', icon: '🐕', title: 'Ljubimac',
      body: [
        `Mobitel → Dostava → Ljubimac: udomi psa (${PETS.dog.name}) ili mačku (${PETS.cat.name}) iz skloništa za ${zl(PETS.adopt)}.`,
        `Ljubimac prati farmera po farmi i sjedne kad farmer stane. Klik na njega: maženje, a jednom na dan i +${PETS.pat} ⚡.`,
      ],
    },
    {
      id: 'day', icon: '🌙', title: 'Dan, noć i spremanje',
      body: [
        'Dan traje 10 minuta (06 h do 02 h). Usjevi rastu ujutro, dok farmer spava.',
        `Spava se u kući od ${hour(SLEEP_FROM)}: završava dan, vraća energiju i sprema igru. Igra se tiho sprema i svakih 30 s i kad zatvoriš tab.`,
        'Dok je tab skriven, vrijeme stoji (osim ako u ⚙ postavkama uključiš da teče).',
        '⚙ Postavke → „Obavijesti u browseru“: kad igra nije u fokusu, browser javi da je nešto sazrelo, da je štand prazan, da se kombi vratio ili da je stigla narudžba kupca.',
      ],
    },
    {
      id: 'keys', icon: '⌨️', title: 'Tipke',
      body: [
        { list: [
          '1–6: ruke, sjeme, kanta, gnojivo, pecaljka, malč',
          'B, P, Z, G: poberi, posadi, zalij, pognoji sve',
          'T: torba · M: mobitel',
          '+ / − ili kotačić: zoom',
          'Esc: prekini posao i zatvori sve',
        ] },
      ],
    },
  ];
}

// Plain text of a topic, for searching.
export const topicText = (t) => [t.title, ...t.body.map((b) => (typeof b === 'string' ? b : b.list.join(' ')))].join(' ');

// Topics that match the search words (all words, any order, ignoring case and č/ć/š/ž/đ).
export function searchGuide(query, topics = guideTopics()) {
  const fold = (x) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return topics;
  const hits = topics.filter((t) => {
    const text = fold(topicText(t));
    return words.every((w) => text.includes(w));
  });
  // topics with the words in the title come first ("gnojivo" → the Gnojivo topic)
  const inTitle = (t) => words.some((w) => fold(t.title).includes(w));
  return [...hits.filter(inTitle), ...hits.filter((t) => !inTitle(t))];
}
