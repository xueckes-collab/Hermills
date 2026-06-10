import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const allowed = /\b(MIT|Apache-2\.0|BSD-2-Clause|BSD-3-Clause|ISC|MPL-2\.0|CC0-1\.0|0BSD|Python-2\.0|CC-BY-4\.0|BlueOak-1\.0\.0|WTFPL|OFL-1\.1)\b/i;
const denied = /\b(AGPL|GPL|LGPL|BSL|BUSL|Business Source|SSPL|Commons Clause)\b/i;
const failures = [];

function check(name, license) {
  if (String(name).startsWith("@hermills/") || String(name).includes("node_modules/@hermills/")) return;
  if (!license) {
    failures.push(`${name}: missing license`);
    return;
  }
  const value = Array.isArray(license) ? license.map((entry) => entry.type ?? entry).join(" OR ") : String(license);
  if (denied.test(value)) failures.push(`${name}: denied license ${value}`);
  else if (!allowed.test(value)) failures.push(`${name}: unknown license ${value}`);
}

function packagesFromNodeModules(dir) {
  const packageFiles = [];
  if (!existsSync(dir)) return packageFiles;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const entryPath = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      packageFiles.push(...packagesFromNodeModules(entryPath));
    } else {
      const packageJson = path.join(entryPath, "package.json");
      if (existsSync(packageJson)) packageFiles.push(packageJson);
    }
  }
  return packageFiles;
}

const lockPath = path.join(root, "package-lock.json");
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  for (const [location, meta] of Object.entries(lock.packages ?? {})) {
    if (location.includes("node_modules")) check(meta.name ?? location, meta.license);
  }
} else {
  for (const packageJson of packagesFromNodeModules(path.join(root, "node_modules"))) {
    const meta = JSON.parse(readFileSync(packageJson, "utf8"));
    check(meta.name ?? packageJson, meta.license ?? meta.licenses);
  }
}

if (failures.length > 0) {
  console.error("License audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("License audit passed.");
