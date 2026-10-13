/** Which HA webhook to fire for a meeting-mode transition, or null for none. */
export function webhookForTransition(
  before: boolean,
  after: boolean,
  meetingModeUrl: string,
  noMeetingUrl: string,
): string | null {
  if (before === after) return null;
  const url = (after ? meetingModeUrl : noMeetingUrl).trim();
  return url || null;
}

/** The deterministic value handed to the Shortcut for the state being entered. */
export function targetFor(nextOn: boolean): "meeting" | "normal" {
  return nextOn ? "meeting" : "normal";
}

/** A press held at least this long re-picks Quick Configs instead of toggling. */
export const LONG_PRESS_MS = 600;

export function isLongPress(heldMs: number): boolean {
  return heldMs >= LONG_PRESS_MS;
}

export type ShortcutInput = "meeting" | "normal" | "reset meeting" | "reset normal";

/**
 * The stdin string for a press. A short press targets the mode being entered; a long
 * press resets the CURRENT mode (the bit does not flip, so the Shortcut re-picks for
 * the mode the user is already in).
 */
export function inputFor(long: boolean, meetingOn: boolean): ShortcutInput {
  return long ? `reset ${targetFor(meetingOn)}` : targetFor(!meetingOn);
}
