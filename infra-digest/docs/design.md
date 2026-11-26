# infra-digest: dizajn

Datum: 2026-11-26 · Status: nacrt, čeka odobrenje vlasnika

## Namjera

Tim održava WordPress stranice na Plesk Obsidian serverima kod Contaba, Vultra i Hetznera. Svako jutro želi na jednom mjestu, u Slacku, vidjeti ima li što zakrpati i ima li problema kod providera, bez ručnog obilaženja stranica. Osim toga, ako provider ima incident tijekom dana, tim ga želi saznati bez čekanja sutrašnjeg jutra.

## Ciljevi

1. **Jutarnji sažetak u 9:00 (Europe/Zagreb)** u jedan Slack kanal, svaki dan. Sadrži novosti od prethodnog uspješnog sažetka:
   - **WordPress:** nove ranjivosti u WordPress coreu i u ~10 pluginova s liste tima, te nova izdanja WordPressa (posebno sigurnosna).
   - **PHP:** nove ranjivosti i sigurnosna izdanja samo za PHP grane koje tim koristi.
   - **Plesk Obsidian:** nova izdanja i zakrpe iz službenog changeloga, a sigurnosne su istaknute.
   - **Hosting (Contabo, Vultr, Hetzner):** aktivni incidenti i najavljeni radovi.
   - Svaka stavka ima link na izvor.
2. **Tiha satna provjera** status stranica providera. U Slack piše samo kad se pojavi novi incident, jednom po incidentu, i još jednom kad je riješen.
3. **Sažetak se šalje i kad je mirno** ("✅ ništa novo"), da se vidi da sustav radi.

## Nije cilj

- Nadzor vlastitih servera, Plesk panela ili stranica (uptime, ping). Vlasnik je to izričito isključio.
- Sve WordPress ranjivosti svijeta. Prate se samo core i pluginovi s liste.
- Automatsko patchanje ili provjera koje verzije su stvarno instalirane na serverima.
- Web sučelje, baza podataka, više kanala ili korisnika.

## Anti-ciljevi (što bi bio promašaj iako "radi")

- **Šum:** sažetak toliko dug ili irelevantan da ga ljudi prestanu čitati.
- **Tihi kvar:** program stane ili izvor promijeni format, a nitko ne primijeti. Svaki izvor koji ne uspije dohvatiti mora biti vidljivo prijavljen u sažetku.
- **Spam:** satna provjera ponavlja isti incident svaki sat.

## Ograničenja

- Radi na jednom od serverâ tima (Linux), pokreće ga cron. Odluka vlasnika: opcija A.
- Tajne (Slack webhook, API ključ) idu u `.env`, a repo dobiva samo `.env.example`.
- Projekt je samostalna mapa `infra-digest/` u repou, prema pravilima iz `CLAUDE.md`.
- Ako padne server na kojem nadzor radi, pada i nadzor. Preporuka timu je staviti ga kod providera koji je najstabilniji.

## Pristupi koji su razmatrani

| Pristup | Za | Protiv |
|---|---|---|
| **A) Python + cron na serveru tima** ✅ odabrano | Točno vrijeme, stanje je obična JSON datoteka, jednostavno debugiranje | Ovisi o tom jednom serveru |
| B) GitHub Actions | Bez servera, neovisno o infrastrukturi | Kašnjenja 10 do 30 min, cron u UTC-u, nespretno stanje, workflow mora u korijen repoa |
| C) Cloudflare Workers / serverless | Besplatno, neovisno | Nova platforma i račun, ne isplati se za ovoliki posao |

Kod je pisan tako da se kasnije može preseliti na B bez prepisivanja.

## Odluke vlasnika

- Primatelj je tim, a svrha je posao.
- WordPress: samo core i lista pluginova koju vlasnik dostavlja.
- Provider incidenti: jutarnji sažetak plus satna tiha provjera, koja javlja samo kad nešto ne radi.
- Pod "paneli" se misle status stranice providera.
- Platforma: opcija A.

## Odluke Claudea (vlasnik može ispraviti)

- **Jezik:** Python 3.11+. Konfiguracija se čita s `tomllib` iz standardne biblioteke, a za HTTP i RSS koriste se `requests` i `feedparser`. Na Linux serverima je to najjednostavnije.
- **Jezik poruka:** hrvatski, a nazivi ranjivosti ostaju kako ih izvor piše.
- **Slack:** Incoming Webhook (jedan URL u `.env`), poruke u Block Kit formatu. Webhook je najjednostavniji, bez Slack bota i OAutha.
- **Konfiguracija:** `config.toml` sadrži listu pluginova (slugovi s wordpress.org), PHP grane, uključene providere i najnižu ozbiljnost (zadano: sve, jer je pluginova malo).
- **Stanje:** `state.json` pamti ID-jeve već javljenih stavki, otvorene incidente i vrijeme zadnjeg uspješnog sažetka. Ako sažetak jedan dan ne prođe, sljedeći pokriva cijeli propušteni period.
- **Prvo pokretanje:** bez stanja se ne šalje cijela povijest ranjivosti. Prvi sažetak prikazuje samo zadnjih 7 dana, a sve starije samo zabilježi kao "viđeno".
- **"Novo" znači ID koji još nije u stanju**, ne datum objave, jer izvori naknadno dopunjuju i ispravljaju zapise.
- **Hosting dio sažetka** prikazuje trenutno stanje (aktivni incidenti i najavljeni radovi u sljedećih 7 dana), a ne samo novosti.
- **Dvije naredbe, dva cron unosa:** `digest` (`0 9 * * *` uz `CRON_TZ=Europe/Zagreb`) i `status-check` (`0 * * * *`).
- **Ranjivost plugina u sažetku:** naziv, CVSS ozbiljnost, pogođene verzije i verzija u kojoj je popravljeno. "⚠️ nema zakrpe" se jasno ističe.
- **Redoslijed u poruci:** najprije ono što traži akciju (ranjivosti s ozbiljnošću high ili critical, aktivni incidenti), zatim ostalo.

## Izvori podataka

| Tema | Izvor | Napomena |
|---|---|---|
| WP pluginovi + core ranjivosti | Wordfence Intelligence Vulnerability Data Feed **v3** (production feed) | Besplatno, ali traži API ključ s wordfence.com računa (v1 i v2 su ugašeni u ožujku 2026.). Feed je velik, pa se dohvaća jednom dnevno i filtrira po slugu. |
| WP izdanja | `api.wordpress.org/core/version-check/1.7/` | Nova verzija u odnosu na stanje |
| PHP | GitHub security advisories za `php/php-src` + php.net releases JSON za praćene grane | Javni API-ji |
| Plesk Obsidian | RSS changelog: `docs.plesk.com/release-notes/obsidian/change-log/rss.xml` | Sadrži zadnjih 30 unosa. Sigurnosne stavke se prepoznaju po ključnim riječima ("security", "vulnerability", "CVE"). |
| Vultr | `status.vultr.com/status.json` i `alerts.json` (službeno dokumentirani) | |
| Hetzner | `status.hetzner.com` | Postoji li službeni feed ili JSON, treba provjeriti pri izradi. Ako ne postoji, parsira se HTML. |
| Contabo | `contabo-status.com` | Službeni feed nije potvrđen, pa se vjerojatno parsira HTML. |

Iz okruženja u kojem je pisan ovaj dizajn izvori nisu bili mrežno dostupni. Njihov točan format provjerava se na početku izrade, na stroju s pristupom internetu.

## Izgled poruke (skica)

```
📋 Jutarnji pregled: čet 27.11.2026.

🔴 TRAŽI AKCIJU
• Contact Form 7 ≤ 6.0.1: SQL injection (CVSS 8.8), popravljeno u 6.0.2 → link
• Hetzner: degradirane performanse u FSN1 (u tijeku od 07:40) → link

🧩 WordPress
• Novo izdanje: WordPress 6.9.1 (sigurnosno) → link
🐘 PHP (8.2, 8.3)
• PHP 8.3.15: popravlja CVE-2026-xxxx → link
🛠️ Plesk Obsidian
• 18.0.81 Update 2: sigurnosna zakrpa → link
🌐 Hosting
• Vultr: najavljeni radovi u Frankfurtu, sub 29.11. 02:00–04:00 → link
• Contabo: ✅ bez incidenata

⚠️ Izvor nedostupan: contabo-status.com (HTTP 503)
```

Satna obavijest: `🚨 Hetzner: novi incident: <naslov> → link`, a kad se riješi: `✅ Hetzner: riješeno: <naslov>`.

## Rukovanje greškama

- Svaki izvor se dohvaća zasebno, tako da kvar jednog ne ruši ostale. Neuspjeli izvori se navode u sažetku.
- Ako satna provjera ne uspije dohvatiti status stranicu, šuti, ali to bilježi u log. Ako ista stranica ne odgovara 3 sata zaredom, šalje jednu obavijest ("ne mogu provjeriti status Contaba").
- Ako ne uspije ni slanje u Slack, ispisuje se greška u log i izlazi s kodom ≠ 0, a stanje se ne ažurira, tako da se idući put ništa ne izgubi.

## Testiranje

- Svaki parser se testira na spremljenom primjeru stvarnog odgovora (fixture).
- Postoji `--dry-run` koji ispisuje poruku u terminal umjesto slanja u Slack.
- Prije predaje se jednom pošalje stvarna poruka u testni kanal.

## Ostaje graditelju

- Točan format Hetzner i Contabo status stranica i način parsiranja.
- Logika deduplikacije u detalje (ID-jevi po izvoru).
- Struktura modula unutar `infra-digest/`.

## Što treba od vlasnika prije ili tijekom izrade

1. Lista pluginova (slugovi ili nazivi) i PHP grane na serverima.
2. Slack Incoming Webhook URL za kanal, koji ide samo u `.env` na serveru.
3. Wordfence API ključ (besplatan račun na wordfence.com), koji isto ide samo u `.env`.
4. Na kojem serveru će program raditi (Linux, Python 3.11+).
