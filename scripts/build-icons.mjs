import sharp from "sharp";
import { copyFile, mkdir, writeFile } from "node:fs/promises";

const source = new URL("../public/brand/icon.svg", import.meta.url);
const directory = new URL("../electron/assets/", import.meta.url);
await mkdir(directory, { recursive: true });
await copyFile(source, new URL("../public/favicon.svg", import.meta.url));
const png = (size) =>
  sharp(source.pathname).resize(size, size).png().toBuffer();
await writeFile(new URL("icon.png", directory), await png(1024));

// Windows ICO: one PNG entry for each taskbar, shortcut and installer size.
const sizes = [16, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(png));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, i) => {
  const entry = 6 + i * 16;
  header[entry] = header[entry + 1] = sizes[i] % 256;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(
  new URL("icon.ico", directory),
  Buffer.concat([header, ...images]),
);

// macOS ICNS with standard and Retina PNG representations.
const types = {
  icp4: 16,
  icp5: 32,
  icp6: 64,
  ic07: 128,
  ic08: 256,
  ic09: 512,
  ic10: 1024,
};
const chunks = await Promise.all(
  Object.entries(types).map(async ([type, size]) => {
    const image = await png(size);
    const chunk = Buffer.alloc(8);
    chunk.write(type);
    chunk.writeUInt32BE(image.length + 8, 4);
    return Buffer.concat([chunk, image]);
  }),
);
const icns = Buffer.alloc(8);
icns.write("icns");
icns.writeUInt32BE(8 + chunks.reduce((n, chunk) => n + chunk.length, 0), 4);
await writeFile(
  new URL("icon.icns", directory),
  Buffer.concat([icns, ...chunks]),
);
console.log("Íconos generados en electron/assets/.");
