import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];

async function run(command, args) {
  try {
    const result = await execFileAsync(command, args, { cwd: root, maxBuffer: 1024 * 1024 });
    return { ok: true, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      message: error.message,
    };
  }
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function addCheck(ok, label, detail, fix) {
  checks.push({ ok, label, detail, fix });
}

async function checkSigningIdentity() {
  const result = await run("security", ["find-identity", "-v", "-p", "codesigning"]);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const hasDeveloperId = /Developer ID Application:/i.test(output);
  addCheck(
    result.ok && hasDeveloperId,
    "Developer ID Application certificate",
    hasDeveloperId ? "A Developer ID Application identity is available in this Keychain." : "No Developer ID Application identity is available in this Keychain.",
    "Create a Developer ID Application certificate in Apple Developer, download it, and import it into Keychain with its private key.",
  );
}

async function checkNotaryTool() {
  const result = await run("xcrun", ["notarytool", "--version"]);
  addCheck(
    result.ok,
    "notarytool",
    result.ok ? `notarytool is available: ${(result.stdout || result.stderr).trim()}` : "xcrun notarytool is not available.",
    "Install or update Xcode Command Line Tools.",
  );
}

async function checkNotarizationCredentials() {
  const hasApiKey = hasEnv("APPLE_API_KEY") && hasEnv("APPLE_API_KEY_ID") && hasEnv("APPLE_API_ISSUER");
  const hasAppleId = hasEnv("APPLE_ID") && hasEnv("APPLE_APP_SPECIFIC_PASSWORD") && hasEnv("APPLE_TEAM_ID");
  const hasKeychainProfile = hasEnv("APPLE_KEYCHAIN_PROFILE");

  addCheck(
    hasApiKey || hasAppleId || hasKeychainProfile,
    "notarization credentials",
    hasApiKey
      ? "APPLE_API_KEY, APPLE_API_KEY_ID, and APPLE_API_ISSUER are set."
      : hasAppleId
        ? "APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID are set."
        : hasKeychainProfile
          ? "APPLE_KEYCHAIN_PROFILE is set."
          : "No notarization credential set is available in the environment.",
    "Set App Store Connect API key env vars, Apple ID app-specific password env vars, or APPLE_KEYCHAIN_PROFILE.",
  );
}

async function checkGatekeeper() {
  const result = await run("spctl", ["--status"]);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const enabled = /assessments enabled/i.test(output);
  addCheck(
    result.ok && enabled,
    "Gatekeeper assessment",
    output.trim() || "Unable to read Gatekeeper assessment status.",
    "Run `sudo spctl --master-enable` on the verification Mac, then rerun this doctor.",
  );
}

async function checkBuilderConfig() {
  const config = await readFile(path.join(root, "electron-builder.yml"), "utf8");
  const required = [
    [/hardenedRuntime:\s*true/, "hardenedRuntime: true"],
    [/notarize:\s*true/, "notarize: true"],
    [/entitlements:\s*entitlements\.mac\.plist/, "main entitlements"],
    [/entitlementsInherit:\s*entitlements\.mac\.inherit\.plist/, "inherited entitlements"],
    [/dmg:\s*\n\s*sign:\s*true/, "signed DMG"],
  ];
  const missing = required.filter(([pattern]) => !pattern.test(config)).map(([, label]) => label);
  addCheck(
    missing.length === 0,
    "electron-builder macOS release config",
    missing.length === 0 ? "hardened runtime, notarization, entitlements, and signed DMG are configured." : `Missing: ${missing.join(", ")}.`,
    "Restore electron-builder.yml macOS release settings.",
  );
}

await checkSigningIdentity();
await checkNotaryTool();
await checkNotarizationCredentials();
await checkGatekeeper();
await checkBuilderConfig();

console.log("Hermills macOS release doctor");
console.log(`Root: ${root}`);

for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.label}`);
  console.log(`  ${check.detail}`);
  if (!check.ok) console.log(`  Fix: ${check.fix}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`\nMac release is not ready: ${failed.length} check${failed.length === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("\nMac release prerequisites are ready.");
