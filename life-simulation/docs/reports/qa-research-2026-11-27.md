# QA igranje i istraživanje sličnih igara — 27. 11. 2026.

Autor: QA/PM agent. Ovaj dokument je podloga za zadatke u [`../../INSTRUCTIONS_FOR_AGENT.md`](../../INSTRUCTIONS_FOR_AGENT.md).

## 1. Što je QA izmjerio

### Igranje u browseru (TIME_SCALE=1, 6 likova, 1 čovjek, odvjetnik, 3 minute)

Skripta je igrala kao čovjek: na svaki event čekala 6 s (čitanje), pa birala.

| Mjera | Rezultat |
|---|---|
| Eventi za igrača u 3 min | 9 (otprilike jedan svakih 20 s) |
| Eventi u kojima odlučuje još netko („With: …”) | 3 od 9 — prvih 5 eventa su svi solo |
| Vrijeme na odbrojavanju kad se event pojavi | 13–18 s (obični), 25–39 s (važni) |
| Duljina teksta eventa s izborima | 53–94 riječi + 3–4 izbora s oznakama |
| Potrebno vrijeme za čitanje (≈220 riječi/min) | 15–25 s, dakle rok je na granici već na normalnoj brzini |
| Isti rokovi uz TIME_SCALE=6 (kako je igrao vlasnik) | 1,7–3,3 s za obične evente — nemoguće pročitati |
| Između eventa | ~20 s bez ikakve radnje; igrač samo gleda figurice |
| Greške u konzoli | nema |

### Podaci iz batch simulacije (`docs/reports/m10.report.md`, 200 sesija)

- **74 % svih pojavljivanja eventa ima samo jednog lika koji odlučuje** (14 120 solo naspram 5 036 s više sudionika). Glavno obećanje igre („tvoj život ovisi o drugima”) vrijedi za samo četvrtinu eventa.
- **Sedam solo eventa dogodi se svakom liku u svakoj sesiji** (po ~1 195 puta na 1 195 likova): Missed Bus, Annual Review, Scratch in the Car Park, Too Much Change, Tax Refund, Weekend Work, Just This Once (ovaj čak 1,8× po liku). Svaki život zato ima istih ~8 „taktova” — to je monotonija koju vlasnik osjeća.
- Eventi o vezama su rijetki: First Date 158, Jealousy 1, Crisis Talk 0.
- Direktor „ne nađe ništa” 229 puta po sesiji.

### Uočene greške u sučelju

- Na 1280×800 kartica eventa pokriva pola mape, a 4. izbor je odrezan (treba skrolati unutar kartice). Snimka: event „Missed Bus”.
- Popis „People” kasni jedan event: nakon zajedničkog eventa s Olgom i kasnije s Gretom obje su još „Stranger” dok ne stigne sljedeća poruka.
- Feed „Around town” je pun tuđih dosadnih solo eventa („Kim receives a tax refund.”).
- Kao ime lika u priči koristi se korisničko ime („qa51194 watches the bus pull away”).

## 2. Istraživanje: kako slične igre rješavaju iste probleme

| Problem vlasnika | Igra | Obrazac | Primjena kod nas |
|---|---|---|---|
| Monotonija | RimWorld (Cassandra) | „Storyteller” s krivuljom napetosti: mir → rast → katastrofa → predah; bira tko dugo nije imao event | Krivulja kroz sesiju + finale ([wiki](https://rimworldwiki.com/wiki/AI_Storytellers)) |
| Monotonija | BitLife | Ribbon na kraju života („Mysterious”, „Rich”) — nagrađuje i čudne živote; izazovi s ciljem | Titula u recapu + 2 osobna cilja po sesiji ([Gamezebo](https://www.gamezebo.com/walkthroughs/bitlife-life-simulator-get-ribbons/)) |
| Monotonija | Sort the Court | Igrači se žale baš na „repetitive” i „nema posljedica”; rješenje: svijet se vidljivo mijenja | Trajni tragovi posljedica na mapi ([itch.io](https://itch.io/t/2150219/great-game-great-characters-great-premise-but-gets-repetitive-after-a-while)) |
| Monotonija | Reigns | Svaki izbor vidljivo gura mjerače, ekstremi stvaraju sadržaj | Ekstremni atributi pokreću evente (bogat → traže zajam) ([PC Gamer](https://pcgamer.com/how-reigns-and-its-forthcoming-sequel-make-their-tinderocracy-work)) |
| Kratko vrijeme | Jackbox | Timer postoji samo da nema predugog čekanja; ima „Extended timers” i „No timer”; kad svi odgovore, ide dalje | Rok u stvarnim sekundama, ne ovisi o TIME_SCALE ([Jackbox](https://www.jackboxgames.com/streaming-moderation-accessibility-features-jackbox-party-pack-eight/)) |
| Kratko vrijeme | Among Us | Glasanje 0–300 s, preporuka ~45 s rasprave | Rok mora pokriti čitanje |
| Prejednostavne smicalice | Crusader Kings III | Spletke u koracima: šansa uspjeha, tajnost, priprema, suučesnici, otkrivanje → „hook” nad krivcem | Smicalica u 3 koraka s rizikom i osvetom ([Paradox dev diary](https://forum.paradoxplaza.com/forum/threads/ck3-dev-diary-5-schemes-secrets-and-hooks.1289167)) |
| Kartice umjesto grada | Tomodachi Life, The Sims | Mjehurić raspoloženja iznad svakog lika; stanje grada vidi se bez čitanja | Emoji raspoloženja i linije odnosa na mapi ([Shacknews](https://www.shacknews.com/article/148744/how-to-make-your-miis-happy-in-tomodachi-life-living-the-dream)) |
| Kartice umjesto grada | RimWorld | Malo likova s imenom i osobinom → igrač sam „dopisuje” priču | Osobina vidljiva uz ime („Gossip”, „Cheapskate”) |
| Mrtvo vrijeme | Trivia Murder Party | Mrtvi igrači kao duhovi i dalje igraju | Duh: glasa, gurne jedan event |
| Dijeljenje | Wordle | Rezultat kao niz emojija bez spoilera | „Copy my life” niz emojija s titulom |

Napomena: neke stranice (gamedeveloper.com, jackboxgames.com) nisu bile dostupne iz okruženja, pa su dijelovi izvora sažeci pretraživanja. Točne zadane duljine Jackbox timera nisu potvrđene.
