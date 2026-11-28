/**
 * Maps clips found in a downloaded animation file back to logical names.
 * Prefers matching by preset name inside the clip name; falls back to request order.
 */
export function matchClips(fileClipNames: string[], requested: [logical: string, preset: string][]): string[] {
  const remaining = [...requested];
  const byName = fileClipNames.map((clip) => {
    const c = clip.toLowerCase();
    // Longest preset names first so "jump_down" wins over "jump".
    const candidates = remaining
      .map((r, i) => ({ i, short: r[1].split(':').pop()!.toLowerCase() }))
      .sort((a, b) => b.short.length - a.short.length);
    const hit = candidates.find((x) => c.includes(x.short));
    if (!hit) return null;
    const [logical] = remaining.splice(hit.i, 1)[0];
    return logical;
  });
  if (byName.every((n) => n !== null)) return byName as string[];
  // Name matching was inconclusive: trust the request order (documented behaviour of retarget).
  return fileClipNames.map((clip, i) => requested[i]?.[0] ?? clip);
}
