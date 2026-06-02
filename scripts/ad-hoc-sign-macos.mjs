import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { signAsync } = require("@electron/osx-sign");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(root, "release", "mac-arm64", "Hermills.app");
const entitlementsPath = path.join(root, "entitlements.mac.plist");

function runCapture(command, args, { check = true } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (check && result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${output}`);
  }
  return output;
}

if (!existsSync(appPath)) {
  throw new Error("Missing release/mac-arm64/Hermills.app. Run npm run build:mac:dir first.");
}

if (process.env.HERMILLS_SKIP_ADHOC_SIGN === "1") {
  console.log("Skipping ad-hoc macOS signing because HERMILLS_SKIP_ADHOC_SIGN=1.");
  process.exit(0);
}

const currentSignature = runCapture("codesign", ["-dvvv", appPath], { check: false });
if (currentSignature.includes("Authority=Developer ID Application:")) {
  console.log("Developer ID signature detected; skipping ad-hoc preview signing.");
  process.exit(0);
}

await signAsync({
  app: appPath,
  identity: "-",
  identityValidation: false,
  platform: "darwin",
  type: "development",
  preAutoEntitlements: false,
  optionsForFile: (filePath) => path.resolve(filePath) === appPath
    ? { entitlements: entitlementsPath }
    : null
});

runCapture("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
const signedDetails = runCapture("codesign", ["-dvvv", "--entitlements", ":-", appPath]);

if (!signedDetails.includes("Signature=adhoc")) {
  throw new Error("Expected ad-hoc signature after preview signing.");
}
if (!signedDetails.includes("Runtime Version=")) {
  throw new Error("Expected hardened runtime metadata after preview signing.");
}
if (!signedDetails.includes("com.apple.security.network.client")) {
  throw new Error("Expected com.apple.security.network.client entitlement after preview signing.");
}

console.log("Ad-hoc signed release/mac-arm64/Hermills.app for unsigned GitHub preview packaging.");
