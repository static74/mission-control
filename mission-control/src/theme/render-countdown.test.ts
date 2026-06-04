import { expect, test } from "vitest";
import { renderCountdown, type CountdownView } from "./render-countdown";
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
