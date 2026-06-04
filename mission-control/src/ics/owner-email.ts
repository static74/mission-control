/**
 * Best-effort: Google secret iCal URLs embed the calendar owner's email, e.g.
 * .../calendar/ical/<url-encoded-email>/private-<token>/basic.ics
 * Used only to improve attendee-exclusion and declined detection; undefined is fine.
 */
export function ownerEmailFromUrl(url: string): string | undefined {
  const m = url.match(/\/calendar\/ical\/([^/]+)\/private-/);
  if (!m) return undefined;
  const decoded = decodeURIComponent(m[1]);
  return decoded.includes("@") ? decoded : undefined;
}
