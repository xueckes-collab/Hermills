import os from "node:os";
import path from "node:path";

export function getHermillsHome(env: NodeJS.ProcessEnv = process.env): string {
  if (env.HERMILLS_HOME) return path.resolve(env.HERMILLS_HOME);
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "Hermills");
  if (process.platform === "win32") return path.join(env.APPDATA ?? os.homedir(), "Hermills");
  return path.join(env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "hermills");
}

export function getDataHome(baseDir = getHermillsHome()): string {
  return path.join(baseDir, "data");
}

export function getRuntimeHome(baseDir = getHermillsHome()): string {
  return path.join(baseDir, "runtime", "hermes-agent");
}

export function getLogHome(baseDir = getHermillsHome()): string {
  return path.join(baseDir, "logs");
}
