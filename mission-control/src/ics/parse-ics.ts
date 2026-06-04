import ICAL from "ical.js";
import type { CalEvent } from "../domain/meeting";

const CONFERENCE_HOSTS = ["zoom.us", "meet.google", "teams.microsoft", "teams.live", "webex.com"];

function registerTimezones(vcalendar: ICAL.Component): void {
  for (const vtz of vcalendar.getAllSubcomponents("vtimezone")) {
    const tzid = vtz.getFirstPropertyValue("tzid") as string | null;
    if (!tzid) continue;
    if (ICAL.TimezoneService.has(tzid)) continue;
    ICAL.TimezoneService.register(new ICAL.Timezone({ component: vtz, tzid }));
  }
}

function attendeeProps(vevent: ICAL.Component): ICAL.Property[] {
  return vevent.getAllProperties("attendee");
}

function attendeeCountExcludingOwner(vevent: ICAL.Component, ownerEmail?: string): number {
  const owner = ownerEmail?.toLowerCase();
  let n = 0;
  for (const a of attendeeProps(vevent)) {
    const val = String(a.getFirstValue() ?? "").toLowerCase(); // e.g. "mailto:other@example.com"
    if (owner && val.includes(owner)) continue;
    n++;
  }
  return n;
}

function ownerDeclined(vevent: ICAL.Component, ownerEmail?: string): boolean {
  if (!ownerEmail) return false;
  const owner = ownerEmail.toLowerCase();
  for (const a of attendeeProps(vevent)) {
    const val = String(a.getFirstValue() ?? "").toLowerCase();
    if (val.includes(owner)) {
      return String(a.getParameter("partstat") ?? "").toUpperCase() === "DECLINED";
    }
  }
  return false;
}

function hasConferenceLink(vevent: ICAL.Component, event: ICAL.Event): boolean {
  if (vevent.getFirstProperty("x-google-conference")) return true;
  const teams = String(vevent.getFirstPropertyValue("x-microsoft-skypeteamsmeetingurl") ?? "");
  const blob = [event.location, event.description, teams].filter(Boolean).join(" ").toLowerCase();
  return CONFERENCE_HOSTS.some((h) => blob.includes(h));
}

function isCancelled(vevent: ICAL.Component): boolean {
  const status = String(vevent.getFirstPropertyValue("status") ?? "").toUpperCase();
  return status === "CANCELLED";
}

/**
 * Parse ICS text into upcoming CalEvent occurrences within [now, now+windowMs].
 * Recurring events are expanded (RRULE), honoring EXDATE and RECURRENCE-ID overrides.
 * ownerEmail (best-effort) enables attendee-exclusion and declined detection.
 */
export function parseIcs(text: string, now: number, windowMs: number, ownerEmail?: string): CalEvent[] {
  const vcalendar = new ICAL.Component(ICAL.parse(text));
  registerTimezones(vcalendar);
  const calendarName = String(vcalendar.getFirstPropertyValue("x-wr-calname") ?? "");
  const windowEnd = now + windowMs;
  const out: CalEvent[] = [];

  for (const vevent of vcalendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);

    // C1: skip RECURRENCE-ID exception VEVENTs at top level — they are
    // absorbed by getOccurrenceDetails() when expanding the master.
    if (event.isRecurrenceException()) continue;

    // I2: skip cancelled master events
    if (isCancelled(vevent)) continue;

    if (event.isRecurring()) {
      const it = event.iterator();
      let next = it.next();
      let guard = 0;
      while (next && guard++ < 5000) {
        const startMs = next.toJSDate().getTime();
        if (startMs > windowEnd) break;
        const occ = event.getOccurrenceDetails(next); // honors RECURRENCE-ID overrides
        const endMs = occ.endDate.toJSDate().getTime();

        // C2 + I2: use the per-occurrence component for metadata so that an
        // overridden occurrence (RECURRENCE-ID) reflects its own attendees,
        // title, link, and declined status, not the master's snapshot.
        const occComp = occ.item.component;

        // I2: skip occurrences individually cancelled via a RECURRENCE-ID override
        if (isCancelled(occComp)) {
          next = it.next();
          continue;
        }

        if (endMs >= now) {
          const occEvent = occ.item; // ICAL.Event for this occurrence
          out.push({
            title: occEvent.summary ?? "(no title)",
            allDay: occ.startDate.isDate,
            calendarName,
            attendeeCount: attendeeCountExcludingOwner(occComp, ownerEmail),
            hasLink: hasConferenceLink(occComp, occEvent),
            declined: ownerDeclined(occComp, ownerEmail),
            start: occ.startDate.toJSDate().getTime(),
            end: endMs,
          });
        }
        next = it.next();
      }
    } else {
      const startMs = event.startDate.toJSDate().getTime();
      const endMs = event.endDate.toJSDate().getTime();
      if (startMs <= windowEnd && endMs >= now) {
        out.push({
          title: event.summary ?? "(no title)",
          allDay: event.startDate.isDate,
          calendarName,
          attendeeCount: attendeeCountExcludingOwner(vevent, ownerEmail),
          hasLink: hasConferenceLink(vevent, event),
          declined: ownerDeclined(vevent, ownerEmail),
          start: startMs,
          end: endMs,
        });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
