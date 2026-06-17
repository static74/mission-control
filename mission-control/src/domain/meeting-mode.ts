import type { AudioOutput } from "../audio/types";

/** Live-derived: meeting mode is on iff the current output IS the meeting device. */
export function isMeetingMode(current: AudioOutput | null, meetingDevice: string): boolean {
  if (!current) return false;
  return current.uid === meetingDevice || current.name === meetingDevice;
}

/** The device to switch to on the next press. Unknown current -> go to meeting. */
export function nextOutputTarget(
  current: AudioOutput | null,
  normalDevice: string,
  meetingDevice: string,
): string {
  return isMeetingMode(current, meetingDevice) ? normalDevice : meetingDevice;
}

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
