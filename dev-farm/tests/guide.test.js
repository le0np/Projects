import { test } from 'node:test';
import assert from 'node:assert/strict';

import { guideTopics, searchGuide, topicText } from '../src/guide.js';
import { RECIPES, CROPS, FERTILIZER_PRICE, BUILDINGS } from '../src/data.js';

test('handbook: every topic has a title and text, ids are unique', () => {
  const topics = guideTopics();
  assert.ok(topics.length >= 10);
  assert.equal(new Set(topics.map((t) => t.id)).size, topics.length);
  for (const t of topics) {
    assert.ok(t.title && t.icon && t.body.length, t.id);
    assert.doesNotMatch(topicText(t), /undefined|NaN/, t.id);
  }
});

test('handbook: how to make fertilizer, with the real numbers', () => {
  const [first] = searchGuide('gnojivo');
  assert.equal(first.id, 'fertilizer', 'the fertilizer topic comes first');
  const text = topicText(first);
  assert.match(text, /radnom stolu/);
  assert.match(text, /5 kg jedne vrste ploda/);
  assert.match(text, /10 doza/);
  assert.match(text, /★★★★★/, 'how to get the best class');
  assert.ok(text.includes(`${FERTILIZER_PRICE} zl`), 'the delivery price');
  // search ignores case and Croatian letters
  assert.equal(searchGuide('KOKOSI')[0].id, 'coop');
  assert.equal(searchGuide('pecaljka')[0].id, 'fishing');
  assert.equal(searchGuide('nema toga nigdje').length, 0);
  assert.equal(searchGuide('').length, guideTopics().length);
});

test('handbook: lists every invention, building cost and crop', () => {
  const all = guideTopics().map(topicText).join(' ');
  for (const r of RECIPES) assert.ok(all.includes(r.name), r.name);
  for (const c of CROPS) assert.ok(all.includes(c.name), c.name);
  for (const b of Object.values(BUILDINGS)) assert.ok(all.includes(`${b.wood} drva, ${b.stone} kamena`), b.name);
});
