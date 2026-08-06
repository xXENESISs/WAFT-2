import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, "..");
const outputPath = path.join(mobileRoot, "assets-shortlist-0194.json");
const userAgent = "WAFT-Adventure-Asset-Discovery/0.19.4 (+https://github.com/xXENESISs/WAFT-2)";

const groups = {
  models: [
    { id: "containers", terms: ["barrel", "crate", "basket", "sack", "bucket", "container"], limit: 18 },
    { id: "farmhouse-furniture", terms: ["table", "chair", "stool", "bench", "cabinet", "shelf", "cupboard"], limit: 18 },
    { id: "rural-props", terms: ["lantern", "lamp", "jug", "jar", "pot", "vase", "bottle", "watering", "tool", "cart", "wheelbarrow", "rope"], limit: 24 },
    { id: "architecture", terms: ["door", "window", "gate", "well", "roof", "shutter", "fence"], limit: 18 },
    { id: "vegetation", terms: ["olive", "pine", "tree", "shrub", "bush", "grass", "plant"], limit: 24 },
    { id: "rocks", terms: ["rock", "boulder", "cliff", "stone"], limit: 18 },
  ],
  textures: [
    { id: "walls", terms: ["plaster", "stucco", "stone wall", "limestone", "sandstone", "masonry", "brick"], limit: 24 },
    { id: "roofs", terms: ["roof tile", "roofing", "terracotta", "clay tile"], limit: 16 },
    { id: "ground", terms: ["dirt", "gravel", "path", "cobblestone", "sand", "ground", "soil", "rock"], limit: 28 },
    { id: "wood", terms: ["wood", "plank", "timber", "door"], limit: 20 },
    { id: "vegetation", terms: ["grass", "leaf", "foliage", "bark", "moss"], limit: 20 },
  ],
};

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`${response.status} al solicitar ${url}`);
  return response.json();
}

function flatten(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flatten(item, output));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => flatten(item, output));
  } else if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
  }
  return output;
}

function normalizeCatalog(payload) {
  if (Array.isArray(payload)) {
    return payload.map((metadata) => ({ id: metadata.id ?? metadata.slug, metadata }));
  }
  return Object.entries(payload).map(([id, metadata]) => ({ id, metadata }));
}

function numeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function downloadsOf(metadata) {
  for (const key of ["download_count", "downloads", "downloadCount"]) {
    if (metadata?.[key] !== undefined) return numeric(metadata[key]);
  }
  return 0;
}

function polycountOf(metadata) {
  for (const key of ["polycount", "triangles", "tris", "vertices"]) {
    if (metadata?.[key] !== undefined) return metadata[key];
  }
  return null;
}

function summarize(entry) {
  const { id, metadata } = entry;
  return {
    id,
    name: metadata?.name ?? metadata?.title ?? id,
    categories: metadata?.categories ?? metadata?.category ?? [],
    tags: metadata?.tags ?? [],
    downloads: downloadsOf(metadata),
    polycount: polycountOf(metadata),
    dimensions: metadata?.dimensions ?? metadata?.dimension ?? null,
    datePublished: metadata?.date_published ?? metadata?.published ?? metadata?.datePublished ?? null,
    sourcePage: `https://polyhaven.com/a/${id}`,
  };
}

function shortlist(catalog, definitions) {
  return definitions.map((definition) => {
    const matches = catalog
      .map((entry) => {
        const haystack = `${entry.id} ${flatten(entry.metadata).join(" ")}`.toLowerCase();
        let relevance = 0;
        const matchedTerms = [];
        for (const term of definition.terms) {
          if (haystack.includes(term.toLowerCase())) {
            relevance += term.includes(" ") ? 8 : 4;
            matchedTerms.push(term);
          }
        }
        if (!relevance) return null;
        relevance += Math.log10(downloadsOf(entry.metadata) + 1);
        return { ...summarize(entry), matchedTerms, relevance: Number(relevance.toFixed(3)) };
      })
      .filter(Boolean)
      .sort((a, b) => b.relevance - a.relevance || b.downloads - a.downloads)
      .slice(0, definition.limit);
    return { id: definition.id, terms: definition.terms, matches };
  });
}

const [modelPayload, texturePayload] = await Promise.all([
  fetchJson("https://api.polyhaven.com/assets?t=models"),
  fetchJson("https://api.polyhaven.com/assets?t=textures"),
]);

const modelCatalog = normalizeCatalog(modelPayload);
const textureCatalog = normalizeCatalog(texturePayload);
const report = {
  version: "0.19.4",
  generatedAt: new Date().toISOString(),
  provider: "Poly Haven",
  apiCredit: "Powered by Poly Haven",
  modelCatalogSize: modelCatalog.length,
  textureCatalogSize: textureCatalog.length,
  models: shortlist(modelCatalog, groups.models),
  textures: shortlist(textureCatalog, groups.textures),
};

await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Shortlisted assets from ${modelCatalog.length} models and ${textureCatalog.length} textures.`);
