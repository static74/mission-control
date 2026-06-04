import { expect, test, vi } from "vitest";
import { CalendarAdapter } from "./calendar-adapter";

const ICS_ONE = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:Work",
  "BEGIN:VEVENT", "UID:a", "SUMMARY:Standup",
  "DTSTART:20300115T100000Z", "DTEND:20300115T103000Z",
  "ATTENDEE:mailto:other@example.com", "END:VEVENT", "END:VCALENDAR",
].join("\r\n");

const NOW = Date.UTC(2030, 0, 1);

function adapter(fetcher: () => Promise<string>) {
  // (text fetcher, no url-resolution; clock fixed; long window)
  return new CalendarAdapter("https://feed/x.ics", { fetchText: fetcher, now: () => NOW, windowMs: 40 * 24 * 60 * 60 * 1000 });
}

test("successful fetch -> ok snapshot with parsed events", async () => {
  const a = adapter(vi.fn().mockResolvedValue(ICS_ONE));
  await a.pollOnce();
  const s = a.latest();
  expect(s.status).toBe("ok");
  expect(s.value?.[0].title).toBe("Standup");
  expect(s.stale).toBe(false);
});

test("empty url -> no-config", async () => {
  const a = new CalendarAdapter("", { fetchText: vi.fn(), now: () => NOW });
  await a.pollOnce();
  expect(a.latest().status).toBe("no-config");
  expect(a.latest().value).toBeNull();
});

test("fetch rejects -> unavailable", async () => {
  const a = adapter(vi.fn().mockRejectedValue(new Error("network")));
  await a.pollOnce();
  expect(a.latest().status).toBe("unavailable");
});

test("after a good read, a failed read returns the cached value flagged stale", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(ICS_ONE)
    .mockRejectedValueOnce(new Error("network"));
  const a = adapter(fetcher);
  await a.pollOnce();
  await a.pollOnce();
  const s = a.latest();
  expect(s.value?.[0].title).toBe("Standup"); // cached
  expect(s.stale).toBe(true);
  expect(s.status).toBe("unavailable");
});

test("onChange fires after a poll", async () => {
  const a = adapter(vi.fn().mockResolvedValue(ICS_ONE));
  const cb = vi.fn();
  a.onChange(cb);
  await a.pollOnce();
  expect(cb).toHaveBeenCalledOnce();
});
