import { expect, test, vi } from "vitest";
import { HelperAudioControl } from "./audio-switch";

test("current() parses one uid\\tname line", async () => {
  const run = vi.fn().mockResolvedValue("uid-dell\tDell U4924DW\n");
  const ctl = new HelperAudioControl({ run, platform: "darwin" });
  expect(await ctl.current()).toEqual({ uid: "uid-dell", name: "Dell U4924DW" });
  expect(run).toHaveBeenCalledWith(["get"]);
});

test("current() returns null and does not spawn on non-darwin", async () => {
  const run = vi.fn();
  const ctl = new HelperAudioControl({ run, platform: "win32" });
  expect(await ctl.current()).toBeNull();
  expect(run).not.toHaveBeenCalled();
});

test("current() returns null when the helper throws", async () => {
  const run = vi.fn().mockRejectedValue(new Error("ENOENT"));
  const ctl = new HelperAudioControl({ run, platform: "darwin" });
  expect(await ctl.current()).toBeNull();
});

test("setOutput() passes the target and returns the read-back device", async () => {
  const run = vi.fn().mockResolvedValue("uid-dell\tDell U4924DW\n");
  const ctl = new HelperAudioControl({ run, platform: "darwin" });
  expect(await ctl.setOutput("uid-dell")).toEqual({ uid: "uid-dell", name: "Dell U4924DW" });
  expect(run).toHaveBeenCalledWith(["set", "uid-dell"]);
});

test("list() parses multiple lines and ignores blanks", async () => {
  const run = vi.fn().mockResolvedValue("uid-bench\tBenchmark 1.0\nuid-dell\tDell U4924DW\n\n");
  const ctl = new HelperAudioControl({ run, platform: "darwin" });
  expect(await ctl.list()).toEqual([
    { uid: "uid-bench", name: "Benchmark 1.0" },
    { uid: "uid-dell", name: "Dell U4924DW" },
  ]);
});
