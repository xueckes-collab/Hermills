import { existsSync } from "node:fs";
import path from "node:path";

const cscLink = process.env.WIN_CSC_LINK || process.env.CSC_LINK || "";
const cscPassword = process.env.WIN_CSC_KEY_PASSWORD || process.env.CSC_KEY_PASSWORD || "";
const allowStoreSigning = process.env.HERMILLS_ALLOW_CERT_STORE_SIGNING === "1";
const failures = [];

if (!allowStoreSigning) {
  if (!cscLink.trim()) {
    failures.push("Set WIN_CSC_LINK or CSC_LINK to a trusted .pfx/.p12 code-signing certificate.");
  } else if (!looksRemoteOrInline(cscLink) && !existsSync(path.resolve(cscLink))) {
    failures.push(`Signing certificate file was not found: ${cscLink}`);
  }

  if (!cscPassword.trim()) {
    failures.push("Set WIN_CSC_KEY_PASSWORD or CSC_KEY_PASSWORD to the certificate password.");
  }
}

if (failures.length > 0) {
  console.error("Windows signing credentials are not ready:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("\nFor hardware-token or certificate-store signing, configure electron-builder.win-signed.yml and set HERMILLS_ALLOW_CERT_STORE_SIGNING=1.");
  process.exit(1);
}

console.log(allowStoreSigning ? "Windows certificate-store signing preflight skipped by HERMILLS_ALLOW_CERT_STORE_SIGNING=1." : "Windows .pfx/.p12 signing credentials are present.");

function looksRemoteOrInline(value) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^data:/i.test(value) || /^[A-Za-z0-9+/=]{80,}$/.test(value.trim());
}
