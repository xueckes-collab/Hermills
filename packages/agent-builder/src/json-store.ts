import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class JsonFileStore<T> {
  constructor(private readonly filePath: string, private readonly fallback: T) {}

  async read(): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return this.fallback;
      throw error;
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(tmpPath, this.filePath);
  }
}
