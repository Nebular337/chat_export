import vm from "node:vm";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export async function loadGlobalApi(relativePath, key) {
  const source = await fs.readFile(path.join(__dirname, relativePath), "utf8");
  const context = {
    globalThis: {},
    console,
    URL
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  return context.globalThis.CopilotExporter[key];
}
