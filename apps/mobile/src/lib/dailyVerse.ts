import { verses, type Verse } from "../data/verses";

/** Return a deterministic verse for the given date (day-of-year modulo pool size). */
export function getDailyVerse(date: Date = new Date()): Verse {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return verses[dayOfYear % verses.length];
}
