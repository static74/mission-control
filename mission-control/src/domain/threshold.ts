/**
 * Parse a manually entered MM:SS terminal threshold into whole seconds.
 *
 * Accepts 1-2 digit minutes, a colon, then exactly two-digit seconds in 00-59
 * (e.g. "5:00", "05:00", "04:30"). Surrounding whitespace is ignored. Returns
 * null for any malformed input so the caller can fall back to a safe default;
 * the Property Inspector's `pattern` gives the user immediate visual feedback,
 * but the stored value is never trusted here.
 */
export function parseThresholdSeconds(input: string): number | null {
  const m = input.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  // Cap at the ceiling: a larger threshold means long stretches of 1-second
  // terminal redraws for little benefit.
  return Math.min(total, MAX_THRESHOLD_SECONDS);
}

/** Default terminal threshold when the setting is empty or invalid: 05:00. */
export const DEFAULT_THRESHOLD_SECONDS = 5 * 60;

/** The default as the MM:SS string the PI field shows; must equal DEFAULT_THRESHOLD_SECONDS. */
export const DEFAULT_THRESHOLD_MMSS = "05:00";

/** Upper bound on the terminal threshold: 30:00 (matches the prior slider max). */
export const MAX_THRESHOLD_SECONDS = 30 * 60;
