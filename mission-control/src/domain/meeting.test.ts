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
