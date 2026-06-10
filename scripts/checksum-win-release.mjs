import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");
const checksumPath = path.join(releaseDir, "SHA256SUMS-win.txt");

function rel(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

const entries = await readdir(releaseDir, { withFileTypes: true }).catch(() => []);
const artifacts = entries
  .filter((entry) => entry.isFile() && /^Hermills-.+-setup\.exe$/i.test(entry.name))
  .map((entry) => path.join(releaseDir, entry.name))
  .sort();

if (artifacts.length === 0) {
  throw new Error("No Windows installer artifacts found under release/.");
}

const lines = [];
for (const artifact of artifacts) {
  lines.push(`${await sha256File(artifact)}  ${rel(artifact)}`);
}

await writeFile(checksumPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${rel(checksumPath)}.`);
