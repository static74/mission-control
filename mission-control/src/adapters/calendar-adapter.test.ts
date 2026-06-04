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

// I1: consecutive-failure escalation tests
test("two consecutive failures after a good read still return cached stale value", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(ICS_ONE)
    .mockRejectedValue(new Error("network"));
  const a = adapter(fetcher);
  await a.pollOnce(); // success
  await a.pollOnce(); // failure #1
  await a.pollOnce(); // failure #2
  const s = a.latest();
  expect(s.status).toBe("unavailable");
  expect(s.stale).toBe(true);
  expect(s.value?.[0].title).toBe("Standup"); // cached value still present
});

test("three consecutive failures return value:null (fault state)", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(ICS_ONE)
    .mockRejectedValue(new Error("network"));
  const a = adapter(fetcher);
  await a.pollOnce(); // success
  await a.pollOnce(); // failure #1
  await a.pollOnce(); // failure #2
  await a.pollOnce(); // failure #3 — escalate
  const s = a.latest();
  expect(s.status).toBe("unavailable");
  expect(s.value).toBeNull();
  expect(s.stale).toBe(false);
});

test("success after failures resets counter so the next single failure returns cached (not null)", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(ICS_ONE)   // success
    .mockRejectedValueOnce(new Error("network")) // failure #1
    .mockRejectedValueOnce(new Error("network")) // failure #2
    .mockRejectedValueOnce(new Error("network")) // failure #3 — would escalate
    .mockResolvedValueOnce(ICS_ONE)              // success — resets counter
    .mockRejectedValueOnce(new Error("network")); // failure #1 again — should still be cached
  const a = adapter(fetcher);
  await a.pollOnce(); // success
  await a.pollOnce(); // failure #1
  await a.pollOnce(); // failure #2
  await a.pollOnce(); // failure #3
  await a.pollOnce(); // success (resets)
  await a.pollOnce(); // failure #1 (fresh counter)
  const s = a.latest();
  expect(s.status).toBe("unavailable");
  expect(s.stale).toBe(true);
  expect(s.value?.[0].title).toBe("Standup"); // cached, not null
});
