// Compiles helper/audio-switch.swift into the plugin bundle and ad-hoc signs it.
// Darwin-only; on other platforms it no-ops so cross-platform builds don't fail.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "helper", "audio-switch.swift");
const outDir = path.join(root, "com.static74.mission-control.sdPlugin", "bin");
const out = path.join(outDir, "audio-switch");

if (process.platform !== "darwin") {
  console.log("[build-helper] non-darwin platform; skipping audio-switch build");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
// -O optimized; host architecture. (Universal arm64+x86_64 can be added later via
// two compiles + lipo; the dev/target machine is Apple Silicon.)
execFileSync("swiftc", ["-O", "-o", out, src], { stdio: "inherit" });
execFileSync("codesign", ["-s", "-", "-f", out], { stdio: "inherit" });
console.log(`[build-helper] built ${out}`);
