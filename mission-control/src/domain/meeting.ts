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

export const GRACE_CAP_MS = 15 * 60 * 1000;

/** End of a meeting's "NOW" window: its end time, capped 15 min after start. */
export function graceEnd(e: { start: number; end: number }): number {
  return Math.min(e.end, e.start + GRACE_CAP_MS);
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

/** Earliest qualifying event not yet past its grace window. */
export function selectNextMeeting(events: CalEvent[], filters: MeetingFilters, now: number): CalEvent | null {
  const candidates = events
    .filter((e) => qualifies(e, filters))
    .filter((e) => graceEnd(e) >= now)
    .sort((a, b) => a.start - b.start);
  return candidates[0] ?? null;
}

export const DEFAULT_FILTERS: MeetingFilters = {
  attendeesOnly: false, hasLinkOnly: false, hideAllDay: true, excludeTitlePattern: "",
};
