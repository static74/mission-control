import { expect, test } from "vitest";
import { parseThresholdSeconds, DEFAULT_THRESHOLD_SECONDS, MAX_THRESHOLD_SECONDS } from "./threshold";

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
test("exposes a 30-minute max", () => {
  expect(MAX_THRESHOLD_SECONDS).toBe(1800);
});
test("accepts exactly 30:00", () => {
  expect(parseThresholdSeconds("30:00")).toBe(1800);
});
test("does not cap a value just under the max", () => {
  expect(parseThresholdSeconds("29:59")).toBe(29 * 60 + 59);
});
test("caps an over-max threshold at 30:00", () => {
  expect(parseThresholdSeconds("45:00")).toBe(1800);
});
test("caps the largest well-formed value at 30:00", () => {
  expect(parseThresholdSeconds("99:59")).toBe(1800);
});
