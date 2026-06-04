import { expect, test } from "vitest";
import { ownerEmailFromUrl } from "./owner-email";

test("extracts the email from a Google secret iCal URL", () => {
  const url = "https://calendar.google.com/calendar/ical/jane%40acme.com/private-abc123/basic.ics";
  expect(ownerEmailFromUrl(url)).toBe("jane@acme.com");
});
test("returns undefined for a non-Google or opaque URL", () => {
  expect(ownerEmailFromUrl("https://example.com/feed.ics")).toBeUndefined();
});
test("returns undefined for empty input", () => {
  expect(ownerEmailFromUrl("")).toBeUndefined();
});
