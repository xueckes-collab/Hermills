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

async function checkAutoUpdateMetadata() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const releaseDir = path.join(root, "release");
  const installerName = `Hermills-${packageJson.version}-x64-setup.exe`;
  const latestPath = path.join(releaseDir, "latest.yml");
  const blockmapPath = path.join(releaseDir, `${installerName}.blockmap`);
  const appUpdateConfigPath = path.join(root, "release", "win-unpacked", "resources", "app-update.yml");

  if (!(await pathExists(latestPath))) {
    failures.push("[updates] Missing release/latest.yml. Windows auto-update needs this metadata next to the installer asset.");
  } else {
    const latestYml = await readFile(latestPath, "utf8");
    const latestStat = await stat(latestPath);
    const requiredSnippets = [
      `version: ${packageJson.version}`,
      `url: ${installerName}`,
      `path: ${installerName}`,
      "sha512:"
    ];
    const missingSnippets = requiredSnippets.filter((snippet) => !latestYml.includes(snippet));
    if (latestStat.size === 0) failures.push(`[updates] ${rel(latestPath)} must not be empty.`);
    if (missingSnippets.length > 0) {
      failures.push(`[updates] ${rel(latestPath)} is missing required fields:\n${indent(missingSnippets.map((snippet) => `- ${snippet}`).join("\n"))}`);
    }
    if (latestStat.size > 0 && missingSnippets.length === 0) notes.push(`[updates] Checked ${rel(latestPath)} for Windows update metadata.`);
  }

  if (!(await pathExists(blockmapPath))) {
    failures.push(`[updates] Missing ${rel(blockmapPath)}. Upload the blockmap with the installer for differential auto-updates.`);
  } else {
    const blockmapStat = await stat(blockmapPath);
    if (blockmapStat.size === 0) failures.push(`[updates] ${rel(blockmapPath)} must not be empty.`);
    else notes.push(`[updates] Found ${rel(blockmapPath)} (${blockmapStat.size} bytes).`);
  }

  if (!(await pathExists(appUpdateConfigPath))) {
    failures.push("[updates] Missing packaged app-update.yml. electron-updater needs a provider config in the installed app.");
  } else {
    const appUpdateConfig = await readFile(appUpdateConfigPath, "utf8");
    const requiredSnippets = ["provider: github", "owner: xueckes-collab", "repo: Hermills"];
    const missingSnippets = requiredSnippets.filter((snippet) => !appUpdateConfig.includes(snippet));
    if (missingSnippets.length > 0) {
      failures.push(`[updates] ${rel(appUpdateConfigPath)} is missing GitHub provider fields:\n${indent(missingSnippets.map((snippet) => `- ${snippet}`).join("\n"))}`);
    } else {
      notes.push(`[updates] Checked packaged GitHub provider config in ${rel(appUpdateConfigPath)}.`);
    }
  }
}

async function checkTrayResources() {
  const trayDir = path.join(root, "release", "win-unpacked", "resources", "build");
  const requiredIcons = ["icon.ico", "icon.png"];
  const missing = [];
  const empty = [];
  for (const iconName of requiredIcons) {
    const iconPath = path.join(trayDir, iconName);
    if (!(await pathExists(iconPath))) {
      missing.push(rel(iconPath));
      continue;
    }
    const iconStat = await stat(iconPath);
    if (iconStat.size === 0) empty.push(rel(iconPath));
  }
  if (missing.length > 0) failures.push(`[tray] Missing packaged tray resources:\n${indent(missing.map((file) => `- ${file}`).join("\n"))}`);
  if (empty.length > 0) failures.push(`[tray] Empty packaged tray resources:\n${indent(empty.map((file) => `- ${file}`).join("\n"))}`);
  if (missing.length === 0 && empty.length === 0) notes.push(`[tray] Checked packaged tray icons in ${rel(trayDir)}.`);
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
    "node_modules/electron-updater/out/main.js",
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
  await checkAutoUpdateMetadata();
  await checkTrayResources();
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
