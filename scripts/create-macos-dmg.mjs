import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, symlinkSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = require(path.join(root, "package.json"));
const releaseDir = path.join(root, "release");
const appPath = path.join(releaseDir, "mac-arm64", "Hermills.app");
const stageDir = path.join(releaseDir, "dmg-staging");
const tempDmg = path.join(releaseDir, `Hermills-${pkg.version}-arm64.temp.dmg`);
const finalDmg = path.join(releaseDir, `Hermills-${pkg.version}-arm64.dmg`);
const background = path.join(root, "build", "dmg-background.tiff");
const volumeIcon = path.join(root, "build", "icon.icns");
const volumeName = "Hermills Installer";

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
}

function runInherit(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function assertFile(target, message) {
  if (!existsSync(target)) throw new Error(message);
}

function detachMountedHermillsVolumes() {
  const output = run("hdiutil", ["info"]);
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf("/Volumes/Hermills");
    if (index === -1) continue;
    const volumePath = line.slice(index).trim();
    spawnSync("hdiutil", ["detach", volumePath], { stdio: "ignore" });
  }
}

function attachWritable(dmgPath) {
  const output = run("hdiutil", ["attach", "-readwrite", "-noverify", "-noautoopen", dmgPath]);
  const mountLine = output.split(/\r?\n/).find((line) => line.includes("/Volumes/"));
  if (!mountLine) throw new Error(`Could not find mounted volume in hdiutil output:\n${output}`);
  return mountLine.slice(mountLine.indexOf("/Volumes/")).trim();
}

function configureFinderWindow() {
  const script = `
tell application "Finder"
  tell disk "${volumeName}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set the bounds of container window to {400, 120, 940, 500}
    set icon size of icon view options of container window to 96
    set arrangement of icon view options of container window to not arranged
    set background picture of icon view options of container window to file ".background:dmg-background.tiff"
    set position of item "Hermills.app" of container window to {160, 245}
    set position of item "Applications" of container window to {380, 245}
    update without registering applications
    delay 1
    close
  end tell
end tell
`;
  const result = spawnSync("osascript", [], { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  if (result.status !== 0) {
    throw new Error(`Finder DMG layout script failed:\n${result.stderr || result.stdout}`);
  }
}

assertFile(appPath, "Missing packaged app. Run electron-builder --mac dir before creating the DMG.");
assertFile(background, "Missing build/dmg-background.tiff.");
assertFile(volumeIcon, "Missing build/icon.icns.");

detachMountedHermillsVolumes();
rmSync(stageDir, { recursive: true, force: true });
rmSync(tempDmg, { force: true });
rmSync(finalDmg, { force: true });
mkdirSync(path.join(stageDir, ".background"), { recursive: true });

runInherit("ditto", [appPath, path.join(stageDir, "Hermills.app")]);
symlinkSync("/Applications", path.join(stageDir, "Applications"));
copyFileSync(background, path.join(stageDir, ".background", "dmg-background.tiff"));
copyFileSync(volumeIcon, path.join(stageDir, ".VolumeIcon.icns"));

runInherit("hdiutil", [
  "create",
  "-volname", volumeName,
  "-srcfolder", stageDir,
  "-fs", "HFS+",
  "-format", "UDRW",
  "-ov", tempDmg
]);

const mountedVolume = attachWritable(tempDmg);
try {
  configureFinderWindow();
  runInherit("sync", []);
} finally {
  runInherit("hdiutil", ["detach", mountedVolume]);
}

runInherit("hdiutil", [
  "convert", tempDmg,
  "-format", "UDZO",
  "-imagekey", "zlib-level=9",
  "-o", finalDmg
]);

rmSync(stageDir, { recursive: true, force: true });
rmSync(tempDmg, { force: true });

console.log(`Created ${path.relative(root, finalDmg)}`);
