import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const temp = await mkdtemp(join(tmpdir(), "mostrador-test-"));
try {
  const outfile = join(temp, "business-test.mjs");
  await build({
    stdin: {
      contents: 'import "./tests/business.test.ts"; import "./tests/calendar.test.ts";',
      resolveDir: process.cwd(),
      loader: "ts",
    },
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
  });
  const result = spawnSync(process.execPath, ["--test", outfile], {
    stdio: "inherit",
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
