import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "build", "icon.ico");
const sources = [
  "build/icon.iconset/icon_16x16.png",
  "build/icon.iconset/icon_32x32.png",
  "build/icon.iconset/icon_128x128.png",
  "build/icon.iconset/icon_256x256.png"
].map((file) => path.join(root, file));

function pngDimensions(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature || buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("Invalid PNG file.");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

const images = [];
for (const source of sources) {
  if (!(await pathExists(source))) continue;
  const buffer = await readFile(source);
  const dimensions = pngDimensions(buffer);
  if (dimensions.width !== dimensions.height) throw new Error(`Icon source must be square: ${source}`);
  images.push({ ...dimensions, buffer, source });
}

if (images.length === 0) throw new Error("No PNG icon sources found under build/icon.iconset.");

const headerSize = 6;
const entrySize = 16;
const directorySize = headerSize + images.length * entrySize;
const header = Buffer.alloc(directorySize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);

let offset = directorySize;
for (const [index, image] of images.entries()) {
  const entryOffset = headerSize + index * entrySize;
  header.writeUInt8(image.width >= 256 ? 0 : image.width, entryOffset);
  header.writeUInt8(image.height >= 256 ? 0 : image.height, entryOffset + 1);
  header.writeUInt8(0, entryOffset + 2);
  header.writeUInt8(0, entryOffset + 3);
  header.writeUInt16LE(1, entryOffset + 4);
  header.writeUInt16LE(32, entryOffset + 6);
  header.writeUInt32LE(image.buffer.length, entryOffset + 8);
  header.writeUInt32LE(offset, entryOffset + 12);
  offset += image.buffer.length;
}

await writeFile(outputPath, Buffer.concat([header, ...images.map((image) => image.buffer)]));
console.log(`Wrote ${path.relative(root, outputPath)} with ${images.length} image sizes.`);
