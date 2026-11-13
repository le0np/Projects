# Format eventa (schemaVersion 1)

Ovo je mjerodavan opis formata sadržaja. Skica u planu (§3.4) je samo povijesni prijedlog. Shema je u `packages/core/src/schema.ts`, a provjere koje shema ne može izraziti u `packages/content/src/validate.ts`.

Sadržaj se nalazi u `packages/content/data/`:

| Datoteka | Sadržaj |
|---|---|
| `careers.json` | 10 karijera: sposobnosti (2–3, svaka s modifikatorima), jake i slabe strane |
| `facts.json` | registar činjenica; svaka činjenica koju event koristi mora biti ovdje |
| `events/<id>.json` | jedan event po datoteci; ime datoteke = `id` |

Nakon svake izmjene pokreni `npm run validate`.

## Struktura eventa

```jsonc
{
  "schemaVersion": 1,            // verzija formata
  "id": "career_coworker_mistake",
  "version": 1,                  // verzija sadržaja ovog eventa; povećaj kad mijenjaš ponašanje
  "title": "A Coworker Needs Help",
  "category": "career",          // everyday | social | career | relationships | family | financial | health | critical
  "trigger": "director",         // director: bira ga direktor; followup_only: samo kao nastavak
  "hidden": false,               // skriveni event: ne najavljuje se onima koji ne sudjeluju
  "importance": "multi",         // simple | multi | important → rok za odluku iz konfiguracije
  "durationSeconds": 25,         // opcionalno: nadjačava rok
  "weight": 8,                   // osnovna težina odabira (zadano 10)
  "cooldown": { "maxPerSession": 2, "maxPerCharacter": 1, "minGapSeconds": 60 },
  "tags": ["secret"],            // slobodne oznake; karijere ih koriste u selection_weight
  "roles": { ... },
  "conditions": { ... },         // uvjet aktivacije nad svim ulogama (bez "self")
  "text": { "public": "...", "private": { "<uloga>": "..." } },
  "choices": { "<uloga>": [ ... ] },
  "outcomes": [ ... ]
}
```

### Uloge

```jsonc
"roles": {
  "requester": { "count": 1, "conditions": { "fact": "employed" } },
  "witness":   { "count": [1, 2], "careers": ["doctor"],
                 "conditions": { "relation": { "to": "role:requester", "typeIn": ["colleague"] } } }
}
```

- `count` je broj mjesta: broj ili `[min, max]`.
- U `conditions` uloge, `self` je kandidat za tu ulogu. Smije se referencirati **samo uloge deklarirane ranije**, jer engine dodjeljuje uloge redom.
- Uloga bez unosa u `choices` je pasivna: sudjeluje, ali ne odlučuje (npr. onesviješteni pacijent).

### Reference

| Referenca | Značenje |
|---|---|
| `self` | lik koji se trenutno procjenjuje (kandidat uloge, onaj tko bira) |
| `role:<ime>` | svi likovi u toj ulozi |
| `session` | sesija; samo kao meta efekta `fact` za činjenice sesije |

Kad uloga ima više članova, uvjet vrijedi samo ako vrijedi za **svakog** člana. Prazna uloga daje `false`.

### Tekst

Placeholderi `{ime_uloge}` zamjenjuju se imenima likova. Smiju se koristiti u naslovu, javnom i privatnom tekstu, oznakama izbora i tekstovima ishoda.

### Izbori

```jsonc
{ "id": "protect", "label": "Back their story", "tags": ["lie", "help"],
  "default": false,                      // točno jedan default po ulozi; primjenjuje se na timeout ili disconnect
  "careers": ["lawyer"],                 // poseban izbor karijere
  "condition": { "attr": "money", "gte": 20 },   // vidljivost; self = onaj tko bira
  "perceived": { "risk": 1, "reputation": -1, "relation": { "requester": 1 } },
  "insight": { "careers": ["doctor"], "perceived": { "risk": 2 }, "note": "..." },
  "effects": [ { "type": "attr", "target": "self", "delta": { "reputation": 3 } } ] }
```

- `tags`: stav izbora iz GDD §8 (help, refuse, negotiate, lie, truth, ignore, threaten, apologize, take_responsibility, avoid_responsibility, risk, sacrifice). Botovi ih koriste za moralnu procjenu.
- `perceived`: ono što lik **misli** da će se dogoditi, od -2 do +2 (`risk` od 0 do 2). Polje koje nedostaje znači „ne zna“. Vide ga i ljudi i botovi; stvarni efekti ostaju skriveni.
- `insight`: točnija percepcija za navedene karijere. Ovo je glavni način na koji karijere „znaju više“.
- `effects` na izboru primjenjuju se **jednom za svakog lika koji ga odabere**, neovisno o ishodu.
- Default izbor mora biti dostupan svima, dakle bez `careers` i bez `condition`.

### Ishodi

Ishodi se provjeravaju **redom** i primjenjuje se prvi koji odgovara:

1. Ako `when` vrijedi (ili ga nema) i
2. ako prođe `chance` (ako je zadan); inače se nastavlja na sljedeći ishod.

Zadnji ishod mora biti bezuvjetan (bez `when` i bez `chance`). Ishod bez oba prije zadnjeg čini ostale nedostižnima, što je greška.

```jsonc
{ "id": "exposed",
  "when": { "chose": "truth", "role": "witness" },    // count: any (zadano) | all | none
  "chance": 0.7,
  "important": true,          // ulazi u Life Recap kao važan trenutak
  "revealChoices": false,     // saznaju li sudionici što su drugi odabrali
  "endsSession": false,       // razrješava glavnu priču sesije
  "effects": [ ... ],
  "followUps": [ ... ],
  "text": { "requester": "...", "witness": "..." } }
```

### Efekti

| type | polja | primjer |
|---|---|---|
| `attr` | `target`, `delta` (health, mental, money, reputation, career; ±100) | `{ "type": "attr", "target": "role:patient", "delta": { "health": -10 } }` |
| `relation` | `from`, `to`, `affinity`, `trust`, `setType`, `mutual` | `{ "type": "relation", "from": "role:a", "to": "role:b", "affinity": -20, "mutual": true }` |
| `fact` | `target`, `key`, `about` (za pair), `remove` | `{ "type": "fact", "target": "role:borrower", "key": "owes_money", "about": "role:lender" }` |
| `status` | `target`, `status`, `cause` | `{ "type": "status", "target": "role:patient", "status": "dead", "cause": "..." }` |

Sposobnosti karijere (`effect_multiplier`) skaliraju `attr` efekte lika koji ih prima.

### Nastavci (follow-ups)

```jsonc
{ "event": "career_retaliation",
  "roles": { "aggressor": "role:requester", "target": "role:witness" },   // ciljna uloga ← uloga ovog eventa
  "delaySeconds": [60, 150],   // broj ili [min, max] sekundi sesije
  "chance": 0.7,
  "condition": { ... } }       // provjerava se pri aktivaciji, nad ulogama ovog eventa
```

- Ciljne uloge koje nisu mapirane engine popunjava novim sudionicima prema uvjetima uloge. Tako se dovodi „novi sudionik“ (twist).
- Broj članova izvorne uloge mora stati u raspon ciljne uloge.
- Nastavak bez kašnjenja, bez `chance` i bez `condition` koji tvori petlju je greška.

## Jezik uvjeta

| Uvjet | Primjer |
|---|---|
| kombinatori | `{ "all": [..] }`, `{ "any": [..] }`, `{ "not": {..} }` |
| atribut | `{ "attr": "health", "of": "role:patient", "lte": 40 }` |
| karijera | `{ "careerIn": ["doctor"], "of": "self" }` |
| status | `{ "statusIn": ["active"] }` |
| činjenica lika ili para | `{ "fact": "owes_money", "of": "role:debtor", "about": "role:creditor", "present": true }` |
| činjenica sesije | `{ "sessionFact": "storm" }` |
| odnos (smjeran) | `{ "relation": { "from": "self", "to": "role:x", "typeIn": ["friend"], "affinityGte": 20, "trustLte": 50 } }` |
| viđen event | `{ "seenEvent": "career_coworker_mistake", "present": false }` |
| napredak sesije | `{ "progress": { "gte": 0.5 } }` (0..1) |
| odluke (samo u ishodima) | `{ "chose": "truth", "role": "witness", "count": "any" }` |

`of` je po zadanom `self`. Ključevi koje shema ne poznaje su greška, pa se tipfeleri hvataju odmah.

## Što validator provjerava

- **Struktura:** nepoznati ključevi, krivi tipovi, ID-evi u `lower_snake_case`, raspon brojeva.
- **Reference:** postojeće uloge, karijere, činjenice (i njihov scope: character, pair ili session), eventi; `self` i `session` samo tamo gdje imaju smisla; placeholderi u tekstu.
- **Izbori:** svaka uloga koja odlučuje ima barem 2 izbora i točno jedan default koji je dostupan svima.
- **Ishodi:** zadnji je fallback, nema nedostižnih ishoda, `chose` pokazuje na postojeći izbor.
- **Konflikti:** ista činjenica postavljena i uklonjena u istom ishodu; dva različita statusa za istu metu.
- **Sudionici:** zbroj minimalnih brojeva ≤ 8; uvjeti s nemogućim granicama.
- **Nastavci:** postojeći event, ispravno mapiranje uloga, kardinalnost, beskonačne trenutne petlje.
- **Upozorenja:** `followup_only` event nedostižan iz direktorskih eventa; činjenica provjeravana a nikad postavljena; registrirana a nekorištena činjenica; karijera bez posebnog izbora.
