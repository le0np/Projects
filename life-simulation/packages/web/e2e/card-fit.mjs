/**
 * T6b M2: renders the event card of EVERY event and role with the built CSS (long names, the most
 * choices one player can see) and checks that the public text, what only you know and all choices
 * fit without scrolling, on a 1280×800 desktop and an iPhone 13 screen.
 *
 *   npm run web:build && node packages/web/e2e/card-fit.mjs      (part of `npm run e2e`)
 */
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../..", import.meta.url));
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = createRequire("/opt/node-tools/")("playwright"); }
const dist = join(root, "packages/web/dist/assets");
const css = readFileSync(join(dist, readdirSync(dist).find((f) => f.endsWith(".css"))), "utf8");
const dir = join(root, "packages/content/data/events");
const NAMES = ["Alexandra", "Maximilian", "Konstantin", "Gabriela", "Valentina", "Sebastian", "Henrietta"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const cards = [];
const grammar = []; // T6c: "Maja and Ema is …"
for (const f of readdirSync(dir)) {
  const e = JSON.parse(readFileSync(join(dir, f), "utf8"));
  if (e.hidden) continue;
  let k = 0; const names = {};
  for (const [r, def] of Object.entries(e.roles)) { const n = typeof def.count === "number" ? def.count : Math.min(def.count[1], 3); names[r] = NAMES.slice(k, k + n); k += n; }
  const fill = (t) =>
    t.replace(/\{([a-z_0-9]+)(?:\|([^|{}]*)\|([^|{}]*))?\}/g, (_, r, one, many) => {
      const l = names[r] ?? [r];
      if (one !== undefined) return l.length > 1 ? many : one;
      return l.length > 1 ? `${l.slice(0, -1).join(", ")} and ${l.at(-1)}` : l[0];
    });
  for (const t of [e.text.public, ...Object.values(e.text.private ?? {})]) {
    const filled = fill(t);
    if (/ and [A-Z][a-z]+ (is|has|was) /.test(filled)) grammar.push(`${e.id}: ${filled}`);
  }
  for (const [role, choices] of Object.entries(e.choices ?? {})) {
    const visible = [...choices.filter((c) => !c.careers && !c.condition), ...choices.filter((c) => c.condition && !c.careers).slice(0, 1), ...choices.filter((c) => c.careers).slice(0, 1)];
    cards.push({ id: `${e.id}/${role}`, title: fill(e.title), cat: e.category, important: e.importance === "important",
      pub: fill(e.text.public), priv: e.text.private?.[role] ? fill(e.text.private[role]) : null,
      with: Object.entries(names).filter(([r]) => r !== role).flatMap(([, n]) => n).join(", "),
      choices: visible.map((c) => ({ label: fill(c.label), special: !!c.careers, note: c.insight?.note, hints: Object.keys(c.perceived ?? {}).length })), def: fill(choices.find((c) => c.default).label) });
  }
}
const card = (c) => `<div class="overlay beside"><article class="card event"><div class="event-meta"><span class="chip cat-${c.cat}">${c.cat}</span>${c.important ? '<span class="chip risk">Important</span>' : ""}<span class="countdown">25s</span></div>
<div class="bar thin"><div class="bar-fill urgent" style="width:80%"></div></div><h1 id="event-title">${esc(c.title)}</h1><div class="event-story"><p class="lead">${esc(c.pub)}</p></div>
${c.priv ? `<p class="private"><span class="private-label">Only you know</span>${esc(c.priv)}</p>` : ""}${c.with ? `<p class="muted small with">With: ${esc(c.with)}</p>` : ""}
<ul class="choices">${c.choices.map((x) => `<li><button class="choice${x.special ? " special" : ""}"><span class="choice-label">${x.special ? '<span class="special-tag">Your expertise</span>' : ""}${esc(x.label)}</span>${x.note ? `<span class="insight">${esc(x.note)}</span>` : ""}<span class="hints">${Array.from({ length: Math.min(3, x.hints) }, (_, i) => `<span class="hint ${i % 2 ? "bad" : "good"}">${["€ Money ↑", "Alexandra ↓", "Risky"][i]}</span>`).join("")}</span></button></li>`).join("")}</ul>
<p class="muted small default-note">If time runs out: “${esc(c.def)}”</p></article></div>`;
const browser = await pw.chromium.launch();
let failed = 0;
for (const [W, H] of [[1280, 800], [390, 664]]) {
const page = await browser.newPage({ viewport: { width: W, height: H } });
let bad = 0; const rows = [];
for (const c of cards) {
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><main class="game"><div class="game-grid"><section class="stage"><div class="town-wrap"><div class="town" style="aspect-ratio:3/2"></div>${card(c)}</div></section><aside class="side" style="height:10px"></aside></div></main></body></html>`);
  const m = await page.evaluate(() => {
    const st = document.querySelector(".event-story"); const pr = document.querySelector(".card.event .private"); const vh = innerHeight;
    const ch = [...document.querySelectorAll("button.choice")].map((b) => b.getBoundingClientRect());
    return { story: st.scrollHeight - st.clientHeight, priv: pr ? pr.scrollHeight - pr.clientHeight : 0, cardH: Math.round(document.querySelector(".card.event").getBoundingClientRect().height),
      town: Math.round(document.querySelector(".town").getBoundingClientRect().height), choiceOff: ch.filter((r) => r.bottom > vh).length };
  });
  rows.push([c.id, m]);
  if (m.story > 1 || m.priv > 1 || m.choiceOff) bad++;
}
const worst = rows.filter((r) => r[1].story > 1 || r[1].priv > 1 || r[1].choiceOff).slice(0, 20);
console.log(`${bad ? "✗" : "✓"} ${W}×${H}: ${cards.length} event cards, ${bad} need scrolling`);
for (const [id, m] of worst) console.log("   ", id, JSON.stringify(m));
failed += bad;
await page.close();
}
await browser.close();
console.log(`${grammar.length ? "✗" : "✓"} grammar: ${grammar.length} texts with "X and Y is/has/was"`);
for (const g of grammar) console.log("   ", g);
process.exit(failed || grammar.length ? 1 : 0);
