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
