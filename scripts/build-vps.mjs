import { fileURLToPath } from "node:url";

process.env.MOSTRADOR_TARGET = "vps";
process.env.NEXT_PUBLIC_BASE_PATH = "/casadelastartas";
const cli = new URL("../node_modules/vinext/dist/cli.js", import.meta.url);
process.argv = [process.execPath, fileURLToPath(cli), "build"];
await import(cli.href);
