import { expect, test } from "vitest";
import { webhookForTransition, targetFor, isLongPress, inputFor, LONG_PRESS_MS } from "./meeting-mode";

const HA_MEETING = "http://homeassistant.local:8123/api/webhook/meeting";
const HA_CLEAR = "http://homeassistant.local:8123/api/webhook/no-meeting";

test("webhook: entering meeting mode fires the meeting-mode webhook", () => {
  expect(webhookForTransition(false, true, HA_MEETING, HA_CLEAR)).toBe(HA_MEETING);
});
test("webhook: leaving meeting mode fires the no-meeting webhook", () => {
  expect(webhookForTransition(true, false, HA_MEETING, HA_CLEAR)).toBe(HA_CLEAR);
});
test("webhook: no transition fires nothing", () => {
  expect(webhookForTransition(true, true, HA_MEETING, HA_CLEAR)).toBeNull();
  expect(webhookForTransition(false, false, HA_MEETING, HA_CLEAR)).toBeNull();
});
test("webhook: a blank relevant URL fires nothing (trimmed)", () => {
  expect(webhookForTransition(false, true, "   ", HA_CLEAR)).toBeNull();
  expect(webhookForTransition(true, false, HA_MEETING, "")).toBeNull();
});

test("targetFor: entering meeting mode yields 'meeting'", () => {
  expect(targetFor(true)).toBe("meeting");
});
test("targetFor: leaving meeting mode yields 'normal'", () => {
  expect(targetFor(false)).toBe("normal");
});

test("isLongPress: the threshold is 600 ms", () => {
  expect(LONG_PRESS_MS).toBe(600);
});
test("isLongPress: a press held under 600 ms is short", () => {
  expect(isLongPress(0)).toBe(false);
  expect(isLongPress(599)).toBe(false);
});
test("isLongPress: a press held 600 ms or longer is long", () => {
  expect(isLongPress(600)).toBe(true);
  expect(isLongPress(5_000)).toBe(true);
});

test("inputFor: a short press targets the mode being entered", () => {
  expect(inputFor(false, false)).toBe("meeting");
  expect(inputFor(false, true)).toBe("normal");
});
test("inputFor: a long press resets the CURRENT mode, not the toggled one", () => {
  expect(inputFor(true, true)).toBe("reset meeting");
  expect(inputFor(true, false)).toBe("reset normal");
});
