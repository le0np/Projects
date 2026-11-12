# Pixel Runner

Mala 2D "endless runner" igra u Pythonu i Pygameu. Trčiš, skačeš preko puževa i muha i skupljaš bodove za svaku preživljenu sekundu. Prvotno nastala kao vježba za učenje Pythona (izvorni repo: `le0np/PixelRunner`), ovdje dovršena.

**Status:** ✅ gotovo

## Pokretanje

```bash
cd projects/pixel-runner
pip install -r requirements.txt
python main.py
```

Potreban je Python 3.9+ i grafičko sučelje. Ako nema zvučne kartice, igra radi bez zvuka.

## Kontrole

| Tipka | Radnja |
| ----- | ------ |
| `Space` | start igre / skok / ponovni pokušaj |
| klik na lika | skok |
| `Esc` | izlaz |

## Što je dovršeno u odnosu na original

Originalni `newgame.py` bio je napola prebačen sa funkcija na klase pa se nije dao pokrenuti. Sad je sve u jednom `main.py`:

- dovršen prelazak na `Player` i `Obstacle` sprite klase (stari paralelni kod s `player_rect`/`obstacle_rect_list` uklonjen; original je rušio `NameError` na `player_index`)
- ispravljena imena mapa/datoteka (`Fly`/`Player` → `fly`/`player`) da radi na Linuxu, ne samo na Windowsu/Macu
- dodani glazba i zvuk skoka (datoteke su već bile u `audio/`, ali se nisu koristile)
- najbolji rezultat u sesiji, brzina raste s bodovima (do ograničenja)
- malo manji hitbox prepreka da bliski promašaji budu fer
- rezultat se mjeri od početka svake runde (original je pogrešno računao start)

## Struktura

```
.
├── main.py            # cijela igra
├── requirements.txt
├── audio/             # jump.mp3, music.wav
├── font/              # Pixeltype.ttf
└── graphics/          # sprite-ovi (player, snail, fly, pozadina)
```

`graphics/player/Minka*.png` su neiskorištene slike iz originalnog repoa, ostavljene za buduće likove.

## Moguća poboljšanja

- trajno spremanje najboljeg rezultata
- pauza i uključivanje/isključivanje glazbe
- više vrsta prepreka
