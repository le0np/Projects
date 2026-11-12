# Projects

Radionica za projekte: ja zamislim ideju, Claude je napravi. Svaki projekt živi u svojoj mapi u korijenu repoa i potpuno je samostalan — ima vlastiti README, ovisnosti i upute za pokretanje.

## Projekti

| Projekt | Opis | Tehnologije | Status |
| ------- | ---- | ----------- | ------ |
| [dev-farm](dev-farm) | 2D farma za browser: farmer, kvaliteta uroda, štand, izumi i navodnjavanje | HTML, CSS, JavaScript | 🚧 u izradi |
| [pixel-runner](pixel-runner) | Endless runner: skači preko puževa i muha | Python, Pygame | ✅ gotovo |

Statusi: 💡 ideja · 🚧 u izradi · ✅ gotovo · 🧊 pauzirano

## Struktura

```
.
├── README.md            # ovaj pregled i popis projekata
├── CLAUDE.md            # pravila kojih se Claude drži u ovom repou
├── IDEJE.md             # ideje koje čekaju na red
├── _template/           # predlošci README.md i PROGRESS.md za novi projekt
├── dev-farm/            # jedan projekt = jedna mapa
└── pixel-runner/
```

## Kako nastaje novi projekt

1. Opišem ideju Claudeu (ili je prvo zapišem u [`IDEJE.md`](IDEJE.md)).
2. Claude napravi mapu `<ime-projekta>/` u korijenu repoa, s kodom i README-om prema [predlošku](_template/README.md).
3. Claude doda projekt u tablicu iznad i makne ga iz `IDEJE.md` ako je tamo bio.

Što ideja treba sadržavati da bi rezultat bio dobar: što projekt radi, za koga je, i eventualne želje oko tehnologije ili izgleda. Sve ostalo Claude odlučuje sam i zapisuje u README projekta.
