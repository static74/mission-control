import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AudioControl, AudioOutput } from "./types";

const execFileAsync = promisify(execFile);

/** The bundled binary sits next to the built plugin.js in the bundle's bin/ dir. */
function helperPath(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "audio-switch");
}

async function defaultRun(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(helperPath(), args, { timeout: 5000 });
  return stdout;
}

function parseLine(line: string): AudioOutput | null {
  const t = line.trim();
  const tab = t.indexOf("\t");
  if (tab < 0) return null;
  return { uid: t.slice(0, tab), name: t.slice(tab + 1) };
}

export interface HelperDeps {
  run?: (args: string[]) => Promise<string>; // injectable for tests
  platform?: NodeJS.Platform; // injectable for tests
}

export class HelperAudioControl implements AudioControl {
  private readonly run: (args: string[]) => Promise<string>;
  private readonly platform: NodeJS.Platform;

  constructor(deps: HelperDeps = {}) {
    this.run = deps.run ?? defaultRun;
    this.platform = deps.platform ?? process.platform;
  }

  async current(): Promise<AudioOutput | null> {
    if (this.platform !== "darwin") return null;
    try {
      return parseLine(await this.run(["get"]));
    } catch {
      return null;
    }
  }

  async setOutput(target: string): Promise<AudioOutput | null> {
    if (this.platform !== "darwin") return null;
    try {
      return parseLine(await this.run(["set", target]));
    } catch {
      return null;
    }
  }

  async list(): Promise<AudioOutput[]> {
    if (this.platform !== "darwin") return [];
    try {
      const out = await this.run(["list"]);
      return out
        .split("\n")
        .map(parseLine)
        .filter((d): d is AudioOutput => d !== null);
    } catch {
      return [];
    }
  }
}
