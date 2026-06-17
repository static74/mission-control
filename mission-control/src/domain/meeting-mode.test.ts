import { expect, test } from "vitest";
import { isMeetingMode, nextOutputTarget, webhookForTransition } from "./meeting-mode";

const dell = { uid: "uid-dell", name: "Dell U4924DW" };
const bench = { uid: "uid-bench", name: "Benchmark 1.0" };

test("not in meeting mode when the current device is unknown", () => {
  expect(isMeetingMode(null, "uid-dell")).toBe(false);
});
test("meeting mode matches on uid", () => {
  expect(isMeetingMode(dell, "uid-dell")).toBe(true);
});
test("meeting mode also matches on name (provisional defaults are names)", () => {
  expect(isMeetingMode(dell, "Dell U4924DW")).toBe(true);
});
test("not in meeting mode on a different device", () => {
  expect(isMeetingMode(bench, "uid-dell")).toBe(false);
});
test("toggle target: from meeting device go to normal", () => {
  expect(nextOutputTarget(dell, "Benchmark 1.0", "Dell U4924DW")).toBe("Benchmark 1.0");
});
test("toggle target: from normal device go to meeting", () => {
  expect(nextOutputTarget(bench, "Benchmark 1.0", "Dell U4924DW")).toBe("Dell U4924DW");
});
test("toggle target: unknown current defaults to the meeting device", () => {
  expect(nextOutputTarget(null, "Benchmark 1.0", "Dell U4924DW")).toBe("Dell U4924DW");
});

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
