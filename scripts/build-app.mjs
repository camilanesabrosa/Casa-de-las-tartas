// Empaqueta el servidor Node que corre dentro de la aplicación de escritorio.
// Igual que el build del VPS, pero servido desde la raíz: la app abre su propio
// servidor en 127.0.0.1 y no cuelga de ningún prefijo.
import { fileURLToPath } from "node:url";

process.env.MOSTRADOR_TARGET = "app";
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), "build"];
await import(cli.href);
