// Run Electron against the source renderer with HMR, without building a release.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const root = fileURLToPath(new URL("../", import.meta.url));
const data = resolve(process.env.CASA_TEST_DATA_DIR || join(root, ".sites-runtime", "desktop-dev"));
mkdirSync(data, { recursive: true });
async function port(preferred = 0) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(preferred, "127.0.0.1", resolve);
  });
  const selected = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return selected;
}
const serverPort = await port();
const debuggingPort = await port(9222).catch(() => port());
const url = `http://localhost:${serverPort}/`;
const framework = spawn(process.execPath, [join(root, "scripts/run-framework.mjs"), "dev", "--port", String(serverPort)], {
  cwd: root, stdio: "inherit", env: { ...process.env, MOSTRADOR_TARGET: "app", MOSTRADOR_DATABASE_PATH: join(data, "business.sqlite") },
});
let electron;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  electron?.kill("SIGTERM");
  framework.kill("SIGTERM");
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
framework.on("error", (error) => { console.error(error.message); stop(1); });
framework.on("exit", (code) => stop(code || 0));
try {
  const deadline = Date.now() + 60000;
  while (!stopping) {
    try {
      const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(2000) });
      if (response.ok) break;
    } catch { /* Vite is still starting. */ }
    if (Date.now() >= deadline) throw new Error("El servidor dev no arrancó a tiempo.");
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!stopping) {
    console.log(`Electron dev: ${url} | CDP: ${debuggingPort}`);
    const binary = createRequire(import.meta.url)("electron");
    const electronEnv = { ...process.env };
    delete electronEnv.ELECTRON_RUN_AS_NODE;
    electron = spawn(binary, [root, `--casa-dev-url=${url}`, `--casa-dev-data-dir=${data}`, `--remote-debugging-port=${debuggingPort}`], { cwd: root, stdio: "inherit", env: electronEnv });
    electron.on("error", (error) => { console.error(error.message); stop(1); });
    electron.on("exit", (code) => stop(code || 0));
  }
} catch (error) { console.error(error.message); stop(1); }
