import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getHermillsHome } from "@hermills/core";

const SECURE_DIR_MODE = 0o700;
const SECRET_FILE_MODE = 0o600;

interface Envelope {
  version: 1;
  iv: string;
  tag: string;
  value: string;
}

export class LocalCredentialVault {
  private readonly keyPath: string;
  private readonly secureDir: string;

  constructor(private readonly baseDir = getHermillsHome()) {
    this.secureDir = path.join(this.baseDir, "secure");
    this.keyPath = path.join(this.secureDir, "vault.key");
  }

  async saveSecret(id: string, secret: string): Promise<string> {
    const key = await this.getOrCreateKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const value = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    const envelope: Envelope = { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), value: value.toString("base64") };
    const ref = `credential:${id}`;
    const secretPath = this.secretPath(ref);
    await this.ensureSecureDir();
    await writeFile(secretPath, `${JSON.stringify(envelope)}\n`, { encoding: "utf8", mode: SECRET_FILE_MODE });
    await this.repairSecretFileMode(secretPath);
    return ref;
  }

  async readSecret(ref: string): Promise<string | undefined> {
    try {
      const key = await this.getOrCreateKey();
      const secretPath = this.secretPath(ref);
      await this.repairSecretFileMode(secretPath);
      const rawEnvelope = await readFile(secretPath, "utf8");
      const envelope = JSON.parse(rawEnvelope) as Envelope;
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
      decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(envelope.value, "base64")), decipher.final()]).toString("utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async deleteSecret(ref: string): Promise<void> {
    await this.ensureSecureDir();
    try {
      await unlink(this.secretPath(ref));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }

  private secretPath(ref: string): string {
    return path.join(this.secureDir, `${ref.replace(/[^a-zA-Z0-9:_-]/g, "_")}.json`);
  }

  private async getOrCreateKey(): Promise<Buffer> {
    await this.ensureSecureDir();
    try {
      await this.repairSecretFileMode(this.keyPath);
      const encodedKey = await readFile(this.keyPath, "utf8");
      return Buffer.from(encodedKey, "base64");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const key = randomBytes(32);
      await writeFile(this.keyPath, key.toString("base64"), { encoding: "utf8", mode: SECRET_FILE_MODE });
      await this.repairSecretFileMode(this.keyPath);
      return key;
    }
  }

  private async ensureSecureDir(): Promise<void> {
    await mkdir(this.secureDir, { recursive: true, mode: SECURE_DIR_MODE });
    await chmod(this.secureDir, SECURE_DIR_MODE);
  }

  private async repairSecretFileMode(filePath: string): Promise<void> {
    await chmod(filePath, SECRET_FILE_MODE);
  }
}
