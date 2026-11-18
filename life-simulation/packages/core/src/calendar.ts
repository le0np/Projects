/**
 * Session time → life calendar (concept v2 §3): one year lasts `yearMs` of session time,
 * split into four seasons; every character starts at the same age.
 */
import { SEASONS, type Season } from "./constants";

export interface CalendarPoint {
  /** Whole years elapsed since the session started (0-based). */
  year: number;
  season: Season;
  /** 0 = spring … 3 = winter. */
  seasonIndex: number;
}

export function calendarAt(timeMs: number, yearMs: number): CalendarPoint {
  const years = Math.max(0, timeMs) / yearMs;
  const year = Math.floor(years);
  const seasonIndex = Math.min(3, Math.floor((years - year) * 4));
  return { year, season: SEASONS[seasonIndex] as Season, seasonIndex };
}

export function ageAt(startAge: number, timeMs: number, yearMs: number): number {
  return startAge + Math.floor(Math.max(0, timeMs) / yearMs);
}
