import { graceEnd } from "./meeting";

export type CountdownState = "idle" | "cruise" | "terminal" | "liftoff";

/** Pure: state is a function of the clock, the selected meeting, and the threshold. */
export function pickState(
  now: number,
  meeting: { start: number; end: number } | null,
  thresholdMinutes: number,
): CountdownState {
  if (!meeting) return "idle";
  const remaining = meeting.start - now;
  if (remaining > thresholdMinutes * 60_000) return "cruise";
  if (remaining > 0) return "terminal";
  if (now <= graceEnd(meeting)) return "liftoff";
  return "idle";
}
