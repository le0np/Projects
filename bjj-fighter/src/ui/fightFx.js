// What the fight HUD shows on top of the picture: energy segments, technique banners and score badges.
// Pure functions over the fight state, so they work the same with the 2D and a future 3D renderer.

export function energySegments(energy) {
  const e = Math.max(0, Math.min(100, energy));
  return { on: Math.ceil(e / 10), level: e < 20 ? 'spent' : e < 50 ? 'tired' : 'ok' };
}

const BY_KIND = { takedown: ['TAKEDOWN!', true], sweep: ['SWEEP!', true], pass: ['PROLAZ!', false] };
const BY_TARGET = { mount: 'MOUNT!', back: 'LEĐA!' };

// Banner for a technique that worked. Submissions get theirs (TAP!) from the end of the fight.
export function bannerFor(action, success) {
  if (!action || success !== true || action.kind === 'sub') return null;
  const byKind = BY_KIND[action.kind];
  if (byKind) return { text: byKind[0], shake: byKind[1] };
  const text = BY_TARGET[action.to?.pos];
  return text ? { text, shake: false } : null;
}

export function createFxMemo(fight) {
  return {
    seq: fight.lastAction?.seq ?? -1,
    pts: { p: fight.score.p.pts, o: fight.score.o.pts },
    ended: !!fight.ended,
  };
}

// Compares the fight with what was already shown and returns the new events plus a new memo.
export function nextFxEvents(memo, fight, actionById) {
  const events = [];
  const la = fight.lastAction;
  if (la && la.seq !== memo.seq) {
    const banner = bannerFor(actionById[la.actionId], la.success);
    if (banner) events.push({ type: 'banner', who: la.who, ...banner });
  }
  for (const who of ['p', 'o']) {
    const gain = fight.score[who].pts - memo.pts[who];
    if (gain > 0) events.push({ type: 'badge', who, pts: gain });
  }
  const end = fight.ended;
  if (end && !memo.ended && end.method === 'sub' && end.detail !== 'predaja') {
    events.push({ type: 'banner', who: end.winner, text: 'TAP!', shake: false });
  }
  return { memo: createFxMemo(fight), events };
}
