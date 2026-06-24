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
