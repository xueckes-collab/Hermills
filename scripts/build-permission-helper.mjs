import { chmod, cp, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "packages", "runtime", "helpers", "macos-permission-helper.m");
const outputDir = path.join(root, "packages", "runtime", "dist", "helpers");
const output = path.join(outputDir, "hermills-permission-helper");

await mkdir(outputDir, { recursive: true });

if (process.platform !== "darwin") {
  await cp(source, path.join(outputDir, "macos-permission-helper.m"));
  process.exit(0);
}

const result = spawnSync("clang", [
  "-fobjc-arc",
  "-framework",
  "AppKit",
  "-framework",
  "ApplicationServices",
  "-framework",
  "CoreGraphics",
  "-framework",
  "Foundation",
  source,
  "-o",
  output
], { cwd: root, stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
await chmod(output, 0o755);
