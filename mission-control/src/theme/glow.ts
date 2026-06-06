import type { CountdownState } from "../domain/countdown-state";
import { THEME } from "./mission-theme";

/**
 * The meeting-mode glow color, or null for no glow. Yellow on the calm backgrounds;
 * swaps to white during terminal/liftoff, where the amber/red pulse would otherwise
 * swallow a yellow frame.
 */
export function glowColor(state: CountdownState, meetingOn: boolean): string | null {
  if (!meetingOn) return null;
  if (state === "terminal" || state === "liftoff") return THEME.white;
  return THEME.meetingGlow;
}
