# Projects

Radionica za projekte: ja zamislim ideju, Claude je napravi. Svaki projekt živi u svojoj mapi unutar `projects/` i potpuno je samostalan — ima vlastiti README, ovisnosti i upute za pokretanje.

## Projekti

| Projekt | Opis | Tehnologije | Status |
| ------- | ---- | ----------- | ------ |
| [pixel-runner](projects/pixel-runner) | Endless runner: skači preko puževa i muha | Python, Pygame | ✅ gotovo |

Statusi: 💡 ideja · 🚧 u izradi · ✅ gotovo · 🧊 pauzirano

## Struktura

```
.
├── README.md            # ovaj pregled i popis projekata
├── CLAUDE.md            # pravila kojih se Claude drži u ovom repou
├── IDEJE.md             # ideje koje čekaju na red
└── projects/
    ├── _template/       # predložak README-a za novi projekt
    └── <ime-projekta>/  # jedan projekt = jedna mapa
```

## Kako nastaje novi projekt

1. Opišem ideju Claudeu (ili je prvo zapišem u [`IDEJE.md`](IDEJE.md)).
2. Claude napravi mapu `projects/<ime-projekta>/` s kodom i README-om prema [predlošku](projects/_template/README.md).
3. Claude doda projekt u tablicu iznad i makne ga iz `IDEJE.md` ako je tamo bio.

Što ideja treba sadržavati da bi rezultat bio dobar: što projekt radi, za koga je, i eventualne želje oko tehnologije ili izgleda. Sve ostalo Claude odlučuje sam i zapisuje u README projekta.
