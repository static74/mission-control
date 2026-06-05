import { expect, test } from "vitest";
import { renderCountdown, wrapTitle, type CountdownView } from "./render-countdown";
import { THEME } from "./mission-theme";

function view(p: Partial<CountdownView>): CountdownView {
  return { state: "cruise", title: "Standup", big: "T- 1:24", ...p };
}

test("returns an svg string", () => {
  expect(renderCountdown(view({}))).toMatch(/^<svg[\s>]/);
});
test("cruise shows the title and ice-blue readout", () => {
  const svg = renderCountdown(view({ state: "cruise", title: "Standup", big: "T- 1:24" }));
  expect(svg).toContain("Standup");
  expect(svg).toContain("T- 1:24");
  expect(svg).toContain(THEME.ice);
});
test("terminal phase 0 uses amber, phase 1 uses red", () => {
  expect(renderCountdown(view({ state: "terminal", big: "04:59", pulsePhase: 0 }))).toContain(THEME.amber);
  expect(renderCountdown(view({ state: "terminal", big: "04:59", pulsePhase: 1 }))).toContain(THEME.red);
});
test("idle shows CLEAR on the space base", () => {
  const svg = renderCountdown(view({ state: "idle", title: "", big: "CLEAR" }));
  expect(svg).toContain("CLEAR");
  expect(svg).toContain(THEME.space);
});
test("liftoff shows NOW in red", () => {
  const svg = renderCountdown(view({ state: "liftoff", title: "Standup", big: "NOW" }));
  expect(svg).toContain("NOW");
  expect(svg).toContain(THEME.red);
});

// --- title wrapping: two lines + ellipsis ---

test("wrapTitle keeps a short title on one line", () => {
  expect(wrapTitle("Lunch", 11, 2)).toEqual(["Lunch"]);
});
test("wrapTitle wraps a medium title on a word boundary", () => {
  expect(wrapTitle("Daily Standup", 11, 2)).toEqual(["Daily", "Standup"]);
});
test("wrapTitle caps an over-long title at two lines and ellipsizes the last", () => {
  const out = wrapTitle("Weekly Engineering Sync", 11, 2);
  expect(out.length).toBe(2);
  expect(out[1].endsWith("…")).toBe(true);
});
test("wrapTitle hard-breaks a single word longer than the line width", () => {
  const out = wrapTitle("Supercalifragilistic", 11, 2);
  expect(out[0].length).toBeLessThanOrEqual(11);
  expect(out.length).toBeLessThanOrEqual(2);
});
test("wrapTitle counts an emoji as one unit and never splits its surrogate pair", () => {
  // "🚀" is an astral code point (two UTF-16 code units); a naive width-1 slice
  // would corrupt it. wrapTitle must treat it as a single character.
  expect(wrapTitle("🚀", 1, 2)).toEqual(["🚀"]);
});

test("renderCountdown draws a long title across two text lines", () => {
  const svg = renderCountdown(view({ title: "Weekly Engineering Sync" }));
  const textCount = (svg.match(/<text/g) ?? []).length;
  expect(textCount).toBe(3); // two title lines + the big readout
});
test("renderCountdown draws a short title as a single line", () => {
  const svg = renderCountdown(view({ title: "Lunch" }));
  const textCount = (svg.match(/<text/g) ?? []).length;
  expect(textCount).toBe(2); // one title line + the big readout
});
