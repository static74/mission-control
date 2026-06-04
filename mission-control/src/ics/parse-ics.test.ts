import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, beforeAll } from "vitest";
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
  expect(standups.length).toBeGreaterThan(3);   // FREQ=DAILY;COUNT=10
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
