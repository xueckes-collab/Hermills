import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, copyFile, lstat, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineId = "deep-research";
const engineResourcePath = `hermills-engines/${engineId}`;
const stageRoot = path.join(root, "build", "hermills-engines");
const stageDir = path.join(stageRoot, engineId);
const defaultSourceDir = path.join(root, "services", "deep-research");
const commonExcludedSegments = new Set([
  ".git",
  ".hg",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  ".svn",
  ".venv",
  "__pycache__",
  "build",
  "dist",
  "env",
  "ms-playwright",
  "node_modules",
  "release",
  "venv"
]);

const args = parseArgs(process.argv.slice(2));
const notes = [];

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw usageError(`Unexpected argument: ${arg}`);
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      parsed[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function usageError(message) {
  return new Error(`${message}\n\n${usage()}`);
}

function usage() {
  return [
    "Usage: node scripts/build-win-sidecar-resources.mjs [options]",
    "",
    "Required inputs:",
    "  --source <dir> or HERMILLS_DEEP_RESEARCH_SOURCE",
    "      Deep Research sidecar source directory. Defaults to services/deep-research.",
    "  --python-runtime <dir> or HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME",
    "      Portable Windows Python runtime directory containing python.exe.",
    "",
    "Optional inputs:",
    "  --build-python <exe> or HERMILLS_DEEP_RESEARCH_BUILD_PYTHON",
    "      Deprecated. Dependencies are installed with the bundled Python runtime so native wheels match the packaged interpreter.",
    "  --requirements <file> or HERMILLS_DEEP_RESEARCH_REQUIREMENTS",
    "      Requirements file. Defaults to requirements-win.txt or requirements.txt in the source directory.",
    "  --playwright-browsers <dir> or HERMILLS_DEEP_RESEARCH_PLAYWRIGHT_BROWSERS",
    "      Existing ms-playwright browser cache to copy instead of downloading Chromium.",
    "  --wheelhouse <dir> or HERMILLS_DEEP_RESEARCH_WHEELHOUSE",
    "      Offline wheel directory passed to pip with --no-index --find-links.",
    "  --skip-pip",
    "      Do not install Python dependencies into python-site-packages.",
    "  --skip-playwright-install",
    "      Do not run python -m playwright install chromium when no browser cache is provided.",
    "",
    `Output: build/${engineResourcePath}`
  ].join("\n");
}

function option(name, envName, fallback) {
  const value = args[name] ?? process.env[envName] ?? fallback;
  if (typeof value !== "string" || value.length === 0) return undefined;
  return stripOuterQuotes(value);
}

function flag(name, envName) {
  if (args[name] === true) return true;
  return process.env[envName] === "1";
}

function stripOuterQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function rel(filePath) {
  return path.relative(root, filePath) || ".";
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function assertDirectory(filePath, label, help) {
  if (!(await pathExists(filePath))) {
    throw new Error(`${label} does not exist: ${filePath}\n${help}`);
  }
  const entryStat = await stat(filePath);
  if (!entryStat.isDirectory()) {
    throw new Error(`${label} must be a directory: ${filePath}`);
  }
}

async function assertFile(filePath, label, help) {
  if (!(await pathExists(filePath))) {
    throw new Error(`${label} does not exist: ${filePath}\n${help}`);
  }
  const entryStat = await stat(filePath);
  if (!entryStat.isFile() || entryStat.size === 0) {
    throw new Error(`${label} must be a non-empty file: ${filePath}`);
  }
}

async function resetStageDirectory() {
  const expected = path.join(root, "build", "hermills-engines", engineId);
  if (path.resolve(stageDir) !== expected) throw new Error(`Refusing to remove unexpected stage path: ${stageDir}`);
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });
}

function shouldSkipSidecarEntry(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => commonExcludedSegments.has(segment))) return true;
  const basename = segments.at(-1) ?? "";
  if (basename.startsWith(".env")) return true;
  return /\.(pyc|pyo|pyd\.tmp)$/i.test(basename);
}

async function copyTree(sourceDir, targetDir, options = {}) {
  const sourceRoot = path.resolve(sourceDir);
  let copiedFiles = 0;
  let skippedEntries = 0;

  async function walk(currentSource, currentTarget) {
    await mkdir(currentTarget, { recursive: true });
    for (const entry of await readdir(currentSource, { withFileTypes: true })) {
      const sourcePath = path.join(currentSource, entry.name);
      const relativePath = path.relative(sourceRoot, sourcePath);
      if (options.filter && options.filter(relativePath, entry)) {
        skippedEntries += 1;
        continue;
      }

      const targetPath = path.join(currentTarget, entry.name);
      if (entry.isDirectory()) {
        await walk(sourcePath, targetPath);
        continue;
      }
      if (entry.isFile()) {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await copyFile(sourcePath, targetPath);
        copiedFiles += 1;
        continue;
      }
      skippedEntries += 1;
    }
  }

  await walk(sourceRoot, targetDir);
  return { copiedFiles, skippedEntries };
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

async function findFirstExisting(paths) {
  for (const candidate of paths.filter(Boolean)) {
    if (await pathExists(candidate)) return candidate;
  }
  return undefined;
}

async function resolveBuildPython(required) {
  const configured = option("build-python", "HERMILLS_DEEP_RESEARCH_BUILD_PYTHON");
  const candidates = [
    configured ? { command: configured, prefixArgs: [], label: configured } : undefined,
    { command: "py", prefixArgs: ["-3"], label: "py -3" },
    { command: "python", prefixArgs: [], label: "python" },
    { command: "python3", prefixArgs: [], label: "python3" }
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const { stdout, stderr } = await execFileAsync(candidate.command, [...candidate.prefixArgs, "--version"], {
        windowsHide: true,
        timeout: 10000
      });
      const version = `${stdout}${stderr}`.trim();
      notes.push(`[python] Using build Python ${candidate.label}${version ? ` (${version})` : ""}.`);
      return candidate;
    } catch {
      // Try the next conventional Python command.
    }
  }

  if (!required) return undefined;
  throw new Error([
    "No build Python was found.",
    "Install Python 3.11+ for the packaging machine, or set HERMILLS_DEEP_RESEARCH_BUILD_PYTHON to python.exe.",
    "The installed Hermills app will use the bundled runtime from HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME; build Python is only needed while staging pip dependencies and Playwright Chromium."
  ].join("\n"));
}

function buildPythonArgs(buildPython, argsToAppend) {
  return [...buildPython.prefixArgs, ...argsToAppend];
}

function runtimePythonCommand(pythonDir) {
  return {
    command: path.join(pythonDir, "python.exe"),
    prefixArgs: [],
    label: "bundled Python runtime"
  };
}

function sidecarPythonEnv() {
  return {
    ...process.env,
    PYTHONPATH: [path.join(stageDir, "python-site-packages"), path.join(stageDir, "app"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    PLAYWRIGHT_BROWSERS_PATH: path.join(stageDir, "ms-playwright")
  };
}

function runCommand(command, argsToAppend, options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, argsToAppend, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 20
    }, (error, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (error) reject(error);
      else resolve();
    });
    child.on("error", reject);
  });
}

async function installPythonDependencies(python, sourceDir, sitePackagesDir) {
  if (flag("skip-pip", "HERMILLS_DEEP_RESEARCH_SKIP_PIP")) {
    notes.push("[python] Skipped pip dependency install.");
    return;
  }

  const configuredRequirements = option("requirements", "HERMILLS_DEEP_RESEARCH_REQUIREMENTS");
  const requirementsFile = configuredRequirements
    ? path.resolve(configuredRequirements)
    : await findFirstExisting([
      path.join(sourceDir, "requirements-win.txt"),
      path.join(sourceDir, "requirements.txt")
    ]);
  const pyprojectFile = path.join(sourceDir, "pyproject.toml");
  const wheelhouse = option("wheelhouse", "HERMILLS_DEEP_RESEARCH_WHEELHOUSE");

  await mkdir(sitePackagesDir, { recursive: true });
  if (!requirementsFile && !(await pathExists(pyprojectFile))) {
    notes.push("[python] No requirements-win.txt, requirements.txt, or pyproject.toml found; created an empty python-site-packages directory.");
    return;
  }

  const pipArgs = ["-m", "pip", "install", "--upgrade", "--target", sitePackagesDir];
  if (wheelhouse) {
    await assertDirectory(path.resolve(wheelhouse), "Wheelhouse", "Set HERMILLS_DEEP_RESEARCH_WHEELHOUSE to a directory containing Python wheels, or remove it to allow pip to use its configured index.");
    pipArgs.push("--no-index", "--find-links", path.resolve(wheelhouse));
  }
  if (requirementsFile) {
    await assertFile(requirementsFile, "Requirements file", "Set HERMILLS_DEEP_RESEARCH_REQUIREMENTS to a valid requirements file.");
    pipArgs.push("-r", requirementsFile);
    notes.push(`[python] Installing dependencies from ${rel(requirementsFile)}.`);
  } else {
    pipArgs.push(sourceDir);
    notes.push(`[python] Installing sidecar package from ${rel(sourceDir)}.`);
  }

  try {
    await runCommand(python.command, buildPythonArgs(python, pipArgs), { env: sidecarPythonEnv() });
  } catch (error) {
    throw new Error([
      "Failed to install Python sidecar dependencies.",
      "Hermills now installs dependencies with the bundled Python runtime so compiled wheels match the packaged interpreter.",
      "Make sure HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME points to a Python runtime with pip, or provide a same-version wheelhouse.",
      "For offline CI, set HERMILLS_DEEP_RESEARCH_WHEELHOUSE to a directory of prebuilt wheels.",
      `Original error: ${error.message}`
    ].join("\n"));
  }
}

async function patchEmbeddablePythonPath(pythonDir) {
  const entries = await readdir(pythonDir).catch(() => []);
  const pthName = entries.find((entry) => /^python\d+._pth$/i.test(entry));
  if (!pthName) {
    notes.push("[python] No embeddable python ._pth file found; runtime will rely on launcher environment variables.");
    return;
  }

  const pthPath = path.join(pythonDir, pthName);
  const original = await readFile(pthPath, "utf8");
  const lines = original.split(/\r?\n/);
  const wanted = ["..\\python-site-packages", "..\\app"];
  const uncommented = lines.map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  const nextLines = [...lines.filter((line) => line.trim() !== "#import site")];
  for (const entry of wanted) {
    if (!uncommented.includes(entry)) nextLines.push(entry);
  }
  if (!nextLines.some((line) => line.trim() === "import site")) nextLines.push("import site");
  await writeFile(pthPath, `${nextLines.join("\r\n").replace(/\r?\n+$/g, "")}\r\n`, "utf8");
  notes.push(`[python] Patched ${rel(pthPath)} for bundled app and site-packages paths.`);
}

async function stagePythonRuntime(runtimeDir, targetDir) {
  await assertDirectory(runtimeDir, "Python runtime", [
    "Set HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME to a portable Windows Python runtime directory containing python.exe.",
    "This is required so installed Windows builds do not depend on system Python."
  ].join("\n"));
  await assertFile(path.join(runtimeDir, "python.exe"), "Python runtime executable", "The runtime directory must contain python.exe.");
  const result = await copyTree(runtimeDir, targetDir);
  await patchEmbeddablePythonPath(targetDir);
  notes.push(`[python] Copied Python runtime (${result.copiedFiles} files) to ${rel(targetDir)}.`);
}

async function stageSidecarSource(sourceDir, targetDir) {
  await assertDirectory(sourceDir, "Deep Research sidecar source", [
    "Set HERMILLS_DEEP_RESEARCH_SOURCE to the sidecar source directory, or pass --source <dir>.",
    "The default services/deep-research directory is not present in this checkout."
  ].join("\n"));
  const result = await copyTree(sourceDir, targetDir, { filter: shouldSkipSidecarEntry });
  const copied = await collectFiles(targetDir);
  if (copied.length === 0) throw new Error(`Deep Research sidecar source copied no files: ${sourceDir}`);
  notes.push(`[sidecar] Copied ${result.copiedFiles} sidecar files to ${rel(targetDir)} (${result.skippedEntries} skipped).`);
}

async function findChromiumExecutables(browserDir) {
  return collectFiles(browserDir, (filePath) => {
    const normalized = filePath.replace(/\\/g, "/").toLowerCase();
    return normalized.includes("/chromium-") && /\/chrome-win(?:64)?\/chrome\.exe$/i.test(normalized);
  });
}

async function stagePlaywrightBrowsers(python, sourceDir, browserDir, sitePackagesDir) {
  const configuredBrowserDir = option("playwright-browsers", "HERMILLS_DEEP_RESEARCH_PLAYWRIGHT_BROWSERS");
  const defaultBrowserDir = configuredBrowserDir
    ? path.resolve(configuredBrowserDir)
    : await findFirstExisting([
      path.join(sourceDir, "ms-playwright"),
      path.join(sourceDir, ".playwright", "ms-playwright"),
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "ms-playwright") : undefined
    ]);

  if (defaultBrowserDir) {
    await assertDirectory(defaultBrowserDir, "Playwright browser cache", "Set HERMILLS_DEEP_RESEARCH_PLAYWRIGHT_BROWSERS to an ms-playwright directory containing Chromium.");
    const result = await copyTree(defaultBrowserDir, browserDir);
    const chromium = await findChromiumExecutables(browserDir);
    if (chromium.length === 0) {
      throw new Error(`Playwright browser cache does not contain Chromium chrome.exe: ${defaultBrowserDir}`);
    }
    notes.push(`[playwright] Copied browser cache (${result.copiedFiles} files) to ${rel(browserDir)}.`);
    return;
  }

  if (flag("skip-playwright-install", "HERMILLS_DEEP_RESEARCH_SKIP_PLAYWRIGHT_INSTALL")) {
    notes.push("[playwright] Skipped Chromium install; verify:win will fail until ms-playwright Chromium is staged.");
    return;
  }

  await mkdir(browserDir, { recursive: true });
  const pythonPath = [sitePackagesDir, path.join(stageDir, "app"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter);
  try {
    await runCommand(python.command, buildPythonArgs(python, ["-m", "playwright", "install", "chromium"]), {
      env: {
        ...process.env,
        PLAYWRIGHT_BROWSERS_PATH: browserDir,
        PYTHONPATH: pythonPath
      }
    });
  } catch (error) {
    throw new Error([
      "Failed to install Playwright Chromium.",
      "Ensure the sidecar requirements include the Python playwright package, or set HERMILLS_DEEP_RESEARCH_PLAYWRIGHT_BROWSERS to a prewarmed ms-playwright cache.",
      `Original error: ${error.message}`
    ].join("\n"));
  }

  const chromium = await findChromiumExecutables(browserDir);
  if (chromium.length === 0) throw new Error(`Playwright install completed but Chromium chrome.exe was not found in ${browserDir}`);
  notes.push(`[playwright] Installed Chromium into ${rel(browserDir)}.`);
}

async function writeLauncher(engineDir) {
  const binDir = path.join(engineDir, "bin");
  await mkdir(binDir, { recursive: true });
  const launcherPath = path.join(binDir, "run-python.cmd");
  const script = [
    "@echo off",
    "setlocal",
    "set \"ENGINE_DIR=%~dp0..\"",
    "for %%I in (\"%ENGINE_DIR%\") do set \"ENGINE_DIR=%%~fI\"",
    "set \"PYTHONPATH=%ENGINE_DIR%\\python-site-packages;%ENGINE_DIR%\\app;%PYTHONPATH%\"",
    "set \"PLAYWRIGHT_BROWSERS_PATH=%ENGINE_DIR%\\ms-playwright\"",
    "\"%ENGINE_DIR%\\python\\python.exe\" %*",
    "exit /b %ERRORLEVEL%",
    ""
  ].join("\r\n");
  await writeFile(launcherPath, script, "utf8");
  notes.push(`[launcher] Wrote ${rel(launcherPath)}.`);
}

async function writeManifest(engineDir, sourceDir) {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifest = {
    id: engineId,
    layoutVersion: 1,
    packagedFor: {
      platform: "win32",
      arch: "x64",
      appVersion: packageJson.version
    },
    resourcePath: engineResourcePath,
    sourcePath: path.isAbsolute(sourceDir) && sourceDir.startsWith(root) ? rel(sourceDir).replace(/\\/g, "/") : undefined,
    app: {
      relativePath: "app"
    },
    python: {
      executable: "python/python.exe",
      launcher: "bin/run-python.cmd",
      sitePackages: "python-site-packages"
    },
    playwright: {
      browsersPath: "ms-playwright",
      chromiumExecutablePattern: "ms-playwright/chromium-*/chrome-win*/chrome.exe"
    },
    environment: {
      PYTHONPATH: "python-site-packages;app",
      PLAYWRIGHT_BROWSERS_PATH: "ms-playwright"
    }
  };
  Object.keys(manifest).forEach((key) => manifest[key] === undefined && delete manifest[key]);
  await writeFile(path.join(engineDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  notes.push(`[manifest] Wrote ${rel(path.join(engineDir, "manifest.json"))}.`);
}

async function validateStage() {
  const requiredFiles = [
    path.join(stageDir, "manifest.json"),
    path.join(stageDir, "python", "python.exe"),
    path.join(stageDir, "bin", "run-python.cmd")
  ];
  for (const filePath of requiredFiles) await assertFile(filePath, "Staged engine file", "Re-run npm run build:win:engines.");

  const appFiles = await collectFiles(path.join(stageDir, "app"));
  if (appFiles.length === 0) throw new Error("Staged sidecar app directory is empty.");

  const chromium = await findChromiumExecutables(path.join(stageDir, "ms-playwright"));
  if (chromium.length === 0) {
    throw new Error([
      `No Playwright Chromium chrome.exe found under ${rel(path.join(stageDir, "ms-playwright"))}.`,
      "Set HERMILLS_DEEP_RESEARCH_PLAYWRIGHT_BROWSERS to a prewarmed cache, or allow the build script to run python -m playwright install chromium."
    ].join("\n"));
  }
  notes.push(`[verify] Found Chromium at ${rel(chromium[0])}.`);

  const importProbe = [
    "import importlib, sys",
    "mods = ['_cffi_backend', 'greenlet._greenlet', 'scrapling', 'playwright.sync_api', 'fastapi']",
    "failures = []",
    "for mod in mods:",
    "    try:",
    "        importlib.import_module(mod)",
    "    except Exception as exc:",
    "        failures.append(f'{mod}: {exc}')",
    "if failures:",
    "    raise SystemExit('Bundled deep-research Python dependency import check failed for ' + sys.version.split()[0] + ': ' + '; '.join(failures))",
    "print('deep-research import check ok for ' + sys.version.split()[0])"
  ].join("\n");
  await runCommand(path.join(stageDir, "python", "python.exe"), ["-c", importProbe], {
    cwd: stageDir,
    env: sidecarPythonEnv()
  });
  notes.push("[verify] Bundled Python can import Scrapling, Playwright, FastAPI, cffi, and greenlet.");
}

async function main() {
  if (args.help === true) {
    console.log(usage());
    return;
  }

  const sourceDir = path.resolve(option("source", "HERMILLS_DEEP_RESEARCH_SOURCE", defaultSourceDir));
  const runtimeDir = option("python-runtime", "HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME");
  if (!runtimeDir) {
    throw new Error([
      "Missing Python runtime input.",
      "Set HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME to a portable Windows Python runtime directory containing python.exe.",
      "This staging step intentionally fails early so the packaged app never silently depends on the user's system Python.",
      "",
      usage()
    ].join("\n"));
  }

  await assertDirectory(sourceDir, "Deep Research sidecar source", [
    "Set HERMILLS_DEEP_RESEARCH_SOURCE to the sidecar source directory, or pass --source <dir>.",
    "The default services/deep-research directory is not present in this checkout."
  ].join("\n"));
  await assertDirectory(path.resolve(runtimeDir), "Python runtime", "Set HERMILLS_DEEP_RESEARCH_PYTHON_RUNTIME to a portable Windows Python runtime directory containing python.exe.");

  const requirementsFile = option("requirements", "HERMILLS_DEEP_RESEARCH_REQUIREMENTS");
  const hasDependencyInput = !flag("skip-pip", "HERMILLS_DEEP_RESEARCH_SKIP_PIP")
    && Boolean(requirementsFile
      || await findFirstExisting([path.join(sourceDir, "requirements-win.txt"), path.join(sourceDir, "requirements.txt"), path.join(sourceDir, "pyproject.toml")]));
  const hasBrowserInput = Boolean(option("playwright-browsers", "HERMILLS_DEEP_RESEARCH_PLAYWRIGHT_BROWSERS")
    || await findFirstExisting([
      path.join(sourceDir, "ms-playwright"),
      path.join(sourceDir, ".playwright", "ms-playwright"),
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "ms-playwright") : undefined
    ]));
  await resetStageDirectory();
  await stageSidecarSource(sourceDir, path.join(stageDir, "app"));
  await stagePythonRuntime(path.resolve(runtimeDir), path.join(stageDir, "python"));
  await mkdir(path.join(stageDir, "python-site-packages"), { recursive: true });
  const packagedPython = runtimePythonCommand(path.join(stageDir, "python"));
  if (hasDependencyInput) await installPythonDependencies(packagedPython, sourceDir, path.join(stageDir, "python-site-packages"));
  else notes.push("[python] No dependency install needed for the provided inputs.");
  await stagePlaywrightBrowsers(packagedPython, sourceDir, path.join(stageDir, "ms-playwright"), path.join(stageDir, "python-site-packages"));
  await writeLauncher(stageDir);
  await writeManifest(stageDir, sourceDir);
  await validateStage();

  console.log("Hermills Windows sidecar resources staged.");
  console.log(`Resource path: ${engineResourcePath}`);
  console.log(`Stage dir: ${stageDir}`);
  for (const note of notes) console.log(`INFO ${note}`);
}

main().catch((error) => {
  console.error("Hermills Windows sidecar resource staging failed:");
  console.error(error.message);
  process.exit(1);
});
