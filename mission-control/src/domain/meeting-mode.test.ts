import { expect, test } from "vitest";
import { webhookForTransition, targetFor } from "./meeting-mode";

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
