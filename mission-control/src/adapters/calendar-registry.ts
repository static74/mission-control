import { CalendarAdapter } from "./calendar-adapter";

// One shared, started adapter per distinct feed URL, so multiple keys pointing at the
// same calendar share one poll loop and one cache.
const registry = new Map<string, CalendarAdapter>();

export function getCalendarAdapter(url: string): CalendarAdapter {
  let adapter = registry.get(url);
  if (!adapter) {
    adapter = new CalendarAdapter(url);
    adapter.start();
    registry.set(url, adapter);
  }
  return adapter;
}
