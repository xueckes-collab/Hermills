import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");

if (path.basename(releaseDir) !== "release" || path.dirname(releaseDir) !== root) {
  throw new Error(`Refusing to remove unexpected release path: ${releaseDir}`);
}

await rm(releaseDir, { recursive: true, force: true });
console.log(`Removed ${path.relative(root, releaseDir)}.`);
