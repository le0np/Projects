# Napredak projekta Life Simulation

Ovaj dokument bilježi završeni posao, provedene provjere, poznata ograničenja i sljedeće korake. Novi rad treba dodavati kronološki, bez brisanja važnih ranijih odluka.

## Trenutno stanje

Faza planiranja (M0). Specifikacija v1.0 je spremljena u `docs/spec/`, a pregled s planom u `docs/IMPLEMENTATION_PLAN.md`. Koda još nema. Čeka se potvrda odluka D1–D5.

## Napravljeno 13. studenog 2026.

### Pregled specifikacije i plan (M0)

- Spremljeno 7 dokumenata specifikacije + pregled (globalna pravila, kriteriji prihvaćanja) u `docs/spec/`.
- Napisan `docs/IMPLEMENTATION_PLAN.md`: 14 nedosljednosti (K1–K14) s prijedlozima, 10 tehničkih odluka, arhitektura (npm workspaces: core, content, engine, bots, sim, server, web), model lika, skica sheme eventa, direktor, bot, milestonei M0–M8, redoslijed i rizici.
- Ključne odluke: engine je čista deterministička biblioteka (seedani PRNG s odvojenim tokovima, apstraktni `Clock`, log domenskih događaja); botovi i ljudi dijele isto `Controller` sučelje i dobivaju istu projekciju stanja (`CharacterView`); izbori imaju odvojene „percipirane“ posljedice od stvarnih efekata.

## Zadnja automatizirana provjera

Nije primjenjivo — još nema koda.

## Poznata ograničenja

- Odluke D1–D5 (paralelni eventi, NPC-ovi, početni odnosi, Vite umjesto Next.js, jezik igre) još nisu potvrđene; do potvrde vrijede preporuke iz plana.

## Sljedeći koraci

1. Potvrda odluka D1–D5.
2. M1: monorepo kostur, paket `core` (tipovi, Zod sheme, PRNG, Clock, DSL uvjeta), `content` s 10 karijera i ~6 testnih eventa, validator CLI.
3. M2: engine s nasumičnim kontrolerom; M3: botovi i prvi bot-only prototip.

## Handoff za novi chat

1. Projekt je u `life-simulation/`. Prvo pročitati `docs/IMPLEMENTATION_PLAN.md`, a za detalje `docs/spec/`.
2. Još nema naredbi za pokretanje.
3. Granice: engine bez I/O i bez stvarnog sata; `bots` ovisi samo o `core` tipovima, nikad o `engine`; sadržaj eventa je JSON u `packages/content`, nikad u kodu; ne mijenjati koncept igre bez dogovora s vlasnikom.
