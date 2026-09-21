import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
const temp = await mkdtemp(join(tmpdir(), "mostrador-test-"));
try {
  const outfile = join(temp, "business-test.mjs");
  await build({
    stdin: {
      contents: 'import "./tests/business.test.ts"; import "./tests/calendar.test.ts"; import "./tests/update-ui.test.tsx"; import "./tests/daily-sales.test.tsx";',
      resolveDir: process.cwd(),
      loader: "ts",
    },
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
  });
  const result = spawnSync(process.execPath, ["--test", outfile, resolve("tests/updater.test.mjs")], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
