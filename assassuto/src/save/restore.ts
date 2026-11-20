/**
 * Picks a safe position when loading (GDD 14: "restore the player to a valid position").
 * Falls back to the region spawn if the saved point is missing, outside the playable area or under the terrain.
 */
export function resolveLoadPosition(
  saved: { x: number; y: number; z: number },
  spawn: { x: number; y: number; z: number },
  heightAt: (x: number, z: number) => number,
  boundsRadius: number,
): { x: number; y: number; z: number; usedSpawn: boolean } {
  const { x, y, z } = saved;
  const valid = [x, y, z].every(Number.isFinite) && Math.hypot(x, z) <= boundsRadius;
  if (!valid) return { ...spawn, usedSpawn: true };
  const ground = heightAt(x, z);
  if (y < ground - 1.5 || y > ground + 60) return { x, y: ground, z, usedSpawn: false };
  return { x, y: Math.max(y, ground), z, usedSpawn: false };
}
