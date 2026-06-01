import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const firstRunAcceptanceTest = "tests/acceptance/first-run-app-state.test.ts";
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

async function runStep(label, args) {
  console.log(`\n== ${label} ==`);
  try {
    const { stdout, stderr } = await execFileAsync(npmBin, args, {
      cwd: root,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout.trim()) console.log(stdout.trim());
    if (stderr.trim()) console.error(stderr.trim());
    notes.push(`${label}: passed`);
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message].filter(Boolean).join("\n").trim();
    failures.push(`${label} failed:\n${indent(detail)}`);
  }
}

function stripQueryAndHash(reference) {
  return reference.split(/[?#]/, 1)[0];
}

async function checkRendererAssets() {
  const distDir = path.join(root, "apps/renderer/dist");
  const indexPath = path.join(distDir, "index.html");
  if (!(await pathExists(indexPath))) {
    failures.push(`[renderer] Missing ${rel(indexPath)}. Run npm run build:renderer before alpha verification.`);
    return;
  }

  const indexHtml = await readFile(indexPath, "utf8");
  const references = [...indexHtml.matchAll(/\b(?:src|href)=["']([^"']*assets\/[^"']*)["']/gi)].map((match) => match[1]);
  if (!references.length) {
    failures.push(`[renderer] ${rel(indexPath)} does not reference built assets.`);
    return;
  }

  const badReferences = references.filter((reference) => reference.startsWith("/") || /^[a-z][a-z\d+.-]*:\/\//i.test(reference));
  if (badReferences.length) {
    failures.push(`[renderer] Alpha build must use relative assets:\n${indent(badReferences.map((reference) => `- ${reference}`).join("\n"))}`);
  }

  const missing = [];
  for (const reference of references) {
    if (reference.startsWith("/")) continue;
    const target = path.resolve(distDir, stripQueryAndHash(reference).replace(/^\.\//, ""));
    if (!target.startsWith(`${distDir}${path.sep}`) || !existsSync(target)) missing.push(`${reference} -> ${rel(target)}`);
  }
  if (missing.length) {
    failures.push(`[renderer] Missing referenced assets:\n${indent(missing.map((reference) => `- ${reference}`).join("\n"))}`);
  } else {
    notes.push(`renderer assets: ${references.length} relative references verified`);
  }
}

async function main() {
  console.log("Hermills alpha verification");
  console.log(`Root: ${root}`);
  console.log(`Node: ${process.version}`);
  const { stdout: npmVersion } = await execFileAsync(npmBin, ["--version"], { cwd: root });
  console.log(`npm: ${npmVersion.trim()}`);

  await runStep("typecheck", ["run", "typecheck"]);
  await runStep("first-run app-state test", ["run", "test", "--", firstRunAcceptanceTest]);
  await runStep("test", ["run", "test"]);
  await runStep("license audit", ["run", "license:audit"]);
  await runStep("renderer build", ["run", "build:renderer"]);
  await checkRendererAssets();

  console.log("\n== release-only gates ==");
  console.log("INFO codesign, notarization, stapling, and Electron support-window checks are intentionally skipped for alpha.");

  for (const note of notes) console.log(`INFO ${note}`);
  if (failures.length) {
    console.error("\nAlpha verification failed:");
    for (const failure of failures) console.error(`\n${failure}`);
    process.exit(1);
  }

  console.log("\nAlpha verification passed.");
}

main().catch((error) => {
  console.error("Alpha verification crashed:");
  console.error(error);
  process.exit(1);
});
