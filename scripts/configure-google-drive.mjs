import { chmod, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const clientId = "620503194734-fllssfmohuthr2k0s25aj8ajvlg88dst.apps.googleusercontent.com";
const defaultFile = join(homedir(), "Downloads", `client_secret_${clientId}.json`);
const sourceFile = resolve(process.argv[2] || defaultFile);
const oauth = JSON.parse(await readFile(sourceFile, "utf8"));
const client = oauth.installed;

if (!client || client.client_id !== clientId || typeof client.client_secret !== "string" || !client.client_secret)
  throw new Error("El archivo no es el cliente OAuth Desktop esperado de Casa de las Tartas.");

const generatedFile = new URL("../electron/drive-config.local.cjs", import.meta.url);
await writeFile(
  generatedFile,
  `// Generated from the local Google OAuth Desktop JSON. Never commit this file.\nmodule.exports = { clientSecret: ${JSON.stringify(client.client_secret)} };\n`,
  { mode: 0o600 },
);
await chmod(generatedFile, 0o600);
console.log("Credencial local de Drive preparada para desarrollo y empaquetado; no se agregó al repositorio.");
