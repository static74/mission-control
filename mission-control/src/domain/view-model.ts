import type { CountdownState } from "./countdown-state";

const MIN = 60_000;
const RING_HORIZON_MS = 60 * MIN;

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function buildBig(
  state: CountdownState,
  now: number,
  meeting: { start: number; end: number } | null,
): string {
  if (state === "idle" || !meeting) return "CLEAR";
  if (state === "liftoff") {
    // Count up from the meeting start for the duration of the liftoff window.
    const elapsedSec = Math.max(0, Math.floor((now - meeting.start) / 1000));
    return `+${pad(Math.floor(elapsedSec / 60))}:${pad(elapsedSec % 60)}`;
  }
  const remaining = Math.max(0, meeting.start - now);
  if (state === "terminal") {
    const totalSec = Math.ceil(remaining / 1000);
    return `${pad(Math.floor(totalSec / 60))}:${pad(totalSec % 60)}`;
  }
  const totalMin = Math.floor(remaining / MIN);
  if (totalMin >= 60) return `T- ${Math.floor(totalMin / 60)}:${pad(totalMin % 60)}`;
  return `T- ${totalMin}m`;
}

export function ringFraction(now: number, meeting: { start: number; end: number }): number {
  const remaining = Math.max(0, meeting.start - now);
  return Math.max(0, Math.min(1, remaining / RING_HORIZON_MS));
}
