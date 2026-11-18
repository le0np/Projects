import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, serialize, deserialize, recordFight, advance, startActivity } from '../src/engine/progression.js';
import { BASICS, sparringReady, storyStep, finishIntro, skipStory } from '../src/engine/story.js';
import { makeFirstSparPartner, fighterFromState } from '../src/engine/opponent.js';
import { createFight, stepFight } from '../src/engine/fight.js';
import { gymScene } from '../src/ui/gymScene.js';
import { MOVE_BY_ID } from '../src/data/moves.js';
import { mulberry32 } from '../src/engine/rng.js';

const fixed = (v) => () => v;

test('basics are real white-belt moves', () => {
  for (const id of BASICS) assert.equal(MOVE_BY_ID[id]?.belt, 'white', id);
});

test('sparring is locked until every basic is at level 1; unlock-all opens it', () => {
  const s = createState({ test: true, now: 0 });
  assert.deepEqual(sparringReady(s), { ok: false, missing: BASICS, have: 0, need: BASICS.length });
  for (const id of BASICS.slice(0, -1)) s.levels[id] = 1;
  assert.deepEqual(sparringReady(s).missing, [BASICS.at(-1)]);
  s.levels[BASICS.at(-1)] = 2;
  assert.equal(sparringReady(s).ok, true);
  const u = createState({ test: true, now: 0 });
  u.unlockAll = true;
  assert.equal(sparringReady(u).ok, true);
});

test('the coach walks you through basics, first spar, an activity, a competition and the blue belt', () => {
  const s = createState({ test: true, now: 0 });
  assert.equal(s.story.intro, false);
  finishIntro(s);
  let step = storyStep(s);
  assert.equal(step.id, 'basics');
  assert.equal(step.move, BASICS[0]);
  assert.equal(step.done, 0);
  for (const id of BASICS) s.levels[id] = 1;
  assert.equal(storyStep(s).id, 'spar');
  recordFight(s, 'spar', true);
  assert.equal(storyStep(s).id, 'activity');
  startActivity(s, 'openMat', fixed(0.99), 0);
  advance(s, 100_000, fixed(0.99));
  assert.equal(storyStep(s).id, 'comp');
  recordFight(s, 'comp', false);
  step = storyStep(s);
  assert.equal(step.id, 'belt');
  assert.match(step.line, /20 moves and 5 competition wins/);
  s.belt = 'blue';
  assert.equal(storyStep(s), null);
});

test('skipping the guide hides the coach but sparring still needs the basics', () => {
  const s = createState({ test: true, now: 0 });
  skipStory(s);
  assert.equal(storyStep(s), null);
  assert.equal(s.story.intro, true);
  assert.equal(sparringReady(s).ok, false);
});

test('an old save without a story shows the intro and counts what was already done', () => {
  const s = createState({ test: true, now: 0 });
  s.wins = 3; s.losses = 1; s.medals.bronze = 1; s.compWins = 1;
  delete s.story;
  const back = deserialize(serialize(s), 0);
  assert.equal(back.story.intro, false);
  assert.equal(back.story.comps, 1);
  assert.equal(back.story.activities, 0);
  const fresh = deserialize(serialize(createState({ test: true, now: 0 })), 0);
  assert.deepEqual(fresh.story, { intro: false, skipped: false, spars: 0, activities: 0, comps: 0 });
});

test('first sparring partner is an easy white belt', () => {
  const p = makeFirstSparPartner(mulberry32(7));
  assert.equal(p.belt, 'white');
  assert.ok(Object.values(p.levels).every((l) => l <= 2));
  assert.ok(p.strength <= 2 && p.cardio <= 2);
});

test('in a coached fight every decision gets the coach hint on the best card', () => {
  const s = createState({ test: true, now: 0 });
  s.unlockAll = true;
  let seen = 0;
  for (let seed = 1; seed <= 40 && seen < 5; seed++) {
    const f = createFight(fighterFromState(s), makeFirstSparPartner(mulberry32(seed)), mulberry32(seed + 100), { coach: true });
    for (let i = 0; i < 4000 && !f.ended; i++) {
      stepFight(f, 0.25);
      if (f.critical) {
        assert.equal(f.critical.hint.coach, true);
        assert.equal(f.critical.hint.accuracy, 1);
        assert.ok(f.critical.options[f.critical.hint.index].correct);
        seen += 1;
        break;
      }
    }
  }
  assert.ok(seen > 0);
});

test('gym view shows the coach line only after the intro and while the story runs', () => {
  const s = createState({ test: true, now: 0 });
  assert.equal(gymScene(s).coach, null);
  finishIntro(s);
  assert.match(gymScene(s).coach, /Learn: Shrimp/);
  skipStory(s);
  assert.equal(gymScene(s).coach, null);
});
