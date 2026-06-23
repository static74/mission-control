import { expect, test } from "vitest";
import { pickState } from "./countdown-state";

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = 10_000_000;
const threshold = 5 * MIN; // thresholdMs: terminal window in milliseconds

test("null meeting is idle", () => {
  expect(pickState(NOW, null, threshold)).toBe("idle");
});
test("more than 12 hours away is idle — countdown has not begun yet", () => {
  expect(pickState(NOW, { start: NOW + 13 * HOUR, end: NOW + 14 * HOUR }, threshold)).toBe("idle");
});
test("inside 12 hours is cruise", () => {
  expect(pickState(NOW, { start: NOW + 11 * HOUR, end: NOW + 12 * HOUR }, threshold)).toBe("cruise");
});
test("more than threshold away is cruise", () => {
  expect(pickState(NOW, { start: NOW + 6 * MIN, end: NOW + 36 * MIN }, threshold)).toBe("cruise");
});
test("exactly at threshold is terminal", () => {
  expect(pickState(NOW, { start: NOW + 5 * MIN, end: NOW + 35 * MIN }, threshold)).toBe("terminal");
});
test("inside five minutes is terminal", () => {
  expect(pickState(NOW, { start: NOW + 90_000, end: NOW + 30 * MIN }, threshold)).toBe("terminal");
});
test("just started is liftoff", () => {
  expect(pickState(NOW, { start: NOW - 1000, end: NOW + 30 * MIN }, threshold)).toBe("liftoff");
});
test("an ongoing meeting (started, not yet ended) is liftoff", () => {
  // NOW shows for the whole meeting now — until it actually ends, no 15-min cap.
  expect(pickState(NOW, { start: NOW - 20 * MIN, end: NOW + 10 * MIN }, threshold)).toBe("liftoff");
});
test("past the meeting's end is idle", () => {
  expect(pickState(NOW, { start: NOW - 40 * MIN, end: NOW - 10 * MIN }, threshold)).toBe("idle");
});
