import { expect, test } from "vitest";
import { selectNextMeeting, type CalEvent, type MeetingFilters } from "./meeting";

const base: MeetingFilters = {
  attendeesOnly: false, hasLinkOnly: false, hideAllDay: true, excludeTitlePattern: "",
};

function ev(p: Partial<CalEvent>): CalEvent {
  return {
    title: "Meeting", start: 0, end: 0, allDay: false,
    calendarName: "Work", attendeeCount: 1, hasLink: true, declined: false, ...p,
  };
}

const NOW = 1_000_000;

test("picks the earliest future qualifying event", () => {
  const events = [ev({ start: NOW + 3000, end: NOW + 4000, title: "Later" }),
                  ev({ start: NOW + 1000, end: NOW + 2000, title: "Sooner" })];
  expect(selectNextMeeting(events, base, NOW)?.title).toBe("Sooner");
});

test("hides all-day events when hideAllDay is on", () => {
  expect(selectNextMeeting([ev({ start: NOW + 1000, allDay: true })], base, NOW)).toBeNull();
});

test("excludes declined events", () => {
  expect(selectNextMeeting([ev({ start: NOW + 1000, declined: true })], base, NOW)).toBeNull();
});

test("attendeesOnly drops solo holds", () => {
  const f = { ...base, attendeesOnly: true };
  expect(selectNextMeeting([ev({ start: NOW + 1000, attendeeCount: 0 })], f, NOW)).toBeNull();
});

test("hasLinkOnly drops events without a link", () => {
  const f = { ...base, hasLinkOnly: true };
  expect(selectNextMeeting([ev({ start: NOW + 1000, hasLink: false })], f, NOW)).toBeNull();
});

test("excludeTitlePattern drops matching titles (case-insensitive)", () => {
  const f = { ...base, excludeTitlePattern: "focus time" };
  expect(selectNextMeeting([ev({ start: NOW + 1000, title: "Focus Time" })], f, NOW)).toBeNull();
});

test("keeps a just-started meeting inside its grace window", () => {
  const events = [ev({ start: NOW - 1000, end: NOW + 60_000, title: "Now" })];
  expect(selectNextMeeting(events, base, NOW)?.title).toBe("Now");
});

test("drops a meeting past its grace window", () => {
  const events = [ev({ start: NOW - 60 * 60_000, end: NOW - 59 * 60_000 })];
  expect(selectNextMeeting(events, base, NOW)).toBeNull();
});

test("keeps a long meeting that is still ongoing (no 15-min cap)", () => {
  // Started 20m ago, ends in 40m: still going, so it stays selected (shows NOW).
  const events = [ev({ start: NOW - 20 * 60_000, end: NOW + 40 * 60_000, title: "Long" })];
  expect(selectNextMeeting(events, base, NOW)?.title).toBe("Long");
});

test("an imminent next meeting (within threshold) overrides an ongoing NOW", () => {
  const events = [
    ev({ start: NOW - 10 * 60_000, end: NOW + 20 * 60_000, title: "Ongoing" }),
    ev({ start: NOW + 3 * 60_000, end: NOW + 30 * 60_000, title: "Soon" }),
  ];
  // threshold 5m: the next meeting is 3m out, so it wins over the ongoing NOW.
  expect(selectNextMeeting(events, base, NOW, 5 * 60_000)?.title).toBe("Soon");
});

test("a non-imminent next meeting does NOT override an ongoing NOW", () => {
  const events = [
    ev({ start: NOW - 10 * 60_000, end: NOW + 20 * 60_000, title: "Ongoing" }),
    ev({ start: NOW + 30 * 60_000, end: NOW + 60 * 60_000, title: "Later" }),
  ];
  // threshold 5m: the next meeting is 30m out, so the ongoing meeting keeps NOW.
  expect(selectNextMeeting(events, base, NOW, 5 * 60_000)?.title).toBe("Ongoing");
});

test("with no override threshold, an ongoing meeting is preferred over a future one", () => {
  const events = [
    ev({ start: NOW - 10 * 60_000, end: NOW + 20 * 60_000, title: "Ongoing" }),
    ev({ start: NOW + 3 * 60_000, end: NOW + 30 * 60_000, title: "Soon" }),
  ];
  expect(selectNextMeeting(events, base, NOW)?.title).toBe("Ongoing");
});
