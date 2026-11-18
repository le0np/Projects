// Countdown for the critical-moment choice. Keyed by the fight's criticalCount so a chained
// counter always starts with a full timer, even if it opened in the last frame of the previous one.
export function tickCriticalTimer(timer, critical, criticalCount, dt) {
  const t = timer && timer.seq === criticalCount ? { ...timer } : { seq: criticalCount, left: critical.timeLimit };
  t.left -= dt;
  return { timer: t, expired: t.left <= 0 };
}
