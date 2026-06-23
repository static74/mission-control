import { graceEnd } from "./meeting";

export type CountdownState = "idle" | "cruise" | "terminal" | "liftoff";

/** Don't begin the countdown for a meeting further out than this — show CLEAR instead. */
export const COUNTDOWN_HORIZON_MS = 12 * 60 * 60 * 1000; // 12h

/** Pure: state is a function of the clock, the selected meeting, and the threshold. */
export function pickState(
  now: number,
  meeting: { start: number; end: number } | null,
  thresholdMs: number,
): CountdownState {
  if (!meeting) return "idle";
  const remaining = meeting.start - now;
  if (remaining > COUNTDOWN_HORIZON_MS) return "idle"; // too far out — countdown not begun
  if (remaining > thresholdMs) return "cruise";
  if (remaining > 0) return "terminal";
  if (now <= graceEnd(meeting)) return "liftoff";
  return "idle";
}
