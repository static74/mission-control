import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { parseIcs } from "./parse-ics";

const ics = readFileSync(fileURLToPath(new URL("../../test/fixtures/sample.ics", import.meta.url)), "utf8");

// Window: the whole of 2030 (the fixture lives in Jan 2030).
const NOW = Date.UTC(2030, 0, 1);              // 2030-01-01T00:00:00Z
const WINDOW = 40 * 24 * 60 * 60 * 1000;        // 40 days

test("parses the timed event with title, attendees (excl. owner), and link", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const sync = events.find((e) => e.title === "Project Sync");
  expect(sync).toBeTruthy();
  expect(sync!.attendeeCount).toBe(1);   // 'other', owner excluded
  expect(sync!.hasLink).toBe(true);      // X-GOOGLE-CONFERENCE
  expect(sync!.allDay).toBe(false);
  expect(sync!.calendarName).toBe("Work");
});

test("marks the all-day event", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const holiday = events.find((e) => e.title === "Company Holiday");
  expect(holiday?.allDay).toBe(true);
});

test("detects the owner's declined status", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const review = events.find((e) => e.title === "Optional Review");
  expect(review?.declined).toBe(true);
});

test("expands the recurring standup into multiple occurrences within the window", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const standups = events.filter((e) => e.title === "Daily Standup");
  expect(standups.length).toBeGreaterThan(3);   // FREQ=DAILY;COUNT=10 minus EXDATE
  expect(standups.length).toBeLessThanOrEqual(10);
  // occurrences are distinct, ascending
  const starts = standups.map((e) => e.start);
  expect([...starts].sort((a, b) => a - b)).toEqual(starts);
});

test("output is sorted ascending by start", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const starts = events.map((e) => e.start);
  expect([...starts].sort((a, b) => a - b)).toEqual(starts);
});

// I3: RECURRENCE-ID override with DECLINED owner
test("RECURRENCE-ID override occurrence has declined:true when owner PARTSTAT=DECLINED", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const standups = events.filter((e) => e.title === "Daily Standup");

  // Jan 5 occurrence (America/Los_Angeles 09:00 = UTC 17:00) is overridden with owner DECLINED
  const jan5StartUtc = Date.UTC(2030, 0, 5, 17, 0, 0); // 2030-01-05T17:00:00Z (PST = UTC-8)
  const jan5 = standups.find((e) => e.start === jan5StartUtc);
  expect(jan5).toBeTruthy();
  expect(jan5!.declined).toBe(true);
});

test("sibling standup occurrences (non-overridden) have declined:false", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const standups = events.filter((e) => e.title === "Daily Standup");
  const jan5StartUtc = Date.UTC(2030, 0, 5, 17, 0, 0);
  const siblings = standups.filter((e) => e.start !== jan5StartUtc);
  expect(siblings.length).toBeGreaterThan(0);
  for (const s of siblings) {
    expect(s.declined).toBe(false);
  }
});

test("each standup occurrence start is unique (no RECURRENCE-ID duplicates)", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const standups = events.filter((e) => e.title === "Daily Standup");
  const starts = standups.map((e) => e.start);
  const unique = new Set(starts);
  expect(unique.size).toBe(starts.length);
});

// I3: EXDATE removes the Jan 3 occurrence
test("EXDATE removes the excluded standup occurrence", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const standups = events.filter((e) => e.title === "Daily Standup");
  const jan3StartUtc = Date.UTC(2030, 0, 3, 17, 0, 0); // 2030-01-03T17:00:00Z (PST = UTC-8)
  const jan3 = standups.find((e) => e.start === jan3StartUtc);
  expect(jan3).toBeUndefined();
});

// I2: STATUS:CANCELLED event must not appear in output
test("CANCELLED events are not emitted", () => {
  const events = parseIcs(ics, NOW, WINDOW, "owner@example.com");
  const cancelled = events.find((e) => e.title === "Cancelled Meeting");
  expect(cancelled).toBeUndefined();
});
