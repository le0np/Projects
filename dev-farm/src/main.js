// Wires simulation, rendering, UI, input and saving together.
// Messages go two ways: what the farmer thinks or can't do appears in a speech bubble,
// everything else (customers, drone, deliveries, the stand) arrives on the phone.

import {
  createState, tick, advance, command, sleep, coffee, eat, moveItem, craft, cropById, recipeById,
  countWhere, extractSeeds, makeCompost, orderSeeds, startJob, upgradeIrrigation, orderItem, feedHens, acceptGig, sprinklerAt,
  goWork, goodById, forageById, shopItemById, matCount, cancelOrder, stopFishing, fishById,
  placeItem, removeItem, fulfillRequest, sellBack, adoptPet, patPet, dayNameGen, rentStall, buyVan, hireWorker, goToMarket, sendVan, comeBack,
} from './sim.js';
import { TIER_NAMES, HOSE_PER_SPRINKLER, MARKET, BUILDINGS, zl, HIVES } from './data.js';
import { SAVE_KEY, OLDER_KEYS, serialize, deserialize } from './save.js';
import { createRenderer } from './render.js';
import { createUI, itemName, stars, formatMoney, plots } from './ui.js';

const ZOOM_KEY = 'dev-farm/zoom';
const SETTINGS_KEY = 'dev-farm/settings';
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

const loaded = deserialize([SAVE_KEY, ...OLDER_KEYS].map((k) => storage.get(k)).find((v) => v) ?? null);
let state = loaded.state;
let hoverTile = null;
let hoverCorner = null;

const canvas = document.getElementById('world');
const renderer = createRenderer(canvas);
const savedZoom = Number(storage.get(ZOOM_KEY));
if (savedZoom > 0) renderer.setZoom(savedZoom);

const ui = createUI({
  onTool, onSeed, onMove, onEat, onPlace, onSleep, onCoffee, onCraft, onReset, onExtract, onOrder, onZoom, onJob,
  onIrrigation, onOrderItem, onAcceptGig, onGoWork, onSetting,
  onRentStall, onBuyVan, onHire, onGoMarket, onSendVan, onComeBack, onCancelOrder, onCompost,
  onPlaceItem, onRemoveMode, onFulfill, onSellBack, onAdopt, onNotifySetting,
  onClosePanel: closePanel,
  onChange: refresh,
});

const save = () => storage.set(SAVE_KEY, serialize(state));

// ------------------------------------------------------------------ what the farmer says

const name = (crop) => cropById[crop].name.toLowerCase();

// What a building needs, next to what the farmer has: "Za bunar trebam 150 zl, … Imam 30 zl, …"
function buildingNeeds(id) {
  const b = BUILDINGS[id];
  const what = { well: 'bunar', coop: 'popravak kokošinjca' }[id] ?? b.name.toLowerCase();
  const missing = [];
  if (state.money < zl(b.price)) missing.push(`još ${formatMoney(zl(b.price) - state.money)}`);
  if (matCount(state, 'wood') < b.wood) missing.push(`${b.wood - matCount(state, 'wood')} drva`);
  if (matCount(state, 'stone') < b.stone) missing.push(`${b.stone - matCount(state, 'stone')} kamena`);
  if (state.energy < b.energy) missing.push(`snage (${b.energy} ⚡)`);
  return `Za ${what} trebam ${formatMoney(zl(b.price))}, ${b.wood} drva, ${b.stone} kamena i ${b.energy} ⚡. Fali mi ${missing.join(', ')}.${
    missing.some((m) => m.includes('drva') || m.includes('kamena')) ? ' Drva i kamenja ima uz rub šume (u torbu).' : ''}`;
}

function farmerSays(e) {
  switch (e.reason) {
    case 'tired': return e.what && BUILDINGS[e.what] ? buildingNeeds(e.what) : 'Nemam više snage… Kava, nešto za pojesti ili krevet.';
    case 'coins':
      if (e.what && BUILDINGS[e.what]) return buildingNeeds(e.what);
      return e.need ? `Nemam dovoljno novca: treba ${formatMoney(e.need)}, a imam ${formatMoney(state.money)}.` : 'Nemam dovoljno novca za to.';
    case 'canempty': return state.upgrades.well ? 'Kanta je prazna. Idem po vodu na bunar ili ribnjak.' : 'Kanta je prazna. Moram po vodu na ribnjak.';
    case 'wet': return 'Ova je još dobro zalivena.';
    case 'bagfull': return 'Torba je puna. Nešto moram odložiti u škrinju ili na štand.';
    case 'nofert': return 'Nemam gnojiva u torbi. Kompost se radi na radnom stolu od 5 kg ploda, a može se i naručiti (📖 Priručnik → Gnojivo).';
    case 'compostkg': return `Za kompost trebam 5 kg iste vrste ploda u torbi, a imam ${e.have} kg.`;
    case 'notcompost': return 'Od toga nema komposta. Treba plod s polja.';
    case 'fertilized': return 'Ova je već pognojena.';
    case 'needseed': return 'Za sadnju moram uzeti sjeme u ruku (2).';
    case 'noseeds':
      if (!state.found.house) return 'Nemam sjemena… Možda u kući nešto ima?';
      return e.crop ? `Nemam više sjemena za ${name(e.crop)}. Izvadit ću ga iz ploda ili naručiti.` : 'Nemam sjemena.';
    case 'locked': return 'Sve je zaraslo. Za ovo treba plan: git clone polje.';
    case 'nopath': return 'Ne mogu doći do tamo.';
    case 'placeplot': return 'Prskalica ide na križanje gdje se dodiruju parcele.';
    case 'nowell': return state.upgrades.wellPlan ? 'Prvo treba sazidati bunar.' : 'Za navodnjavanje trebam bunar. Plan ću skicirati na radnom stolu.';
    case 'nopump': return 'Treba mi vodena pumpa na bunaru. Naručit ću je na mobitelu (Dostava).';
    case 'nohose': return `Treba mi ${HOSE_PER_SPRINKLER} m crijeva po prskalici, a imam ${e.hose ?? 0} m.`;
    case 'nosprinkler': return 'Nemam prskalicu u torbi.';
    case 'full': return 'Energija mi je puna.';
    case 'nowell': return 'Ovdje bi bio dobar bunar. Mogu ga sazidati na radnom stolu.';
    case 'notfruit': return 'Iz toga nema sjemena.';
    case 'standfull': return 'Štand je pun.';
    case 'needtool': return 'Raste. Mogu je zaliti kantom (3) ili pognojiti (4).';
    case 'nofreeplots': return 'Nema slobodnih parcela.';
    case 'tooearly': return 'Još je rano za spavanje. Ima posla do večeri.';
    case 'nothingdry': return 'Sve je već zaliveno.';
    case 'coopbroken': return 'Kokoši mogu doći tek kad popravim kokošinjac.';
    case 'nomats': if (e.what && BUILDINGS[e.what]) return buildingNeeds(e.what);
      return e.mats ? `Za ovo trebam ${e.mats.wood} drva i ${e.mats.stone} kamena u torbi. Ima ih uz rub šume.` : 'Nemam dovoljno materijala.';
    case 'notfood': return 'To kokoši ne jedu.';
    case 'feederfull': return 'Hranilica je puna.';
    case 'nothingtofert': return 'Nema ništa za pognojiti.';
    case 'noplan': return e.what === 'coop' ? 'Stari kokošinjac. Za popravak trebam plan: skicirat ću ga na radnom stolu.' : 'Ovdje bi bio dobar bunar, ali treba mi plan. Skicirat ću ga na radnom stolu.';
    case 'coopfull': return 'U kokošinjcu ima mjesta za najviše 9 kokoši.';
    case 'nothingripe': return 'Još ništa nije zrelo.';
    case 'nomulch': return 'Nemam malča u torbi. Radim ga na radnom stolu od 2 drva ili ga naručim.';
    case 'mulched': return 'Ova je već malčirana.';
    case 'nothingtomulch': return 'Nema parcela bez malča.';
    case 'placegrass': return 'To ide samo na travu.';
    case 'placetaken': return 'Tu je već nešto.';
    case 'placeblocks': return 'Tu ne može: zatvorilo bi put do farme.';
    case 'hivemax': return `Više od ${HIVES.max} košnica ne treba.`;
    case 'noremove': return null;
    case 'nohoney': return 'Pčele još rade. Med će biti za dan-dva.';
    case 'requestshort': return `Za narudžbu mi fali još ${e.request.kg} kg dovoljno dobrog ploda u torbi.`;
    case 'fishdark': return 'Prekasno je za pecanje, već je mrak. Sutra ujutro.';
    case 'norod': return 'Nemam pecaljku. Napravit ću je na radnom stolu od 2 drva (📖 Priručnik → Pecanje).';
    case 'nostall': return 'Prvo moram zakupiti klupu na tržnici.';
    case 'nothingtosell': return 'Nemam ništa za prodaju u torbi.';
    case 'toolate': return 'Prekasno je za tržnicu, dok stignem bit će zatvorena.';
    case 'chestfull': return null; // the drone's problem: goes to the phone
    default: return null;
  }
}

// ------------------------------------------------------------------ browser notifications

// Only when the game is not what you are looking at, and only if allowed in the settings.
function browserNote(title, body) {
  if (!settings.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!document.hidden && document.hasFocus()) return;
  try {
    new Notification(title, { body, tag: title, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌱</text></svg>' });
  } catch { /* some browsers only allow notifications from a service worker */ }
}

async function onNotifySetting(on) {
  if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
    const answer = await Notification.requestPermission().catch(() => 'denied');
    if (answer !== 'granted') {
      ui.notify('🔔 Browser nije dopustio obavijesti. Dopuštenje se mijenja u postavkama stranice (ikona lokota uz adresu).', 'err');
      on = false;
    }
  }
  onSetting('notify', on);
  ui.setSettings(settings);
  if (on) ui.notify('🔔 Obavijesti u browseru su uključene. Stižu kad igra nije u fokusu.', 'ok');
}

// ------------------------------------------------------------------ routing events

let droneBatch = 0;
let lastAwayNote = -1e9;
let jobTally = null; // quality counts while "harvest all" runs

const tallyText = (t) => [5, 4, 3, 2, 1].filter((k) => t[k]).map((k) => `${stars(k)} ${t[k]} kg`).join(', ');

function report(events) {
  for (const e of events) {
    switch (e.type) {
      case 'fail': {
        if (state.farmer.job || events.some((x) => x.type === 'jobend')) break; // the job summary says it
        if (['pumpinstalled', 'pumpordered', 'pumphave'].includes(e.reason)) {
          ui.notify({ pumpinstalled: '📦 Pumpa je već na bunaru, druga ne treba.', pumpordered: '📦 Pumpa je već naručena i stiže sutra.', pumphave: '📦 Pumpu već imaš (torba ili škrinja).' }[e.reason], 'err');
          break;
        }
        if (e.reason === 'intown') {
          // the farmer is away: say it on the phone, not too often
          if (performance.now() - lastAwayNote > 6000) ui.notify('🧺 Farmer je u gradu na tržnici. Klik na 🧺 u gornjoj traci vraća ga ranije.', 'info');
          lastAwayNote = performance.now();
          break;
        }
        if (e.who === 'van') {
          ui.notify(`🚐 ${MARKET.worker} danas ne vozi: ${e.reason === 'coins' ? `nema novca za dnevnicu (${formatMoney(e.need)})` : 'nešto nije u redu'}.`, 'err');
          break;
        }
        const text = farmerSays(e);
        if (text) ui.say(text, ['needseed', 'needtool', 'wet', 'nowell', 'fertilized', 'full'].includes(e.reason) ? '' : 'sad');
        else if (e.reason === 'chestfull') ui.notify('🚁 Dron: škrinja je puna, stao sam s berbom.', 'err');
        else if (e.reason === 'notincatalog') ui.notify('📦 Toga još nema u katalogu.', 'err');
        else if (e.reason === 'gigbusy') ui.notify('💼 Već radiš jedan posao.', 'err');
        break;
      }
      case 'rain':
        ui.notify(`🌧️ Danas pada kiša: zalila je sve posađeno (${e.n}). Kupaca će biti manje.`, 'info');
        break;
      case 'forecast':
        ui.notify(`🌤️ Prognoza za sutra: ${e.tomorrow === 'rain' ? 'kiša 🌧️' : 'sunčano ☀️'}.`, 'info');
        break;
      case 'chestdecay':
        ui.notify(`📦 Plodovi u škrinji gube kvalitetu (${e.n} ${e.n === 1 ? 'hrpa' : 'hrpe'} pale za klasu). Hladnjača s radnog stola ih čuva.`, 'err');
        break;
      case 'request':
        ui.notify(`📝 Narudžba: ${e.who} želi ${e.kg} kg ${cropById[e.crop].gen} ${stars(e.tier)} ili bolje do ${dayNameGen(e.due)}. Predaje se na štandu.`, 'info');
        browserNote('📝 Nova narudžba', `${e.who}: ${e.kg} kg ${cropById[e.crop].gen} ${stars(e.tier)}`);
        break;
      case 'requestmissed':
        ui.notify(`📝 Narudžba je propala: ${e.who} nije dobio ${e.kg} kg ${cropById[e.crop].gen}.`, 'err');
        break;
      case 'requestdone':
        ui.say(`Narudžba predana! ${e.who} plaća +${formatMoney(e.pay)}.`, 'happy');
        ui.notify(`📝 Predano: ${e.kg} kg ${cropById[e.crop].gen} za ${e.who} · +${formatMoney(e.pay)}`, 'ok');
        break;
      case 'soldback':
        ui.notify(`♻️ Otkup: ${itemName(e.id).toLowerCase()} × ${e.n} · +${formatMoney(e.money)}`, 'ok');
        break;
      case 'placeditem':
        break;
      case 'removeditem':
        ui.say(`${itemName(e.id)} je natrag u torbi.`);
        break;
      case 'honey':
        ui.say(`Med! +${e.n} kg.`, 'happy');
        break;
      case 'adopted':
        ui.say(`Dobrodošao${e.kind === 'cat' ? 'la' : ''}, ${e.name}!`, 'happy');
        ui.notify(`${e.kind === 'dog' ? '🐕' : '🐈'} ${e.name} je stigao${e.kind === 'cat' ? 'la' : ''} na farmu. Klik na ${e.kind === 'dog' ? 'njega' : 'nju'} za maženje.`, 'ok');
        break;
      case 'patted':
        ui.say(e.gain ? `${e.kind === 'dog' ? 'Dobar pas' : 'Dobra maca'}, ${e.name}! +${e.gain} ⚡` : `${e.kind === 'dog' ? 'Vau!' : 'Mjau.'} 💛`, 'happy');
        break;
      case 'standempty':
        ui.notify('🏪 Štand je prazan. Kupci nemaju što kupiti.', 'err');
        browserNote('🏪 Štand je prazan', 'Kupci nemaju što kupiti.');
        break;
      case 'cast':
        ui.say('Pecam. Ovo može potrajati… 🎣 Pozovi me kad me trebaš.');
        break;
      case 'caught':
        ui.say(`Upecao sam! ${goodById[e.fish].name} ${stars(e.tier)}, ${e.kg} kg.`, 'happy');
        ui.notify(`🎣 Ulov: ${goodById[e.fish].name} ${stars(e.tier)}, ${e.kg} kg.`, 'ok');
        break;
      case 'fishstop': {
        const catchText = e.caught ? `Ulov danas: ${e.caught} ${e.caught === 1 ? 'riba' : e.caught < 5 ? 'ribe' : 'riba'}.` : 'Danas ništa nije zagrizlo.';
        if (e.reason === 'dark') {
          ui.say(`Pao je mrak, spremam pecaljku. ${catchText}`);
          ui.notify(`🎣 Farmer je završio s pecanjem. ${catchText}`, 'info');
        } else if (e.reason === 'tired') ui.say(`Previše sam umoran za pecanje. ${catchText}`, 'sad');
        else if (e.reason !== 'bagfull') ui.say(`Spremam pecaljku. ${catchText}`);
        break;
      }
      case 'stallrented':
        ui.say('Klupa na tržnici je moja! Sad samo napuniti torbu.', 'happy');
        break;
      case 'vanbought':
        ui.say('Kombi! Malo je star, ali vozi.', 'happy');
        ui.notify('🚐 Kombi je na parkiralištu. Zaposli vozača i utovari robu: svako jutro vozi na tržnicu.', 'ok');
        break;
      case 'hired':
        ui.notify(`🚐 ${MARKET.worker} je zaposlen. Vozi svako jutro u 6 h, ako u kombiju ima robe.`, 'ok');
        break;
      case 'fired':
        ui.notify(`🚐 ${MARKET.worker} više ne vozi. Kombi ostaje na parkiralištu.`, 'info');
        break;
      case 'tripstart':
        if (e.who === 'farmer') {
          closePanel();
          ui.notify('🧺 Farmer je krenuo u grad na tržnicu. Farma za to vrijeme radi bez njega.', 'info');
        } else ui.notify(`🚐 ${MARKET.worker} je krenuo kombijem na tržnicu (dnevnica −${formatMoney(e.wage)}).`, 'info');
        break;
      case 'triparrive':
        ui.notify(e.who === 'farmer' ? '🧺 Farmer je stigao na tržnicu i slaže klupu.' : `🚐 ${MARKET.worker} je stigao na tržnicu.`, 'info');
        break;
      case 'tripback': {
        const who = e.who === 'farmer' ? '🧺 Farmer' : `🚐 ${MARKET.worker}`;
        const why = e.early ? 'pakira ranije' : e.soldOut ? 'je sve prodao' : 'tržnica se zatvara';
        ui.notify(`${who}: ${why}, prodano ${e.kg} kg · ${formatMoney(e.money)}. Vraća se kući.`, 'ok');
        break;
      }
      case 'tripdone':
        if (e.who === 'farmer') {
          ui.say(e.kg ? `Doma sam! Na tržnici prodano ${e.kg} kg, +${formatMoney(e.money)}.` : 'Doma sam.', e.kg ? 'happy' : '');
        } else {
          ui.notify(`🚐 ${MARKET.worker} se vratio: prodano ${e.kg} kg · +${formatMoney(e.money)}.${e.left ? ` U kombiju je ostalo ${e.left} (ide opet sutra).` : ' Kombi je prazan.'}`, 'ok');
          browserNote('🚐 Kombi se vratio', `Prodano ${e.kg} kg · +${formatMoney(e.money)}`);
        }
        break;
      case 'vanidle':
        ui.notify(`🚐 Kombi je prazan pa ${MARKET.worker} danas ne vozi (dnevnica se ne plaća). Robu utovari na parkiralištu.`, 'info');
        break;
      case 'open':
        ui.state.panel = e.panel;
        ui.state.selected = -1;
        break;
      case 'found':
        ui.say(e.what === 'ladica u kući'
          ? `U ladici je vrećica sjemena: ${e.n}× ${name(e.crop)}!`
          : `${e.what[0].toUpperCase()}${e.what.slice(1)}! ${e.n}× sjeme (${name(e.crop)}).`, 'happy');
        break;
      case 'foraged': {
        const f = forageById[e.what];
        const what = { wood: `${e.n} drva`, stone: `${e.n} kamena`, hose: `${e.n} m crijeva`, sprinkler: 'cijela prskalica' }[e.item] ?? `${e.n} kg`;
        ui.say(`${f.name[0].toUpperCase()}${f.name.slice(1)}! +${what}.`, 'happy');
        break;
      }
      case 'forage':
        ui.notify(`🍄 U šumi je preko noći niknulo: ${e.n}.`, 'info');
        break;
      case 'laid':
        if (e.n) ui.notify(`🐔 Kokoši su snijele ${e.n} ${e.n === 1 ? 'jaje' : 'jaja'}.`, 'ok');
        if (e.hungry) ui.notify(`🐔 Gladnih kokoši: ${e.hungry}. Stavi plodove u hranilicu.`, 'err');
        break;
      case 'eggs':
        ui.say(`Jaja! +${e.n}`, 'happy');
        break;
      case 'fed':
        ui.say(`Hranilica: +${e.n} kg.`);
        break;
      case 'gigoffers':
        ui.notify(`💼 Novi poslovi: ${e.n}. Pogledaj karticu Poslovi.`, 'info');
        break;
      case 'gigaccepted':
        ui.say('Prihvaćeno. Idem doma za laptop.');
        break;
      case 'gigstart':
        ui.say('Kodiram… 💻');
        break;
      case 'gigpause':
        ui.say('Posao čeka, nastavit ću poslije.');
        break;
      case 'gigdone':
        ui.say(`Gotovo! +${formatMoney(e.pay)}`, 'happy');
        ui.notify(`💼 Plaćeno: ${e.title} · +${formatMoney(e.pay)}`, 'ok');
        break;
      case 'newfind':
        ui.notify('🌱 Na imanju je nešto niknulo samo od sebe. Možda sjeme?', 'info');
        break;
      case 'composted':
        ui.say(`Kompost je gotov: vreća gnojiva ${stars(e.tier)}, ${e.doses} doza.${e.tier === 3 ? ' S ovim plod može biti za sajam!' : ''}`, 'happy');
        break;
      case 'extracted':
        ui.say(`${e.n} ${e.n < 5 ? 'sjemenke' : 'sjemenki'} (${name(e.crop)}).`, e.n >= 7 ? 'happy' : '');
        break;
      case 'jobstart':
        jobTally = e.kind === 'harvest' ? {} : null;
        ui.say(e.kind === 'plant' ? `Idem sijati: ${e.total} ${plots(e.total)}.`
          : e.kind === 'water' ? `Idem zalijevati: ${e.total} ${plots(e.total)}.`
            : e.kind === 'fertilize' ? `Idem gnojiti: ${e.total} ${plots(e.total)}.` : `Idem brati, zrelih: ${e.total}.`);
        break;
      case 'jobcancel':
        jobTally = null;
        ui.say(`Dobro, prekidam ${{ plant: 'sadnju', harvest: 'berbu', water: 'zalijevanje', fertilize: 'gnojenje' }[e.kind]}.`);
        break;
      case 'jobend': {
        const what = `${{ plant: 'Posađeno', harvest: 'Ubrano', water: 'Zaliveno', fertilize: 'Pognojeno' }[e.kind]} ${e.done}`;
        const detail = jobTally && e.done ? ` (${tallyText(jobTally)})` : '';
        jobTally = null;
        if (e.reason) ui.say(`${farmerSays(e)} ${what} od ${e.total}${detail}.`, 'sad');
        else ui.say(`Gotovo! ${what}${detail}.`, 'happy');
        break;
      }
      case 'harvest':
        if (e.by === 'drone') droneBatch++;
        else if (jobTally) jobTally[e.tier] = (jobTally[e.tier] ?? 0) + e.kg;
        else ui.say(`${cropById[e.crop].name} ${stars(e.tier)}, ${TIER_NAMES[e.tier]}! ${e.kg} kg.`, e.tier >= 3 ? 'happy' : e.tier === 1 ? 'sad' : '');
        break;
      case 'sale':
        ui.notify(`🛒 Kupac je kupio ${e.qty} ${goodById[e.crop].unit}: ${goodById[e.crop].name}${cropById[e.crop] || fishById[e.crop] ? ` ${stars(e.tier)}` : ''} · +${formatMoney(e.money)}`, 'ok');
        break;
      case 'nosale':
        ui.notify('🛒 Kupac je došao do praznog štanda i otišao.', 'info');
        break;
      case 'refill':
        ui.say(`Kanta je puna (${e.water}).`);
        break;
      case 'rot':
        ui.notify(`⚠️ ${cropById[e.crop].name} je istrunula na polju.`, 'err');
        break;
      case 'unlock':
        ui.notify(`📦 Novo u katalogu dostave: ${cropById[e.crop].name}.`, 'ok');
        break;
      case 'ordered':
        ui.notify(e.item
          ? `📦 Naručeno: ${shopItemById[e.item].name.toLowerCase()} · ${e.n} ${shopItemById[e.item].unit} (−${formatMoney(e.price)}). Stiže sutra ujutro u škrinju.`
          : `📦 Naručeno: ${e.n}× sjeme, ${cropById[e.crop].name} (−${formatMoney(e.price)}). Stiže sutra ujutro.`);
        break;
      case 'cancelled':
        ui.notify(`📦 Otkazano: ${e.item ? `${e.n} ${shopItemById[e.item].unit} ${shopItemById[e.item].name.toLowerCase()}` : `${e.n}× sjeme, ${cropById[e.crop].name}`} · vraćeno ${formatMoney(e.price)}.`, 'info');
        break;
      case 'delivered':
        if (e.item === 'hen') ui.notify(`🐔 Stigle su kokoši (${e.n}), već su u kokošinjcu.`, 'ok');
        else ui.notify(e.item ? `📦 Dostava je stigla u škrinju: ${shopItemById[e.item].name.toLowerCase()} · ${e.n} ${shopItemById[e.item].unit}.` : `📦 Dostava je stigla: ${e.n}× sjeme (${name(e.crop)}).`, 'ok');
        break;
      case 'buildstart':
        ui.say({ pump: 'Montiram pumpu na bunar…', coop: 'Popravljam kokošinjac…' }[e.what] ?? 'Plan je tu. Zidam bunar…');
        break;
      case 'buildcancel':
        ui.say('Bunar ću dovršiti drugi put.');
        break;
      case 'built':
        if (e.what === 'coop') {
          ui.say('Kokošinjac je popravljen! Sad još trebaju kokoši.', 'happy');
          ui.notify('🐔 Kokošinjac je popravljen. Kokoši naruči na mobitelu (Dostava), jednu po jednu.', 'ok');
        } else if (e.what === 'pump') {
          ui.say('Pumpa je na bunaru! Sad trebam crijevo i prskalice.', 'happy');
          ui.notify('💧 Pumpa je montirana. Prskalice stavi na križanja parcela (10 m crijeva po prskalici).', 'ok');
        } else {
          ui.say('Bunar je sazidan! Voda je sad blizu.', 'happy');
          ui.notify('🪣 Bunar je sazidan. Za navodnjavanje trebaju pumpa, crijevo i prskalice (Dostava na mobitelu).', 'ok');
        }
        break;
      case 'irrigation':
        ui.say(`water.sh v${e.level}: svaka prskalica sad zalijeva ${e.reach} parcela.`, 'happy');
        break;
      case 'craft': {
        const r = recipeById[e.recipe];
        const bld = Object.entries(BUILDINGS).find(([, b]) => b.plan === e.recipe);
        if (bld) {
          const [id, b] = bld;
          const cost = `${formatMoney(zl(b.price))}, ${b.wood} drva, ${b.stone} kamena i ${b.energy} ⚡`;
          ui.say(id === 'well' ? `Plan bunara je gotov! Za zidanje trebam ${cost}. Zida se na gradilištu kod kuće.`
            : `Plan je gotov! Za popravak kokošinjca trebam ${cost}.`, 'happy');
          ui.notify(`📐 ${r.name}: gradnja košta ${cost}. Klikni gradilište kad sve imaš (popis je i na radnom stolu).`, 'info');
        } else if (e.recipe === 'rod') {
          ui.say('Pecaljka je gotova! Uzmi je (tipka 5) i klikni ribnjak.', 'happy');
        } else ui.say(`Gotovo: ${r.name}!`, 'happy');
        break;
      }
      case 'placed':
        ui.say('Prskalica postavljena. water.sh zalijeva svako jutro u 6 h.', 'happy');
        break;
      case 'pickup':
        ui.say(`Prskalica i ${HOSE_PER_SPRINKLER} m crijeva su u torbi.`);
        break;
      case 'coffee':
        ui.say(`Ahh, kava. +${e.gain} ⚡`, 'happy');
        break;
      case 'eat':
        ui.say(`Njam. +${e.gain} ⚡`);
        break;
      case 'shop':
        ui.notify(e.open ? '🏪 Štand je otvoren, kupci dolaze.' : '🏪 Štand je zatvoren za danas.', 'info');
        break;
      case 'slept':
      case 'passout':
        nightReport(e);
        break;
      default:
    }
  }
}

function nightReport(e) {
  closePanel();
  const saved = save();
  if (e.type === 'passout') ui.say('Zzz… Ovo je bio predug dan.', 'sad');
  else ui.say('Dobro jutro! Novi dan na farmi.', 'happy');
  const parts = [`🌙 Dan ${e.day}.`, saved ? 'Igra je spremljena.' : 'Spremanje nije uspjelo (browser ne dopušta).'];
  if (e.type === 'passout') parts.push('Farmer je zaspao na nogama: danas s pola energije.');
  if (e.summary.ripened) {
    parts.push(`Preko noći sazrelo: ${e.summary.ripened}.`);
    browserNote('🌾 Sazrelo je', `Za berbu: ${e.summary.ripened}. Dan ${e.day}.`);
  }
  if (e.summary.sprinkled) parts.push(`Prskalice su zalile ${e.summary.sprinkled} ${plots(e.summary.sprinkled)}.`);
  if (e.summary.rotted) parts.push(`Istrunulo: ${e.summary.rotted}.`);
  ui.notify(parts.join(' '), e.type === 'passout' ? 'err' : 'ok');
}

function flushDrone() {
  if (!droneBatch) return;
  ui.notify(`🚁 Dron je ubrao ${droneBatch} i odnio u škrinju.`, 'info');
  droneBatch = 0;
}

function intro() {
  ui.toggle('phone', true); // a new farm starts with the phone open, so the first tips can be read in peace
  ui.notify('👋 Dobrodošlica na farmu! Klikni bilo gdje na mapi i farmer ode tamo. Klik na parcelu radi ono što farmer drži u ruci (tipke 1–4): ruke beru, sjeme sadi, kanta zalijeva, gnojivo gnoji. ▾ uz svaki alat radi to na svim parcelama ili samo za jednu vrstu. Kotačić miša mijenja zoom.', 'info');
  ui.notify('📖 Ne znaš kako se nešto radi ili pravi? Mobitel → Priručnik (npr. gnojivo, bunar, kokoši, prskalice).', 'info');
  ui.notify('🎒📱 Torba i mobitel su ikone desno na mapi, ispod zooma (tipke T i M). Nove poruke iskaču u kutu mape, a sve ostaju ovdje na mobitelu.', 'info');
  ui.notify(`🌱 Sjeme se broji: nađi ga na imanju, izvadi iz plodova na radnom stolu ili naruči ovdje, pod "Dostava".`, 'info');
  ui.notify('🌲 Dok usjevi rastu: uz rub šume skupljaj gljive, kupine, drva i kamenje, popravi stari kokošinjac kod kuće, a na mobitelu pod Poslovi uzmi koji honorarac.', 'info');
  ui.notify('🌙 Usjevi rastu preko noći: svako jutro jedan dan ako su dan prije bili zaliveni, pola dana ako nisu. Dovoljno je zaliti jednom dnevno.', 'info');
  ui.notify('🏪 Plodove stavi na štand uz cestu. Bolja kvaliteta, bolja cijena. Od 18 h možeš spavati u kući: tako se igra sprema.', 'info');
  setTimeout(() => ui.say('Nova farma! Sjemena još nemam… Možda u kući nešto ima?'), 600);
}

// ------------------------------------------------------------------ actions

function act(fn) {
  const events = [];
  fn(events);
  report(events);
  renderer.notify(events, state, performance.now());
  refresh();
}

function closePanel() {
  ui.state.panel = null;
  refresh();
}

function onTool(tool) {
  if (tool === 'rod' && !state.upgrades.rod) {
    report([{ type: 'fail', reason: 'norod' }]);
    return;
  }
  if (tool === 'mulch' && !countWhere(state.bag, (id) => id === 'mulch')) {
    report([{ type: 'fail', reason: 'nomulch' }]);
    return;
  }
  ui.state.placing = false;
  state.tool = tool;
  refresh();
}

function onSeed(id) {
  state.seed = id;
  state.tool = 'seed';
  ui.state.placing = false;
  refresh();
}

function onMove(from, slot, to) {
  const n = ui.state.moveN;
  if (to === 'coop') act((ev) => feedHens(state, slot, ev, n));
  else act((ev) => moveItem(state, from, slot, to === 'market' ? 'cargo' : to, ev, n));
}

// ---- the town market
function onRentStall() { act((ev) => rentStall(state, ev)); }
function onBuyVan() { act((ev) => buyVan(state, ev)); }
function onHire(hire) { act((ev) => hireWorker(state, hire, ev)); }
function onSendVan() { act((ev) => sendVan(state, ev)); }
function onComeBack() { act((ev) => comeBack(state, 'farmer', ev)); }
function onGoMarket() {
  act((ev) => goToMarket(state, ev));
  if (state.farmer.task?.type === 'town') ui.say('Idem u grad na tržnicu!');
}

// ---- settings, and time passing while the game is not on screen
const settings = (() => { try { return { bgTime: false, ...JSON.parse(storage.get(SETTINGS_KEY) ?? '{}') }; } catch { return { bgTime: false }; } })();
function onSetting(key, value) {
  settings[key] = value;
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
  lastReal = Date.now();
}

let lastReal = Date.now();
function catchUp() {
  const now = Date.now();
  const gap = (now - lastReal) / 1000;
  lastReal = now;
  if (!settings.bgTime || gap < 0.5) return;
  const events = advance(state, Math.min(gap, 3 * 3600), []);
  const sales = events.filter((e) => e.type === 'sale');
  const quiet = new Set(['sale', 'harvest', 'sprinkle', 'water', 'refill', 'shop', 'plant', 'marketsale']);
  report(events.filter((e) => !quiet.has(e.type)));
  if (gap >= 60) {
    const earned = sales.reduce((a, e) => a + e.money, 0);
    ui.notify(`⏱ Dok igra nije bila na ekranu (${Math.round(gap / 60)} min): kupaca ${sales.length}, zarada ${formatMoney(earned)}.`, 'info');
  }
  refresh();
}

function onAcceptGig(id) {
  ui.state.panel = null;
  act((ev) => acceptGig(state, id, ev));
}

function onGoWork() {
  ui.state.panel = null;
  act((ev) => goWork(state, ev));
}

function onEat(slot) {
  act((ev) => eat(state, slot, ev));
  if (!state.bag[slot]) ui.state.selected = -1;
}

function onCompost(slot) {
  act((ev) => makeCompost(state, slot, ev));
  if (!state.bag[slot]) ui.state.selected = -1;
}

function onExtract(slot) {
  act((ev) => extractSeeds(state, slot, ev));
  if (!state.bag[slot]) ui.state.selected = -1;
}

function onOrder(crop) {
  act((ev) => orderSeeds(state, crop, ev));
}

function onPlaceItem(id) {
  if (!countWhere(state.bag, (k) => k === id)) return;
  ui.state.placing = id;
  ui.state.panel = null;
  ui.state.bagOpen = false;
  ui.say('Gdje da to stavim? Klikni travu. Esc kad završim.');
  refresh();
}

function onRemoveMode() {
  ui.state.placing = ui.state.placing === 'remove' ? false : 'remove';
  ui.state.phoneOpen = false;
  if (ui.state.placing) ui.say('Što da maknem? Klikni košnicu ili ukras. Esc kad završim.');
  refresh();
}

function onFulfill(id) { act((ev) => fulfillRequest(state, id, ev)); }
function onSellBack(id) { act((ev) => sellBack(state, id, ev)); }
function onAdopt(kind) { act((ev) => adoptPet(state, kind, ev)); }

function onPlace() {
  if (!countWhere(state.bag, (id) => id === 'sprinkler')) return;
  ui.state.placing = true;
  ui.state.panel = null;
  ui.say('Gdje da je stavim? Klikni križanje parcela.');
  refresh();
}

function onSleep() {
  act((ev) => sleep(state, ev));
}

function onCoffee() {
  act((ev) => coffee(state, ev));
}

function onCraft(id) {
  act((ev) => craft(state, id, ev));
}

function onJob(kind, crop = null) {
  if (state.farmer.job) {
    cancelJob();
    return;
  }
  ui.state.panel = null;
  ui.state.placing = false;
  act((ev) => startJob(state, kind, crop, ev));
}

function onIrrigation() {
  act((ev) => upgradeIrrigation(state, ev));
}

function onCancelOrder(k) {
  act((ev) => cancelOrder(state, k, ev));
}

function onOrderItem(id) {
  act((ev) => orderItem(state, id, ev));
}

function cancelJob() {
  const f = state.farmer;
  if (!f.job) return;
  report([{ type: 'jobcancel', kind: f.job.kind, done: f.job.done }]);
  f.job = null;
  f.queue = [];
  f.path = f.path.slice(0, 1); // finish the step in progress
  f.task = null;
  refresh();
}

function onZoom(dir) {
  const z = dir > 0 ? renderer.zoomIn() : renderer.zoomOut();
  storage.set(ZOOM_KEY, String(z));
  refresh();
}

function onReset() {
  if (!window.confirm('Obrisati farmu i krenuti ispočetka?')) return;
  storage.remove(SAVE_KEY);
  OLDER_KEYS.forEach((k) => storage.remove(k));
  state = createState(Date.now() % 2147483646 + 1);
  Object.assign(ui.state, { panel: null, selected: -1, placing: false });
  ui.clear();
  intro();
  save();
  refresh();
}

// ------------------------------------------------------------------ input

const fishing = () => state.farmer.busy?.what === 'fish';

canvas.addEventListener('click', (e) => {
  const c = renderer.cornerFromClient(e.clientX, e.clientY);
  const placing = ui.state.placing;
  if (placing && placing !== true) {
    // hives and decorations go down right where you click; you can keep placing
    const t = renderer.tileFromClient(e.clientX, e.clientY);
    if (!t) return;
    if (placing === 'remove') act((ev) => removeItem(state, t[0], t[1], ev));
    else {
      act((ev) => placeItem(state, t[0], t[1], placing, ev));
      if (!countWhere(state.bag, (id) => id === placing)) ui.state.placing = false;
    }
    refresh();
    return;
  }
  if (state.pet && renderer.petHit(e.clientX, e.clientY)) {
    act((ev) => patPet(state, ev));
    return;
  }
  if (ui.state.placing) {
    // sprinklers go on the crossing of four plots
    ui.state.placing = false;
    ui.state.panel = null;
    act((ev) => command(state, c.x, c.y, 'place', ev));
    return;
  }
  if (c.near && sprinklerAt(state, c.x, c.y) >= 0) {
    ui.state.panel = null;
    act((ev) => command(state, c.x, c.y, 'pickup', ev));
    return;
  }
  const t = renderer.tileFromClient(e.clientX, e.clientY);
  if (!t) return;
  ui.state.panel = null;
  act((ev) => command(state, t[0], t[1], 'auto', ev));
});

canvas.addEventListener('mousemove', (e) => {
  hoverTile = renderer.tileFromClient(e.clientX, e.clientY);
  hoverCorner = renderer.cornerFromClient(e.clientX, e.clientY);
  renderer.setHover(hoverTile);
  renderer.setCorner(hoverCorner);
});
canvas.addEventListener('mouseleave', () => {
  hoverTile = null;
  hoverCorner = null;
  renderer.setHover(null);
  renderer.setCorner(null);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  onZoom(e.deltaY < 0 ? 1 : -1);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  const tool = { 1: 'hand', 2: 'seed', 3: 'can', 4: 'fert', 5: 'rod', 6: 'mulch' }[e.key];
  if (tool) onTool(tool);
  else if (e.key === 'p' || e.key === 'P') onJob('plant');
  else if (e.key === 'b' || e.key === 'B') onJob('harvest');
  else if (e.key === 'z' || e.key === 'Z') onJob('water');
  else if (e.key === 'g' || e.key === 'G') onJob('fertilize');
  else if (e.key === 't' || e.key === 'T') ui.toggle('bag');
  else if (e.key === 'm' || e.key === 'M') ui.toggle('phone');
  else if (e.key === '+' || e.key === '=') onZoom(1);
  else if (e.key === '-') onZoom(-1);
  else if (e.key === 'Escape') {
    if (fishing()) act((ev) => stopFishing(state, ev));
    cancelJob();
    ui.state.placing = false;
    ui.closeAll();
    refresh();
  }
});

window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------------ loop

let lastFrame = performance.now();
let lastUi = 0;

function refresh() {
  ui.update(state, hoverTile, { canIn: renderer.canZoom(1), canOut: renderer.canZoom(-1) }, hoverCorner);
}

function frame(now) {
  // time only runs while the tab is visible; long gaps (sleeping laptop) are capped
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  if (!document.hidden && Date.now() - lastReal > 1500) catchUp();
  lastReal = Date.now();
  if (!document.hidden && dt > 0) {
    const events = tick(state, dt, []);
    if (events.length) {
      report(events);
      renderer.notify(events, state, now);
    }
  }
  renderer.draw(state, now, { placing: ui.state.placing });
  const head = renderer.worldToCanvas(state.farmer.x * 32 + 16, state.farmer.y * 32 - 4);
  ui.placeBubble(head.x, head.y, now);
  if (now - lastUi > 120) {
    lastUi = now;
    refresh();
  }
  requestAnimationFrame(frame);
}

// quiet autosave so closing the tab never loses much; sleeping is the "real" save
setInterval(save, 30_000);
setInterval(flushDrone, 10_000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else catchUp();
  lastFrame = performance.now();
});
setInterval(() => { if (document.hidden) catchUp(); }, 5000);
window.addEventListener('pagehide', save);

if (loaded.restored) ui.notify(`👋 Dan ${state.day}: farma je tu gdje je i bila.`, 'info');
else intro();
ui.setSettings(settings);
refresh();
renderer.draw(state, performance.now());
requestAnimationFrame(frame);

// for poking around in the browser console: devFarm.state, devFarm.redraw(), devFarm.skip(30)
window.devFarm = {
  get state() { return state; },
  ui: ui.state,
  renderer,
  itemName,
  say: (t) => ui.say(t),
  // fast-forward the game by `seconds` of real time (1 s = 2 game minutes), with messages
  skip(seconds) { act((ev) => advance(state, seconds, ev)); },
  redraw() { refresh(); renderer.draw(state, performance.now()); },
};
