import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, "..");
const planPath = path.join(mobileRoot, "assets-import-plan-0194.json");
const outputRoot = path.join(mobileRoot, "assets", "vendor", "polyhaven");
const userAgent = "WAFT-Adventure-Asset-Importer/0.19.4 (+https://github.com/xXENESISs/WAFT-2)";
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
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${response.status} al solicitar ${url}`);
  return response.json();
}

async function download(url, destination, maxBytes = 40_000_000) {
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`${response.status} al descargar ${url}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`archivo de ${declared} bytes supera el límite de ${maxBytes}`);
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > maxBytes) {
    throw new Error(`archivo real de ${data.length} bytes supera el límite de ${maxBytes}`);
  }
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
  if (record.trailText.includes(resolution)) score += 45;
  if (record.trailText.includes("lod0")) score += 5;
  if (record.trailText.includes("blend")) score -= 80;
  if (record.trailText.includes("fbx")) score -= 50;
  if (record.trailText.includes("8k") || record.trailText.includes("16k")) score -= 30;
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
      if (record.trailText.includes(resolution)) score += 55;
      if (aliases.some((alias) => record.trailText.includes(alias))) score += 70;
      if (extensionOf(record.url) === ".jpg") score += 8;
      if (extensionOf(record.url) === ".png") score += 5;
      if (record.trailText.includes("nor_dx") || record.trailText.includes("normal_dx")) score -= 150;
      if (record.trailText.includes("8k") || record.trailText.includes("16k")) score -= 35;
      return { record, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.record;
}

function assetBytes(asset) {
  return asset.files.reduce((sum, file) => sum + file.bytes, 0);
}

async function replaceDirectory(tempRoot, destinationRoot) {
  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.rename(tempRoot, destinationRoot);
}

async function importModel(definition) {
  const apiUrl = `https://api.polyhaven.com/files/${definition.id}`;
  const tree = await fetchJson(apiUrl);
  const records = walkFiles(tree).filter((record) => allowedExtensions.has(extensionOf(record.url)));
  const rootRecord = [...records].sort(
    (a, b) => scoreModelRoot(b, plan.resolution) - scoreModelRoot(a, plan.resolution),
  )[0];
  if (!rootRecord || scoreModelRoot(rootRecord, plan.resolution) < 100) {
    throw new Error(`no se encontró glTF ${plan.resolution}`);
  }

  const destinationRoot = path.join(outputRoot, definition.id);
  const tempRoot = `${destinationRoot}.importing`;
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  try {
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
      path.join(tempRoot, rootName),
      definition.maxDownloadedBytes ?? 30_000_000,
    );
    downloaded.push({ file: rootName, sourceUrl: rootRecord.url, ...rootResult });

    if (extensionOf(rootRecord.url) === ".gltf") {
      const gltf = JSON.parse(await fs.readFile(path.join(tempRoot, rootName), "utf8"));
      const uris = [
        ...(gltf.buffers ?? []).map((entry) => entry.uri),
        ...(gltf.images ?? []).map((entry) => entry.uri),
      ].filter((uri) => typeof uri === "string" && !uri.startsWith("data:"));

      for (const uri of [...new Set(uris)]) {
        const uriBase = path.basename(uri);
        const record = selectedRecords.get(uriBase)
          ?? records
            .filter((candidate) => fileNameOf(candidate.url) === uriBase)
            .sort((a, b) => {
              const a1k = a.trailText.includes(plan.resolution) ? 1 : 0;
              const b1k = b.trailText.includes(plan.resolution) ? 1 : 0;
              return b1k - a1k;
            })[0];
        if (!record) throw new Error(`dependencia no localizada: ${uri}`);
        const result = await download(record.url, path.join(tempRoot, uri), 20_000_000);
        downloaded.push({ file: uri, sourceUrl: record.url, ...result });
      }
    }

    await replaceDirectory(tempRoot, destinationRoot);
    return {
      id: definition.id,
      type: "model",
      category: definition.category,
      role: definition.role,
      sourcePage: `https://polyhaven.com/a/${definition.id}`,
      apiUrl,
      license: plan.license,
      resolution: plan.resolution,
      localRoot: `mallorca-mobile/assets/vendor/polyhaven/${definition.id}/`,
      entryFile: rootName,
      files: downloaded,
    };
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

async function importTexture(definition) {
  const apiUrl = `https://api.polyhaven.com/files/${definition.id}`;
  const tree = await fetchJson(apiUrl);
  const records = walkFiles(tree);
  const destinationRoot = path.join(outputRoot, definition.id);
  const tempRoot = `${destinationRoot}.importing`;
  await fs.rm(tempRoot, { recursive: true, force: true });
  await fs.mkdir(tempRoot, { recursive: true });

  try {
    const maps = {};
    const files = [];
    for (const mapName of definition.maps) {
      const record = selectTextureRecord(records, plan.resolution, mapName);
      if (!record) throw new Error(`no se encontró mapa ${mapName}`);
      const extension = extensionOf(record.url) || ".jpg";
      const localName = `${mapName}${extension}`;
      const result = await download(record.url, path.join(tempRoot, localName), 12_000_000);
      maps[mapName] = localName;
      files.push({ file: localName, sourceUrl: record.url, ...result });
    }

    await replaceDirectory(tempRoot, destinationRoot);
    return {
      id: definition.id,
      type: "texture",
      category: definition.category,
      role: definition.role,
      sourcePage: `https://polyhaven.com/a/${definition.id}`,
      apiUrl,
      license: plan.license,
      resolution: plan.resolution,
      localRoot: `mallorca-mobile/assets/vendor/polyhaven/${definition.id}/`,
      maps,
      files,
    };
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

const assets = [];
const rejected = [];
let totalBytes = 0;
const maxTotalBytes = Number(plan.maxTotalBytes) || 240_000_000;

async function attempt(definition, type, importer) {
  process.stdout.write(`Importing ${type} ${definition.id}... `);
  try {
    const asset = await importer(definition);
    const bytes = assetBytes(asset);
    if (totalBytes + bytes > maxTotalBytes) {
      await fs.rm(path.join(outputRoot, definition.id), { recursive: true, force: true });
      throw new Error(`superaría el presupuesto global de ${maxTotalBytes} bytes`);
    }
    totalBytes += bytes;
    assets.push(asset);
    console.log(`${(bytes / 1_048_576).toFixed(2)} MB`);
  } catch (error) {
    rejected.push({
      id: definition.id,
      type,
      category: definition.category,
      role: definition.role,
      reason: error instanceof Error ? error.message : String(error),
      sourcePage: `https://polyhaven.com/a/${definition.id}`,
    });
    console.log(`REJECTED: ${rejected.at(-1).reason}`);
  }
}

for (const model of plan.models) await attempt(model, "model", importModel);
for (const texture of plan.textures) await attempt(texture, "texture", importTexture);

const categoryCounts = assets.reduce((counts, asset) => {
  counts[asset.category] = (counts[asset.category] ?? 0) + 1;
  return counts;
}, {});

const manifest = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  importer: "WAFT Adventure Asset Importer 0.19.4",
  provider: plan.provider,
  providerUrl: plan.providerUrl,
  apiCredit: plan.apiCredit,
  license: plan.license,
  resolution: plan.resolution,
  totalBytes,
  maxTotalBytes,
  categoryCounts,
  importedCount: assets.length,
  rejectedCount: rejected.length,
  assets,
  rejected,
};

await fs.writeFile(
  path.join(outputRoot, "import-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await fs.writeFile(
  path.join(outputRoot, "LICENSE.txt"),
  "Poly Haven assets are dedicated to the public domain under CC0 1.0.\nSource URLs, file sizes and SHA-256 hashes are recorded in import-manifest.json.\n",
);

console.log(`Imported ${assets.length} assets (${(totalBytes / 1_048_576).toFixed(1)} MB); rejected ${rejected.length}.`);
if (assets.length < 35) {
  throw new Error(`La ampliación quedó por debajo del mínimo: ${assets.length} assets importados.`);
}
