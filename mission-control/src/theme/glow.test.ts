import { expect, test } from "vitest";
import { glowColor } from "./glow";
import { THEME } from "./mission-theme";

test("no glow when meeting mode is off", () => {
  expect(glowColor("cruise", false)).toBeNull();
  expect(glowColor("terminal", false)).toBeNull();
});
test("base yellow glow on the calm states when on", () => {
  expect(glowColor("idle", true)).toBe(THEME.meetingGlow);
  expect(glowColor("cruise", true)).toBe(THEME.meetingGlow);
});
test("swaps to white during terminal and liftoff so it survives amber/red", () => {
  expect(glowColor("terminal", true)).toBe(THEME.white);
  expect(glowColor("liftoff", true)).toBe(THEME.white);
});
