import type { Rng } from "@lifesim/core";

const NAMES = [
  "Ana", "Ben", "Clara", "David", "Ema", "Filip", "Greta", "Hugo", "Ivana", "Jakob",
  "Kim", "Luka", "Maja", "Nikola", "Olga", "Petar", "Rosa", "Sven", "Tea", "Viktor",
  "Zara", "Marko", "Lea", "Toni",
];

/** Distinct random names for a session. */
export function pickNames(count: number, rng: Rng): string[] {
  const shuffled = rng.shuffle(NAMES);
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length] + (i >= shuffled.length ? ` ${Math.floor(i / shuffled.length) + 1}` : ""));
}
