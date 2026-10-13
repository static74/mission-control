import { spawn } from "node:child_process";

/** The seam over the macOS `shortcuts` CLI. Injectable; mac-only at runtime. */
export interface ShortcutRunner {
  run(name: string, input: string): Promise<boolean>; // true iff the shortcut exited 0
}

export interface ShortcutDeps {
  exec?: (name: string, input: string) => Promise<void>; // rejects on non-zero exit
  platform?: NodeJS.Platform; // injectable for tests
}

/** Long enough to answer the Quick Config menu; a timeout still counts as a failed run. */
export const SHORTCUT_TIMEOUT_MS = 120_000;

/**
 * Run `shortcuts run <name>`, writing `input` to stdin. Apple's CLI delivers piped
 * stdin as the shortcut's TEXT input (--input-path is for files), so the shortcut
 * receives one of `meeting`, `normal`, `reset meeting`, `reset normal` as its Shortcut
 * Input. Rejects on non-zero exit or error.
 */
function defaultExec(name: string, input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("shortcuts", ["run", name], { timeout: SHORTCUT_TIMEOUT_MS });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`shortcuts exited ${code}`)),
    );
    child.stdin.end(input);
  });
}

export class CliShortcutRunner implements ShortcutRunner {
  private readonly exec: (name: string, input: string) => Promise<void>;
  private readonly platform: NodeJS.Platform;

  constructor(deps: ShortcutDeps = {}) {
    this.exec = deps.exec ?? defaultExec;
    this.platform = deps.platform ?? process.platform;
  }

  async run(name: string, input: string): Promise<boolean> {
    if (this.platform !== "darwin") return false;
    try {
      await this.exec(name, input);
      return true;
    } catch {
      return false;
    }
  }
}
