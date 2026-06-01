import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];
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

async function runTool(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
      ...options,
    });
    return {
      ok: true,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      message: error.message,
    };
  }
}

function toolDetail(result) {
  return [result.stderr, result.stdout, result.message].filter(Boolean).join("\n").trim();
}

function xmlUnescape(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath, predicate));
    } else if (!predicate || predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

async function collectAppBundles(dir) {
  const apps = [];
  if (!(await pathExists(dir))) return apps;

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith(".app")) {
      apps.push(entryPath);
      continue;
    }
    apps.push(...await collectAppBundles(entryPath));
  }

  return apps;
}

function stripQueryAndHash(reference) {
  return reference.split(/[?#]/, 1)[0];
}

function isRemoteReference(reference) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(reference);
}

async function checkRendererAssets() {
  const distDir = path.join(root, "apps/renderer/dist");
  const indexPath = path.join(distDir, "index.html");

  if (!(await pathExists(distDir))) {
    failures.push(`[renderer] Missing ${rel(distDir)}. Run npm run build:renderer or npm run build:dmg before verifying release artifacts.`);
    return;
  }

  if (!(await pathExists(indexPath))) {
    failures.push(`[renderer] Missing ${rel(indexPath)}. The packaged Electron app needs this file for file:// loading.`);
    return;
  }

  const indexHtml = await readFile(indexPath, "utf8");
  const assetReferences = [...indexHtml.matchAll(/\b(?:src|href)=["']([^"']*assets\/[^"']*)["']/gi)].map((match) => match[1]);

  if (assetReferences.length === 0) {
    failures.push(`[renderer] ${rel(indexPath)} does not reference assets/. Confirm the renderer build emitted script and stylesheet files.`);
    return;
  }

  const absoluteReferences = assetReferences.filter((reference) => reference.startsWith("/") || isRemoteReference(reference));
  if (absoluteReferences.length > 0) {
    failures.push([
      `[renderer] ${rel(indexPath)} must use relative assets so the app works from file://.`,
      "Found absolute asset references:",
      indent(absoluteReferences.map((reference) => `- ${reference}`).join("\n")),
      'Expected references like "./assets/..." or "assets/...".',
    ].join("\n"));
  }

  const missingReferences = [];
  for (const reference of assetReferences) {
    if (reference.startsWith("/") || isRemoteReference(reference)) continue;
    const normalizedReference = stripQueryAndHash(reference).replace(/^\.\//, "");
    const targetPath = path.resolve(distDir, normalizedReference);
    if (!targetPath.startsWith(`${distDir}${path.sep}`)) {
      missingReferences.push(`${reference} escapes ${rel(distDir)}`);
    } else if (!existsSync(targetPath)) {
      missingReferences.push(`${reference} -> ${rel(targetPath)}`);
    }
  }

  if (missingReferences.length > 0) {
    failures.push([
      `[renderer] Some relative assets referenced by ${rel(indexPath)} are missing:`,
      indent(missingReferences.map((reference) => `- ${reference}`).join("\n")),
    ].join("\n"));
  }

  const distFiles = await collectFiles(distDir, (filePath) => /\.(?:html|css|mjs|js)$/i.test(filePath));
  const absoluteAssetHits = [];
  for (const filePath of distFiles) {
    const lines = (await readFile(filePath, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (/(?:src|href)=["']\/assets\/|url\(["']?\/assets\/|["']\/assets\//.test(line)) {
        absoluteAssetHits.push(`${rel(filePath)}:${index + 1}`);
      }
    });
  }

  if (absoluteAssetHits.length > 0) {
    failures.push([
      "[renderer] Dist files contain absolute /assets/ references:",
      indent(absoluteAssetHits.slice(0, 10).map((hit) => `- ${hit}`).join("\n")),
      "Rebuild with a relative asset base before packaging.",
    ].join("\n"));
  }

  notes.push(`[renderer] Checked ${rel(indexPath)} and ${distFiles.length} renderer dist files.`);
}

async function checkElectronSupportWindow() {
  const packageJsonPath = path.join(root, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const electronRange = packageJson.devDependencies?.electron ?? packageJson.dependencies?.electron;
  const major = Number(String(electronRange ?? "").match(/\d+/)?.[0]);

  if (!electronRange || !Number.isFinite(major)) {
    failures.push("[electron] package.json must pin a supported Electron major before release verification.");
    return;
  }

  if (major < 40) {
    failures.push([
      `[electron] Electron ${electronRange} is outside the current supported release window for a May 2026 macOS release.`,
      "Upgrade Electron and regenerate package-lock.json before accepting external distribution artifacts.",
    ].join("\n"));
    return;
  }

  notes.push(`[electron] Electron range ${electronRange} is within the expected 2026 support window.`);
}

async function checkReleaseArtifacts() {
  const releaseDir = path.join(root, "release");
  if (!(await pathExists(releaseDir))) {
    failures.push("[release] Missing release/. Run npm run build:zip or npm run build:dmg before verification.");
    return;
  }

  const artifacts = await collectFiles(releaseDir, (filePath) => /\.(?:zip|dmg)$/i.test(filePath));
  if (artifacts.length === 0) {
    failures.push("[release] No .zip or .dmg artifact found under release/. Run npm run build:zip or npm run build:dmg.");
    return;
  }

  const emptyArtifacts = [];
  for (const artifact of artifacts) {
    const artifactStat = await stat(artifact);
    if (artifactStat.size === 0) emptyArtifacts.push(rel(artifact));
  }

  if (emptyArtifacts.length > 0) {
    failures.push([
      "[release] Release artifacts must not be empty:",
      indent(emptyArtifacts.map((artifact) => `- ${artifact}`).join("\n")),
    ].join("\n"));
  }

  notes.push(`[release] Found ${artifacts.map((artifact) => rel(artifact)).join(", ")}.`);
}

async function checkPackagedRendererAssets() {
  const releaseDir = path.join(root, "release");
  if (!(await pathExists(releaseDir))) return;

  const asarFiles = await collectFiles(releaseDir, (filePath) => path.basename(filePath) === "app.asar");
  if (asarFiles.length === 0) {
    warnings.push("[asar] No app.asar found under release/; skipping packaged renderer verification.");
    return;
  }

  const distDir = path.join(root, "apps/renderer/dist");
  const distIndexPath = path.join(distDir, "index.html");
  const distIndexHtml = await pathExists(distIndexPath) ? await readFile(distIndexPath, "utf8") : undefined;

  for (const asarPath of asarFiles) {
    let packagedIndex;
    try {
      packagedIndex = asar.extractFile(asarPath, "apps/renderer/dist/index.html").toString("utf8");
    } catch (error) {
      failures.push(`[asar] ${rel(asarPath)} does not contain apps/renderer/dist/index.html: ${error.message}`);
      continue;
    }

    if (distIndexHtml && packagedIndex !== distIndexHtml) {
      failures.push([
        `[asar] ${rel(asarPath)} contains a stale renderer index.html.`,
        "Rebuild release artifacts after the renderer build so verification checks the packaged app, not only the workspace dist.",
      ].join("\n"));
    }

    const listedFiles = new Set(asar.listPackage(asarPath).map((entry) => entry.replace(/^\//, "")));
    const assetReferences = [...packagedIndex.matchAll(/\b(?:src|href)=["']([^"']*assets\/[^"']*)["']/gi)].map((match) => match[1]);
    const missing = [];
    for (const reference of assetReferences) {
      if (reference.startsWith("/") || isRemoteReference(reference)) continue;
      const normalizedReference = stripQueryAndHash(reference).replace(/^\.\//, "");
      const packagedPath = `apps/renderer/dist/${normalizedReference}`;
      if (!listedFiles.has(packagedPath)) missing.push(`${reference} -> ${packagedPath}`);
    }

    if (missing.length > 0) {
      failures.push([
        `[asar] Some renderer assets referenced inside ${rel(asarPath)} are missing:`,
        indent(missing.map((reference) => `- ${reference}`).join("\n")),
      ].join("\n"));
    } else {
      notes.push(`[asar] Checked packaged renderer assets in ${rel(asarPath)}.`);
    }
  }
}

async function checkPackagedWorkspaceModules() {
  const releaseDir = path.join(root, "release");
  if (!(await pathExists(releaseDir))) return;

  const asarFiles = await collectFiles(releaseDir, (filePath) => path.basename(filePath) === "app.asar");
  if (asarFiles.length === 0) return;

  const requiredModules = [
    "apps/desktop/main.cjs",
    "apps/desktop/preload.cjs",
    "apps/server/dist/index.js",
    "apps/renderer/dist/index.html",
    "node_modules/@hermills/core/package.json",
    "node_modules/@hermills/core/dist/index.js",
    "node_modules/@hermills/agent-builder/package.json",
    "node_modules/@hermills/agent-builder/dist/index.js",
    "node_modules/@hermills/runtime/package.json",
    "node_modules/@hermills/runtime/dist/index.js",
  ];

  for (const asarPath of asarFiles) {
    const listedFiles = new Set(asar.listPackage(asarPath).map((entry) => entry.replace(/^\//, "")));
    const missing = requiredModules.filter((entry) => !listedFiles.has(entry));
    if (missing.length > 0) {
      failures.push([
        `[asar] ${rel(asarPath)} is missing packaged files required by the desktop app:`,
        indent(missing.map((entry) => `- ${entry}`).join("\n")),
        "Update electron-builder.yml and rebuild release artifacts before shipping.",
      ].join("\n"));
    } else {
      notes.push(`[asar] Checked packaged desktop, renderer, server, and @hermills workspace files in ${rel(asarPath)}.`);
    }
  }
}

async function checkCodesign() {
  const releaseDir = path.join(root, "release");
  if (!(await pathExists(releaseDir))) return;

  const apps = await collectAppBundles(releaseDir);
  if (apps.length === 0) {
    warnings.push("[codesign] No .app bundle found under release/; skipping codesign verification.");
    return;
  }

  if (process.platform !== "darwin") {
    failures.push(`[codesign] Found ${apps.map((app) => rel(app)).join(", ")} but codesign verification requires macOS.`);
    return;
  }

  for (const appPath of apps) {
    await verifyMacAppBundle(appPath, rel(appPath));
  }
}

let gatekeeperChecked = false;
let gatekeeperEnabled = false;

async function gatekeeperAssessmentsEnabled() {
  if (gatekeeperChecked) return gatekeeperEnabled;
  gatekeeperChecked = true;

  const result = await runTool("spctl", ["--status"]);
  const detail = toolDetail(result);
  if (!result.ok) {
    failures.push([
      "[spctl] Could not read Gatekeeper assessment status.",
      detail ? indent(detail) : "  spctl --status exited with a non-zero status.",
    ].join("\n"));
    return false;
  }

  gatekeeperEnabled = /assessments enabled/i.test(detail || result.stdout || result.stderr);
  if (!gatekeeperEnabled) {
    failures.push([
      "[spctl] Gatekeeper assessments are disabled on this Mac, so release verification cannot prove customer first-open safety.",
      detail ? indent(detail) : "  Expected `assessments enabled` from `spctl --status`.",
      "Enable Gatekeeper on the release verification machine and rerun npm run verify:release.",
    ].join("\n"));
  }
  return gatekeeperEnabled;
}

async function verifyMacAppBundle(appPath, originLabel) {
  if (process.platform !== "darwin") {
    failures.push(`[mac] ${originLabel} requires macOS signing, Gatekeeper, and notarization checks.`);
    return;
  }

  const verifyResult = await runTool("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  if (!verifyResult.ok) {
    const detail = toolDetail(verifyResult);
    failures.push([
      `[codesign] codesign verification failed for ${originLabel}.`,
      detail ? indent(detail) : "  codesign exited with a non-zero status.",
      "Sign the app with Developer ID credentials, hardened runtime, and the release entitlements before shipping.",
    ].join("\n"));
  } else {
    notes.push(`[codesign] Verified ${originLabel}.`);
  }

  const detailsResult = await runTool("codesign", ["-dvvv", "--entitlements", ":-", appPath]);
  const details = [detailsResult.stderr, detailsResult.stdout].filter(Boolean).join("\n");
  if (!detailsResult.ok) {
    failures.push([
      `[codesign] Could not inspect signing details for ${originLabel}.`,
      toolDetail(detailsResult) ? indent(toolDetail(detailsResult)) : "  codesign -dvvv exited with a non-zero status.",
    ].join("\n"));
  } else {
    if (/Signature=adhoc/i.test(details) || !/Authority=Developer ID Application:/i.test(details)) {
      failures.push([
        `[codesign] ${originLabel} is not signed with a Developer ID Application certificate.`,
        "Expected an `Authority=Developer ID Application: ...` chain. Ad hoc or Apple Development signatures are not acceptable for external Mac distribution.",
      ].join("\n"));
    }

    if (/TeamIdentifier=not set/i.test(details) || !/TeamIdentifier=/i.test(details)) {
      failures.push(`[codesign] ${originLabel} does not expose a valid TeamIdentifier. Rebuild with APPLE_TEAM_ID / Developer ID signing credentials.`);
    }

    if (!/(?:Runtime Version=|flags=.*\bruntime\b)/i.test(details)) {
      failures.push(`[codesign] ${originLabel} does not show hardened runtime metadata. Keep mac.hardenedRuntime enabled and sign with a release identity.`);
    }

    if (!/com\.apple\.security\.network\.client/.test(details)) {
      failures.push(`[codesign] ${originLabel} is missing the network client entitlement required for the local Hermes gateway.`);
    }
  }

  await verifyGatekeeper(appPath, originLabel);
  await verifyStapler(appPath, originLabel);
}

async function verifyGatekeeper(appPath, originLabel) {
  if (!(await gatekeeperAssessmentsEnabled())) return;

  const result = await runTool("spctl", ["-a", "-vvv", "-t", "exec", appPath]);
  const detail = toolDetail(result);
  if (!result.ok || !/accepted/i.test(detail)) {
    failures.push([
      `[spctl] Gatekeeper rejected ${originLabel}.`,
      detail ? indent(detail) : "  spctl exited with a non-zero status.",
      "Notarize the app and verify it on a Gatekeeper-enabled Mac before shipping.",
    ].join("\n"));
  } else {
    notes.push(`[spctl] Gatekeeper accepted ${originLabel}.`);
  }
}

async function verifyStapler(artifactPath, originLabel) {
  if (process.platform !== "darwin") {
    failures.push(`[stapler] ${originLabel} requires macOS notarization ticket validation.`);
    return;
  }

  const result = await runTool("xcrun", ["stapler", "validate", artifactPath]);
  const detail = toolDetail(result);
  if (!result.ok) {
    failures.push([
      `[stapler] Notarization ticket validation failed for ${originLabel}.`,
      detail ? indent(detail) : "  xcrun stapler validate exited with a non-zero status.",
      "Notarize and staple the app/DMG before treating this artifact as customer-ready.",
    ].join("\n"));
  } else {
    notes.push(`[stapler] Validated notarization ticket for ${originLabel}.`);
  }
}

async function checkDmgArtifacts() {
  const releaseDir = path.join(root, "release");
  if (!(await pathExists(releaseDir))) return;

  const dmgs = await collectFiles(releaseDir, (filePath) => /\.dmg$/i.test(filePath));
  if (dmgs.length === 0) return;

  if (process.platform !== "darwin") {
    failures.push(`[dmg] Found ${dmgs.map((dmg) => rel(dmg)).join(", ")} but DMG mount verification requires macOS.`);
    return;
  }

  for (const dmgPath of dmgs) {
    await verifyStapler(dmgPath, rel(dmgPath));

    const attachResult = await runTool("hdiutil", ["attach", "-nobrowse", "-readonly", "-plist", dmgPath]);
    if (!attachResult.ok) {
      failures.push([
        `[dmg] Could not mount ${rel(dmgPath)}.`,
        toolDetail(attachResult) ? indent(toolDetail(attachResult)) : "  hdiutil attach exited with a non-zero status.",
      ].join("\n"));
      continue;
    }

    const mountPoints = [...attachResult.stdout.matchAll(/<key>mount-point<\/key>\s*<string>([^<]+)<\/string>/g)]
      .map((match) => xmlUnescape(match[1]));

    if (mountPoints.length === 0) {
      failures.push(`[dmg] ${rel(dmgPath)} mounted without a readable mount point in hdiutil output.`);
      continue;
    }

    try {
      let appsInDmg = [];
      for (const mountPoint of mountPoints) {
        appsInDmg = appsInDmg.concat(await collectAppBundles(mountPoint));
      }

      if (appsInDmg.length === 0) {
        failures.push(`[dmg] ${rel(dmgPath)} does not contain a .app bundle.`);
      }

      for (const appPath of appsInDmg) {
        await verifyMacAppBundle(appPath, `${rel(dmgPath)} -> ${path.basename(appPath)}`);
      }
      notes.push(`[dmg] Mounted ${rel(dmgPath)} and checked ${appsInDmg.length} app bundle${appsInDmg.length === 1 ? "" : "s"}.`);
    } finally {
      for (const mountPoint of mountPoints) {
        const detachResult = await runTool("hdiutil", ["detach", mountPoint]);
        if (!detachResult.ok) {
          warnings.push(`[dmg] Could not detach ${mountPoint}: ${toolDetail(detachResult) || "hdiutil detach failed"}`);
        }
      }
    }
  }
}

async function checkZipArtifacts() {
  const releaseDir = path.join(root, "release");
  if (!(await pathExists(releaseDir))) return;

  const zips = await collectFiles(releaseDir, (filePath) => /\.zip$/i.test(filePath));
  if (zips.length === 0) return;

  if (process.platform !== "darwin") {
    failures.push(`[zip] Found ${zips.map((zip) => rel(zip)).join(", ")} but ZIP app verification requires macOS.`);
    return;
  }

  for (const zipPath of zips) {
    const extractDir = await mkdtemp(path.join(os.tmpdir(), "hermills-release-zip-"));
    try {
      const extractResult = await runTool("ditto", ["-x", "-k", "--rsrc", zipPath, extractDir]);
      if (!extractResult.ok) {
        failures.push([
          `[zip] Could not extract ${rel(zipPath)}.`,
          toolDetail(extractResult) ? indent(toolDetail(extractResult)) : "  ditto exited with a non-zero status.",
        ].join("\n"));
        continue;
      }

      const appsInZip = await collectAppBundles(extractDir);
      if (appsInZip.length === 0) {
        failures.push(`[zip] ${rel(zipPath)} does not contain a .app bundle after extraction.`);
      }

      for (const appPath of appsInZip) {
        await verifyMacAppBundle(appPath, `${rel(zipPath)} -> ${path.basename(appPath)}`);
      }
      notes.push(`[zip] Extracted ${rel(zipPath)} and checked ${appsInZip.length} app bundle${appsInZip.length === 1 ? "" : "s"}.`);
    } finally {
      await rm(extractDir, { recursive: true, force: true });
    }
  }
}

async function main() {
  console.log("Hermills release verification");
  console.log(`Root: ${root}`);

  await checkRendererAssets();
  await checkElectronSupportWindow();
  await checkReleaseArtifacts();
  await checkPackagedRendererAssets();
  await checkPackagedWorkspaceModules();
  await checkCodesign();
  await checkDmgArtifacts();
  await checkZipArtifacts();

  for (const note of notes) console.log(`INFO ${note}`);
  for (const warning of warnings) console.warn(`WARN ${warning}`);

  if (failures.length > 0) {
    console.error("\nRelease verification failed:");
    for (const failure of failures) console.error(`\n${failure}`);
    process.exit(1);
  }

  console.log("\nRelease verification passed.");
}

main().catch((error) => {
  console.error("Release verification crashed:");
  console.error(error);
  process.exit(1);
});
