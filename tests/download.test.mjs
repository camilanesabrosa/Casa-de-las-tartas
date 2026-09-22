import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { prepareDownload } from "../scripts/prepare-download.mjs";

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "cdt-download-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const version = "0.2.0";
  const filename = `Casa-de-las-Tartas-${version}-win-x64-Setup.exe`;
  const payload = Buffer.from("Installer fixture, not an executable.");
  const manifest = { version, files: [{ url: filename,
    sha512: createHash("sha512").update(payload).digest("base64"), size: payload.length }], ...overrides };
  const release = join(root, "release");
  await mkdir(release);
  await writeFile(join(root, "package.json"), JSON.stringify({ version }));
  await writeFile(join(release, filename), payload);
  await writeFile(join(release, `${filename}.blockmap`), "blockmap fixture");
  await writeFile(join(release, "latest.yml"), JSON.stringify(manifest));
  return { root, release, filename, payload, manifest };
}

test("descarga: prepara HTML y archivos del canal con una sola copia del instalador", async (t) => {
  const { root, filename, payload } = await fixture(t);
  const result = await prepareDownload(root);
  const html = await readFile(join(result.directory, "index.html"), "utf8");
  assert.ok(html.includes(`href="update/${filename}" download`));
  assert.ok(html.includes("v0.2.0"));
  assert.ok(!html.includes("{{"));
  assert.ok(!/<script|https?:\/\//.test(html), "HTML sin JavaScript ni dependencias de red");
  assert.deepEqual(await readdir(result.directory), ["index.html", "update"]);
  assert.deepEqual(await readFile(join(result.directory, "update", filename)), payload);
  assert.equal(result.sha256, createHash("sha256").update(payload).digest("hex"));
  assert.equal((await readdir(join(result.directory, "update"))).length, 3);
});

test("descarga: no prepara archivos si el manifiesto es de otra versión", async (t) => {
  const { root, release } = await fixture(t, { version: "0.1.0" });
  await assert.rejects(prepareDownload(root), /versión actual/);
  assert.ok(!(await readdir(release)).includes("cdt"));
});

test("descarga: rechaza un instalador alterado aunque tenga el mismo tamaño", async (t) => {
  const { root, release, filename, payload } = await fixture(t);
  await writeFile(join(release, filename), Buffer.alloc(payload.length, 65));
  await assert.rejects(prepareDownload(root), /SHA-512/);
  assert.ok(!(await readdir(release)).includes("cdt"));
});
