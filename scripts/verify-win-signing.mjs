import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const powershellCandidates = process.platform === "win32"
  ? [process.env.PWSH || "pwsh", "powershell"]
  : [process.env.PWSH || "pwsh"];

function psString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function signatureStatus(filePath) {
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `$sig = Get-AuthenticodeSignature -LiteralPath ${psString(filePath)}`,
    "$result = [pscustomobject]@{ Status = [string]$sig.Status; StatusMessage = [string]$sig.StatusMessage; Subject = [string]$sig.SignerCertificate.Subject; Issuer = [string]$sig.SignerCertificate.Issuer; Thumbprint = [string]$sig.SignerCertificate.Thumbprint }",
    "$result | ConvertTo-Json -Compress",
  ].join("; ");

  let lastError;
  for (const executable of powershellCandidates) {
    try {
      const { stdout } = await execFileAsync(executable, ["-NoProfile", "-Command", command], {
        cwd: root,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      return JSON.parse(stdout.trim());
    } catch (error) {
      lastError = error;
      if (error.code !== "ENOENT") break;
    }
  }

  try {
    throw lastError;
  } catch (error) {
    return {
      Status: "Error",
      StatusMessage: `${error.message}${error.stderr ? `\n${error.stderr}` : ""}`,
      Subject: "",
      Issuer: "",
      Thumbprint: "",
    };
  }
}

async function main() {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const checks = [
    path.join(root, "release", "win-unpacked", "Hermills.exe"),
    path.join(root, "release", `Hermills-${packageJson.version}-x64-setup.exe`),
  ];
  const failures = [];

  console.log("Hermills Windows signing verification");
  for (const filePath of checks) {
    const status = await signatureStatus(filePath);
    const relative = path.relative(root, filePath);
    if (status.Status === "Valid") {
      console.log(`INFO [signed] ${relative}`);
      console.log(`  Subject: ${status.Subject}`);
      console.log(`  Issuer: ${status.Issuer}`);
      console.log(`  Thumbprint: ${status.Thumbprint}`);
      continue;
    }
    failures.push({ relative, status });
    console.error(`FAIL [unsigned] ${relative}`);
    console.error(`  Status: ${status.Status}`);
    console.error(`  Message: ${status.StatusMessage}`);
  }

  if (failures.length > 0) {
    console.error("\nWindows signing verification failed.");
    console.error("Provide a trusted OV/EV code-signing certificate through WIN_CSC_LINK or CSC_LINK, set WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD, then rebuild with npm run build:win:signed.");
    process.exit(1);
  }

  console.log("\nWindows signing verification passed.");
}

main().catch((error) => {
  console.error("Windows signing verification crashed:");
  console.error(error);
  process.exit(1);
});
