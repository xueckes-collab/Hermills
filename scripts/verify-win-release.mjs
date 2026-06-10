import { existsSync } from "node:fs";
import { access, readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const notes = [];

function rel(filePath) {
  return path.relative(root, filePath) || ".";
}

function indent(value) {
  return String(value)
    .split("\n")
    .filter(Boolean)
    .map((line) => `  ${line}`)
    .join("\n");
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(dir, predicate) {
  const files = [];
  if (!(await pathExists(dir))) return files;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(entryPath, predicate));
    else if (!predicate || predicate(entryPath)) files.push(entryPath);
  }
  return files;
}

function stripQueryAndHash(reference) {
  return reference.split(/[?#]/, 1)[0];
}

function isRemoteReference(reference) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(reference);
}

function normalizeAsarEntry(entry) {
  return entry.replace(/^[/\\]/, "").replace(/\\/g, "/");
}

function asarExtractPath(entry) {
  return entry.replace(/\//g, path.sep);
}

async function checkIcon() {
  const iconPath = path.join(root, "build", "icon.ico");
  if (!(await pathExists(iconPath))) {
    failures.push("[icon] Missing build/icon.ico. Run npm run build:icon:win before packaging.");
    return;
  }
  const iconStat = await stat(iconPath);
  if (iconStat.size === 0) failures.push("[icon] build/icon.ico must not be empty.");
  else notes.push(`[icon] Found ${rel(iconPath)} (${iconStat.size} bytes).`);
}

async function checkRendererAssets() {
  const distDir = path.join(root, "apps", "renderer", "dist");
  const indexPath = path.join(distDir, "index.html");
  if (!(await pathExists(indexPath))) {
    failures.push(`[renderer] Missing ${rel(indexPath)}. Run npm run build before packaging.`);
    return;
  }

  const indexHtml = await readFile(indexPath, "utf8");
  const assetReferences = [...indexHtml.matchAll(/\b(?:src|href)=["']([^"']*assets\/[^"']*)["']/gi)].map((match) => match[1]);
  if (assetReferences.length === 0) {
    failures.push(`[renderer] ${rel(indexPath)} does not reference built assets.`);
    return;
  }

  const badReferences = assetReferences.filter((reference) => reference.startsWith("/") || isRemoteReference(reference));
  if (badReferences.length > 0) {
    failures.push([
      `[renderer] ${rel(indexPath)} must use relative assets for packaged file:// loading.`,
      indent(badReferences.map((reference) => `- ${reference}`).join("\n"))
    ].join("\n"));
  }

  const missing = [];
  for (const reference of assetReferences) {
    if (reference.startsWith("/") || isRemoteReference(reference)) continue;
    const targetPath = path.resolve(distDir, stripQueryAndHash(reference).replace(/^\.\//, ""));
    if (!targetPath.startsWith(`${distDir}${path.sep}`) || !existsSync(targetPath)) missing.push(`${reference} -> ${rel(targetPath)}`);
  }
  if (missing.length > 0) {
    failures.push(`[renderer] Missing referenced assets:\n${indent(missing.map((reference) => `- ${reference}`).join("\n"))}`);
  } else {
    notes.push(`[renderer] Checked ${assetReferences.length} relative asset references.`);
  }
}

async function checkReleaseArtifacts() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const releaseDir = path.join(root, "release");
  const expectedInstaller = path.join(releaseDir, `Hermills-${packageJson.version}-x64-setup.exe`);
  if (!(await pathExists(expectedInstaller))) {
    const exes = await collectFiles(releaseDir, (filePath) => /\.exe$/i.test(filePath));
    failures.push([
      `[release] Missing expected installer ${rel(expectedInstaller)}.`,
      exes.length ? `Found:\n${indent(exes.map((file) => `- ${rel(file)}`).join("\n"))}` : "No .exe files found under release/."
    ].join("\n"));
    return;
  }
  const installerStat = await stat(expectedInstaller);
  if (installerStat.size === 0) failures.push(`[release] Installer is empty: ${rel(expectedInstaller)}.`);
  else notes.push(`[release] Found ${rel(expectedInstaller)} (${installerStat.size} bytes).`);
}

async function checkPackagedAsar() {
  const asarPath = path.join(root, "release", "win-unpacked", "resources", "app.asar");
  if (!(await pathExists(asarPath))) {
    failures.push(`[asar] Missing ${rel(asarPath)}. The Windows build should include win-unpacked/resources/app.asar.`);
    return;
  }

  const requiredFiles = [
    "apps/desktop/main.cjs",
    "apps/desktop/preload.cjs",
    "apps/server/dist/index.js",
    "apps/renderer/dist/index.html",
    "node_modules/@hermills/core/package.json",
    "node_modules/@hermills/core/dist/index.js",
    "node_modules/@hermills/agent-builder/package.json",
    "node_modules/@hermills/agent-builder/dist/index.js",
    "node_modules/@hermills/runtime/package.json",
    "node_modules/@hermills/runtime/dist/index.js"
  ];
  const listedFiles = new Set(asar.listPackage(asarPath).map(normalizeAsarEntry));
  const missing = requiredFiles.filter((entry) => !listedFiles.has(entry));
  if (missing.length > 0) {
    failures.push(`[asar] ${rel(asarPath)} is missing required app files:\n${indent(missing.map((entry) => `- ${entry}`).join("\n"))}`);
    return;
  }

  const packagedIndex = asar.extractFile(asarPath, asarExtractPath("apps/renderer/dist/index.html")).toString("utf8");
  const references = [...packagedIndex.matchAll(/\b(?:src|href)=["']([^"']*assets\/[^"']*)["']/gi)].map((match) => match[1]);
  const missingAssets = [];
  for (const reference of references) {
    if (reference.startsWith("/") || isRemoteReference(reference)) continue;
    const packagedPath = `apps/renderer/dist/${stripQueryAndHash(reference).replace(/^\.\//, "")}`;
    if (!listedFiles.has(packagedPath)) missingAssets.push(`${reference} -> ${packagedPath}`);
  }
  if (missingAssets.length > 0) {
    failures.push(`[asar] Packaged renderer assets are missing:\n${indent(missingAssets.map((entry) => `- ${entry}`).join("\n"))}`);
  } else {
    notes.push(`[asar] Checked packaged desktop, server, renderer, and workspace modules in ${rel(asarPath)}.`);
  }
}

async function main() {
  console.log("Hermills Windows release verification");
  console.log(`Root: ${root}`);
  await checkIcon();
  await checkRendererAssets();
  await checkReleaseArtifacts();
  await checkPackagedAsar();

  for (const note of notes) console.log(`INFO ${note}`);
  if (failures.length > 0) {
    console.error("\nWindows release verification failed:");
    for (const failure of failures) console.error(`\n${failure}`);
    process.exit(1);
  }
  console.log("\nWindows release verification passed.");
}

main().catch((error) => {
  console.error("Windows release verification crashed:");
  console.error(error);
  process.exit(1);
});
