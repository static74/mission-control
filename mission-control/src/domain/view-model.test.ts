import { expect, test } from "vitest";
import { buildBig, ringFraction } from "./view-model";

const MIN = 60_000;
const NOW = 10_000_000;

test("cruise readout is T- H:MM for hours", () => {
  expect(buildBig("cruise", NOW, { start: NOW + 84 * MIN, end: NOW + 120 * MIN })).toBe("T- 1:24");
});
test("cruise readout is T- Mm for sub-hour", () => {
  expect(buildBig("cruise", NOW, { start: NOW + 42 * MIN, end: NOW + 60 * MIN })).toBe("T- 42m");
});
test("terminal readout is MM:SS", () => {
  expect(buildBig("terminal", NOW, { start: NOW + 4 * MIN + 9_000, end: NOW + 30 * MIN })).toBe("04:09");
});
test("liftoff readout is NOW", () => {
  expect(buildBig("liftoff", NOW, { start: NOW - 1000, end: NOW + MIN })).toBe("NOW");
});
test("idle readout is CLEAR", () => {
  expect(buildBig("idle", NOW, null)).toBe("CLEAR");
});
test("ring fraction is ~1 far out and small near threshold", () => {
  expect(ringFraction(NOW, { start: NOW + 60 * MIN, end: NOW + 90 * MIN })).toBeCloseTo(1, 1);
  expect(ringFraction(NOW, { start: NOW + 6 * MIN, end: NOW + 36 * MIN })).toBeLessThan(0.2);
});
