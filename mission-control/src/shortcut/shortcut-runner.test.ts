import { expect, test, vi } from "vitest";
import { CliShortcutRunner } from "./shortcut-runner";

test("run() returns true and passes name+input when the shortcut exits 0", async () => {
  const exec = vi.fn().mockResolvedValue(undefined);
  const r = new CliShortcutRunner({ exec, platform: "darwin" });
  expect(await r.run("Meeting Mode", "meeting")).toBe(true);
  expect(exec).toHaveBeenCalledWith("Meeting Mode", "meeting");
});

test("run() returns false when the shortcut exits non-zero / throws", async () => {
  const exec = vi.fn().mockRejectedValue(new Error("shortcuts exited 1"));
  const r = new CliShortcutRunner({ exec, platform: "darwin" });
  expect(await r.run("Bad Name", "normal")).toBe(false);
});

test("run() is a no-op returning false on non-darwin", async () => {
  const exec = vi.fn();
  const r = new CliShortcutRunner({ exec, platform: "win32" });
  expect(await r.run("Meeting Mode", "meeting")).toBe(false);
  expect(exec).not.toHaveBeenCalled();
});
