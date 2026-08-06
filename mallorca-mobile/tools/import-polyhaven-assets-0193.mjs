import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, "..");
const planPath = path.join(mobileRoot, "assets-import-plan-0193.json");
const outputRoot = path.join(mobileRoot, "assets", "vendor", "polyhaven");
const userAgent = "WAFT-Adventure-Asset-Importer/0.19.3 (+https://github.com/xXENESISs/WAFT-2)";
const allowedExtensions = new Set([".gltf", ".glb", ".bin", ".jpg", ".jpeg", ".png", ".webp"]);

const plan = JSON.parse(await fs.readFile(planPath, "utf8"));
await fs.mkdir(outputRoot, { recursive: true });

function walkFiles(value, trail = [], records = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkFiles(item, [...trail, String(index)], records));
    return records;
  }
  if (!value || typeof value !== "object") return records;

  if (typeof value.url === "string") {
    records.push({
      node: value,
      trail,
      trailText: trail.join("/").toLowerCase(),
      url: value.url,
      size: Number(value.size) || null,
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== "url") walkFiles(child, [...trail, key], records);
  }
  return records;
}

function extensionOf(url) {
  return path.extname(new URL(url).pathname).toLowerCase();
}

function fileNameOf(url) {
  return decodeURIComponent(path.basename(new URL(url).pathname));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} al solicitar ${url}`);
  return response.json();
}

async function download(url, destination, maxBytes = 40_000_000) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`${response.status} al descargar ${url}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`El archivo supera el límite (${declared} bytes): ${url}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) throw new Error(`El archivo supera el límite real: ${url}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, data);
  return {
    bytes: data.length,
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
  };
}

function scoreModelRoot(record, resolution) {
  const ext = extensionOf(record.url);
  let score = 0;
  if (ext === ".gltf") score += 100;
  if (ext === ".glb") score += 90;
  if (record.trailText.includes("gltf")) score += 35;
  if (record.trailText.includes(resolution)) score += 30;
  if (record.trailText.includes("blend")) score -= 80;
  if (record.trailText.includes("fbx")) score -= 50;
  return score;
}

function selectTextureRecord(records, resolution, mapName) {
  const aliases = {
    diffuse: ["diff", "diffuse", "albedo"],
    normal_gl: ["nor_gl", "normal_gl", "normalgl"],
    roughness: ["rough", "roughness"],
  }[mapName] ?? [mapName];

  return records
    .filter((record) => [".jpg", ".jpeg", ".png", ".webp"].includes(extensionOf(record.url)))
    .map((record) => {
      let score = 0;
      if (record.trailText.includes(resolution)) score += 40;
      if (aliases.some((alias) => record.trailText.includes(alias))) score += 60;
      if (extensionOf(record.url) === ".jpg") score += 8;
      if (extensionOf(record.url) === ".png") score += 5;
      if (record.trailText.includes("nor_dx") || record.trailText.includes("normal_dx")) score -= 100;
      return { record, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.record;
}

async function importModel(definition) {
  const apiUrl = `https://api.polyhaven.com/files/${definition.id}`;
  const tree = await fetchJson(apiUrl);
  const records = walkFiles(tree).filter((record) => allowedExtensions.has(extensionOf(record.url)));
  const rootRecord = [...records].sort(
    (a, b) => scoreModelRoot(b, plan.resolution) - scoreModelRoot(a, plan.resolution),
  )[0];
  if (!rootRecord || scoreModelRoot(rootRecord, plan.resolution) < 100) {
    throw new Error(`No se encontró glTF ${plan.resolution} para ${definition.id}`);
  }

  const destinationRoot = path.join(outputRoot, definition.id);
  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(destinationRoot, { recursive: true });

  const selectedRecords = new Map();
  const rootName = fileNameOf(rootRecord.url);
  selectedRecords.set(rootName, rootRecord);

  for (const record of walkFiles(rootRecord.node)) {
    const ext = extensionOf(record.url);
    if (allowedExtensions.has(ext)) selectedRecords.set(fileNameOf(record.url), record);
  }

  const downloaded = [];
  const rootResult = await download(
    rootRecord.url,
    path.join(destinationRoot, rootName),
    definition.maxDownloadedBytes ?? 30_000_000,
  );
  downloaded.push({ file: rootName, sourceUrl: rootRecord.url, ...rootResult });

  if (extensionOf(rootRecord.url) === ".gltf") {
    const gltf = JSON.parse(await fs.readFile(path.join(destinationRoot, rootName), "utf8"));
    const uris = [
      ...(gltf.buffers ?? []).map((entry) => entry.uri),
      ...(gltf.images ?? []).map((entry) => entry.uri),
    ].filter((uri) => typeof uri === "string" && !uri.startsWith("data:"));

    for (const uri of uris) {
      const uriBase = path.basename(uri);
      const record = selectedRecords.get(uriBase)
        ?? records.find((candidate) => fileNameOf(candidate.url) === uriBase);
      if (!record) throw new Error(`Dependencia no localizada para ${definition.id}: ${uri}`);
      const result = await download(record.url, path.join(destinationRoot, uri), 20_000_000);
      downloaded.push({ file: uri, sourceUrl: record.url, ...result });
    }
  }

  return {
    id: definition.id,
    type: "model",
    role: definition.role,
    sourcePage: `https://polyhaven.com/a/${definition.id}`,
    apiUrl,
    license: plan.license,
    resolution: plan.resolution,
    localRoot: `mallorca-mobile/assets/vendor/polyhaven/${definition.id}/`,
    entryFile: rootName,
    files: downloaded,
  };
}

async function importTexture(definition) {
  const apiUrl = `https://api.polyhaven.com/files/${definition.id}`;
  const tree = await fetchJson(apiUrl);
  const records = walkFiles(tree);
  const destinationRoot = path.join(outputRoot, definition.id);
  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(destinationRoot, { recursive: true });

  const maps = {};
  const files = [];
  for (const mapName of definition.maps) {
    const record = selectTextureRecord(records, plan.resolution, mapName);
    if (!record) throw new Error(`No se encontró mapa ${mapName} para ${definition.id}`);
    const extension = extensionOf(record.url) || ".jpg";
    const localName = `${mapName}${extension}`;
    const result = await download(record.url, path.join(destinationRoot, localName), 12_000_000);
    maps[mapName] = localName;
    files.push({ file: localName, sourceUrl: record.url, ...result });
  }

  return {
    id: definition.id,
    type: "texture",
    role: definition.role,
    sourcePage: `https://polyhaven.com/a/${definition.id}`,
    apiUrl,
    license: plan.license,
    resolution: plan.resolution,
    localRoot: `mallorca-mobile/assets/vendor/polyhaven/${definition.id}/`,
    maps,
    files,
  };
}

const assets = [];
for (const model of plan.models) assets.push(await importModel(model));
for (const texture of plan.textures) assets.push(await importTexture(texture));

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  importer: "WAFT Adventure Asset Importer 0.19.3",
  provider: plan.provider,
  providerUrl: plan.providerUrl,
  apiCredit: plan.apiCredit,
  license: plan.license,
  assets,
};
await fs.writeFile(path.join(outputRoot, "import-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(outputRoot, "LICENSE.txt"), "Poly Haven assets are dedicated to the public domain under CC0 1.0.\nSource and hashes are recorded in import-manifest.json.\n");
console.log(`Imported ${assets.length} CC0 assets from Poly Haven.`);
