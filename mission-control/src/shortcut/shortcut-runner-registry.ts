import { CliShortcutRunner } from "./shortcut-runner";
import type { ShortcutRunner } from "./shortcut-runner";

// One shared instance, mirroring audio-control-registry / calendar-registry.
let shared: ShortcutRunner | undefined;

export function getShortcutRunner(): ShortcutRunner {
  return (shared ??= new CliShortcutRunner());
}
