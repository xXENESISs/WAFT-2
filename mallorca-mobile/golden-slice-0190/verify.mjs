import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const requiredFiles = [
  "index.html",
  "styles.css",
  "README.md",
  "js/config.js",
  "js/input-controller.js",
  "js/main.js",
  "js/player-controller.js",
  "js/save-store.js",
  "js/scene-builder.js",
];

await Promise.all(requiredFiles.map((path) => access(resolve(root, path))));

const html = await readFile(resolve(root, "index.html"), "utf8");
const config = await readFile(resolve(root, "js/config.js"), "utf8");
const saveStore = await readFile(resolve(root, "js/save-store.js"), "utf8");
const codeFiles = requiredFiles.filter((path) => path.endsWith(".js") || path.endsWith(".html"));
const allSource = await Promise.all(codeFiles.map((path) => readFile(resolve(root, path), "utf8")));
const joined = allSource.join("\n");

const assertions = [
  [html.includes('./styles.css'), "index.html debe cargar styles.css"],
  [html.includes('./js/main.js'), "index.html debe cargar main.js"],
  [html.includes('babylon.js'), "index.html debe cargar Babylon.js"],
  [config.includes('version: "0.19.0"'), "config.js debe declarar la versión 0.19.0"],
  [saveStore.includes('waft.adventure.goldenSlice.0.19.0') || config.includes('waft.adventure.goldenSlice.0.19.0'), "el guardado debe usar su clave aislada"],
  [!joined.includes('waft.adventure.0170.world.v1'), "la golden slice no debe escribir en el guardado protegido 0.17.0"],
  [!joined.includes('waft-0170.html'), "la golden slice no debe depender del HTML protegido"],
];

for (const [condition, message] of assertions) {
  if (!condition) throw new Error(message);
}

console.log(`WAFT Golden Slice 0.19.0: ${requiredFiles.length} archivos verificados.`);
