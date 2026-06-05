import { expect, test } from "vitest";
import { parseThresholdSeconds, DEFAULT_THRESHOLD_SECONDS } from "./threshold";

test("parses MM:SS into seconds", () => {
  expect(parseThresholdSeconds("05:00")).toBe(300);
});
test("parses single-digit minutes", () => {
  expect(parseThresholdSeconds("5:00")).toBe(300);
});
test("parses minutes and seconds", () => {
  expect(parseThresholdSeconds("04:30")).toBe(270);
});
test("trims surrounding whitespace", () => {
  expect(parseThresholdSeconds("  2:15 ")).toBe(135);
});
test("accepts 00:00", () => {
  expect(parseThresholdSeconds("00:00")).toBe(0);
});
test("rejects seconds >= 60", () => {
  expect(parseThresholdSeconds("04:60")).toBeNull();
});
test("rejects a single-digit seconds field", () => {
  expect(parseThresholdSeconds("4:5")).toBeNull();
});
test("rejects a missing colon", () => {
  expect(parseThresholdSeconds("500")).toBeNull();
});
test("rejects non-numeric input", () => {
  expect(parseThresholdSeconds("abc")).toBeNull();
});
test("rejects an empty string", () => {
  expect(parseThresholdSeconds("")).toBeNull();
});
test("exposes a 5-minute default", () => {
  expect(DEFAULT_THRESHOLD_SECONDS).toBe(300);
});
