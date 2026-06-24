export interface CalEvent {
  title: string;
  start: number;          // epoch ms (absolute; timezone already resolved)
  end: number;            // epoch ms
  allDay: boolean;
  calendarName: string;
  attendeeCount: number;  // others, excluding the current user
  hasLink: boolean;
  declined: boolean;
}

export interface MeetingFilters {
  attendeesOnly: boolean;
  hasLinkOnly: boolean;
  hideAllDay: boolean;
  excludeTitlePattern: string; // case-insensitive substring; "" = none
}

/** A meeting holds the key (counting up) for this long after it starts, then releases it. */
export const LIFTOFF_WINDOW_MS = 5 * 60_000;

/**
 * End of a meeting's hold window: it holds the key for LIFTOFF_WINDOW_MS after start (the
 * count-up window), capped at its actual end for a meeting shorter than that. After this
 * the meeting releases the key so the next meeting (or CLEAR) surfaces.
 */
export function graceEnd(e: { start: number; end: number }): number {
  return Math.min(e.end, e.start + LIFTOFF_WINDOW_MS);
}

export function qualifies(e: CalEvent, f: MeetingFilters): boolean {
  if (f.hideAllDay && e.allDay) return false;
  if (e.declined) return false;
  if (f.attendeesOnly && e.attendeeCount < 1) return false;
  if (f.hasLinkOnly && !e.hasLink) return false;
  const pat = f.excludeTitlePattern.trim().toLowerCase();
  if (pat !== "" && e.title.toLowerCase().includes(pat)) return false;
  return true;
}

/**
 * Pick the meeting the key should track. Normally the earliest qualifying event that
 * hasn't ended. Exception: an *imminent* upcoming meeting (starting within `thresholdMs`)
 * overrides an ongoing meeting's NOW, so "your next meeting is close" wins over "you're in
 * a meeting". `thresholdMs` defaults to 0 (no override — an ongoing meeting keeps NOW).
 */
export function selectNextMeeting(
  events: CalEvent[],
  filters: MeetingFilters,
  now: number,
  thresholdMs = 0,
): CalEvent | null {
  const candidates = events
    .filter((e) => qualifies(e, filters))
    .filter((e) => graceEnd(e) >= now)
    .sort((a, b) => a.start - b.start);
  const upcoming = candidates.find((e) => e.start > now);
  if (upcoming && upcoming.start - now <= thresholdMs) return upcoming; // imminent next meeting wins
  return candidates.find((e) => e.start <= now) ?? upcoming ?? null;
}

export const DEFAULT_FILTERS: MeetingFilters = {
  attendeesOnly: false, hasLinkOnly: false, hideAllDay: true, excludeTitlePattern: "",
};
