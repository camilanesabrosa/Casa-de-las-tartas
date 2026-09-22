import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseUpdateInfo } from "electron-updater/out/providers/Provider.js";
import updater from "../electron/updater.cjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export async function prepareDownload(root = projectRoot) {
  const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const release = join(root, "release");
  const manifestText = await readFile(join(release, "latest.yml"), "utf8");
  const manifest = parseUpdateInfo(manifestText, "latest.yml", "https://sinnick.dev/cdt/update/latest.yml");
  if (manifest.version !== version || !updater.validRelease(manifest, "0.0.0"))
    throw new Error("El manifiesto no corresponde al instalador Windows x64 de la versión actual. Ejecutá npm run app:dist:win.");

  const filename = manifest.files[0].url;
  const installer = join(release, filename);
  const size = (await stat(installer)).size;
  if (manifest.files[0].size !== size) throw new Error("El tamaño del instalador no coincide con latest.yml.");
  const sha512 = createHash("sha512");
  const sha256 = createHash("sha256");
  for await (const chunk of createReadStream(installer)) {
    sha512.update(chunk);
    sha256.update(chunk);
  }
  if (sha512.digest("base64") !== manifest.files[0].sha512)
    throw new Error("El SHA-512 del instalador no coincide con latest.yml. No se preparó la descarga.");
  if (!(await stat(`${installer}.blockmap`)).size) throw new Error("Falta el blockmap del instalador.");

  const template = await readFile(new URL("../deployment/download/index.template.html", import.meta.url), "utf8");
  const html = template
    .replaceAll("{{VERSION}}", version)
    .replaceAll("{{INSTALLER}}", filename)
    .replaceAll("{{SIZE_MB}}", new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(size / 1_000_000));
  const directory = join(release, "cdt");
  const updateDirectory = join(directory, "update");
  await mkdir(updateDirectory, { recursive: true });
  await copyFile(installer, join(updateDirectory, filename));
  await copyFile(`${installer}.blockmap`, join(updateDirectory, `${filename}.blockmap`));
  await writeFile(join(directory, "index.html"), html);
  await writeFile(join(updateDirectory, "latest.yml"), manifestText);
  return { directory, filename, version, bytes: size, sha256: sha256.digest("hex") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await prepareDownload();
  console.log(JSON.stringify(result, null, 2));
  console.log("Subí el contenido de release/cdt/ a /cdt/ del sitio. Publicá update/latest.yml al final.");
}
