import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'world-generator', 'configs', 'visual-system-v1.json');
const OUTPUT_ROOT = path.join(ROOT, 'world-generator', 'generated', 'visual-recipes');
const REPORT_PATH = path.join(ROOT, 'world-generator', 'visual-recipe-build-report.json');
const INDEX_PATH = path.join(OUTPUT_ROOT, 'index.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function stableJson(value, spacing = 0) {
  return JSON.stringify(stableValue(value), null, spacing);
}

function indexById(items, label) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.id) throw new Error(`${label} contains an item without id`);
    if (map.has(item.id)) throw new Error(`${label} contains duplicate id ${item.id}`);
    map.set(item.id, item);
  }
  return map;
}

function unique(values) {
  return [...new Set(values)];
}

function resolveQuality(profile) {
  return {
    profileId: profile.id,
    targetFps: profile.targetFps,
    hardBudgets: Object.fromEntries(
      Object.entries(profile.budgets).map(([key, value]) => [key, value.hardMaximum])
    )
  };
}

function normalizeArchitectureWeights(weightMap) {
  const total = [...weightMap.values()].reduce((sum, item) => sum + item.weight, 0);
  if (!(total > 0)) throw new Error('Resolved architecture has zero total weight');
  return [...weightMap.values()]
    .map(item => ({
      id: item.id,
      weight: Number((item.weight / total).toFixed(6)),
      sourceDistricts: [...item.sourceDistricts].sort()
    }))
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

function resolvePilot(config, pilot, indexes, sourceFingerprint) {
  const biome = indexes.biomes.get(pilot.visualBiome);
  const culture = indexes.cultures.get(pilot.culturalFamily);
  const settlement = indexes.settlements.get(pilot.settlementType);
  const quality = indexes.quality.get('mobile-target');
  if (!biome || !culture || !settlement || !quality) throw new Error(`${pilot.id}: unresolved primary reference`);

  const culturalArchitecture = new Set(culture.architectureFamilies);
  const architectureWeights = new Map();
  const usedDistricts = [];
  const districtPropKits = [];

  for (const mix of pilot.districtMix) {
    const district = indexes.districts.get(mix.districtId);
    if (!district) throw new Error(`${pilot.id}: unknown district ${mix.districtId}`);
    usedDistricts.push(district.id);
    districtPropKits.push(...district.propKits);

    const eligible = district.architectureFamilies.filter(familyId => {
      const family = indexes.architecture.get(familyId);
      return family
        && culturalArchitecture.has(familyId)
        && family.compatibleBiomes.includes(pilot.visualBiome)
        && family.compatibleSettlementTypes.includes(pilot.settlementType);
    });

    if (eligible.length === 0) {
      throw new Error(`${pilot.id}: district ${district.id} resolves no architecture family`);
    }

    const contribution = mix.weight / eligible.length;
    for (const familyId of eligible) {
      let entry = architectureWeights.get(familyId);
      if (!entry) {
        entry = { id: familyId, weight: 0, sourceDistricts: new Set() };
        architectureWeights.set(familyId, entry);
      }
      entry.weight += contribution;
      entry.sourceDistricts.add(district.id);
    }
  }

  const architectureFamilies = normalizeArchitectureWeights(architectureWeights);
  const vegetationFamilies = [...biome.vegetationFamilies];
  const propKits = unique([...culture.propKits, ...districtPropKits]).sort();

  if (architectureFamilies.length < pilot.acceptance.minimumArchitectureFamilies) {
    throw new Error(`${pilot.id}: resolves ${architectureFamilies.length} architecture families, requires ${pilot.acceptance.minimumArchitectureFamilies}`);
  }
  if (vegetationFamilies.length < pilot.acceptance.minimumVegetationFamilies) {
    throw new Error(`${pilot.id}: resolves ${vegetationFamilies.length} vegetation families, requires ${pilot.acceptance.minimumVegetationFamilies}`);
  }

  const explanation = [
    {
      stage: 'biome',
      decision: `Use ${biome.id}`,
      reason: `Pilot ${pilot.id} declares ${biome.id} as the physical visual base.`
    },
    {
      stage: 'culture',
      decision: `Use ${culture.id}`,
      reason: `The cultural family limits architecture, palettes and prop kits without changing geography.`
    },
    {
      stage: 'settlement',
      decision: `Use ${settlement.id}`,
      reason: `The settlement grammar defines building scale, valid districts and road hierarchy.`
    },
    {
      stage: 'district',
      decision: `Blend ${usedDistricts.join(', ')}`,
      reason: `District weights total one and distribute the zone into visually distinct functions.`
    },
    {
      stage: 'architecture',
      decision: `Resolve ${architectureFamilies.map(item => item.id).join(', ')}`,
      reason: `Families survive the intersection of district, culture, biome and settlement compatibility.`
    },
    {
      stage: 'terrain',
      decision: `Blend ${biome.terrainMaterials.join(', ')}`,
      reason: `Terrain materials come from the biome and will be modified by ${pilot.modifiers.join(', ') || 'no modifiers'}.`
    },
    {
      stage: 'vegetation',
      decision: `Use ${vegetationFamilies.join(', ')}`,
      reason: `Vegetation families are ecologically compatible with ${biome.id}; placement mode is resolved per land-use mask.`
    },
    {
      stage: 'props',
      decision: `Enable ${propKits.join(', ')}`,
      reason: `Prop kits are the deterministic union of cultural and active district kits.`
    },
    {
      stage: 'quality',
      decision: `Compile for ${quality.id}`,
      reason: `All pilots must fit the mobile target hard budgets before publication.`
    }
  ];

  const recipeWithoutFingerprint = {
    $schema: '../../../schema/visual-zone-recipe.schema.json',
    schemaVersion: 1,
    recipeType: 'waft-visual-zone-recipe',
    visualSystem: { id: config.id, version: config.version },
    regionId: pilot.regionId,
    zoneId: pilot.zoneId,
    pilotId: pilot.id,
    seed: pilot.seed,
    inputs: {
      visualBiome: pilot.visualBiome,
      modifiers: [...pilot.modifiers],
      culturalFamily: pilot.culturalFamily,
      settlementType: pilot.settlementType,
      districtMix: pilot.districtMix.map(item => ({ ...item }))
    },
    resolved: {
      architectureFamilies,
      terrainMaterials: [...biome.terrainMaterials],
      vegetationFamilies,
      propKits,
      lightingProfile: biome.lightingProfile,
      waterProfile: biome.waterProfile
    },
    quality: resolveQuality(quality),
    acceptance: { ...pilot.acceptance },
    explanation,
    determinism: {
      algorithm: 'sha256-stable-json-v1',
      sourceFingerprint
    }
  };

  const recipeFingerprint = sha256(stableJson(recipeWithoutFingerprint));
  return {
    ...recipeWithoutFingerprint,
    determinism: {
      ...recipeWithoutFingerprint.determinism,
      recipeFingerprint
    }
  };
}

function requestedPilotIds() {
  const index = process.argv.indexOf('--pilot');
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error('--pilot requires a pilot id');
  return new Set(value.split(',').map(item => item.trim()).filter(Boolean));
}

function build() {
  const config = readJson(CONFIG_PATH);
  const sourceFingerprint = sha256(stableJson(config));
  const indexes = {
    quality: indexById(config.qualityProfiles, 'qualityProfiles'),
    biomes: indexById(config.visualBiomes, 'visualBiomes'),
    cultures: indexById(config.culturalFamilies, 'culturalFamilies'),
    architecture: indexById(config.architectureFamilies, 'architectureFamilies'),
    settlements: indexById(config.settlementTypes, 'settlementTypes'),
    districts: indexById(config.districts, 'districts')
  };

  const requested = requestedPilotIds();
  const pilots = config.pilots.filter(pilot => !requested || requested.has(pilot.id));
  if (requested && pilots.length !== requested.size) {
    const found = new Set(pilots.map(item => item.id));
    const missing = [...requested].filter(id => !found.has(id));
    throw new Error(`Unknown pilot ids: ${missing.join(', ')}`);
  }

  fs.mkdirSync(OUTPUT_ROOT, { recursive: true });
  const entries = [];
  for (const pilot of pilots) {
    const recipe = resolvePilot(config, pilot, indexes, sourceFingerprint);
    const directory = path.join(OUTPUT_ROOT, pilot.regionId);
    fs.mkdirSync(directory, { recursive: true });
    const fileName = `${pilot.zoneId}.visual-recipe-v1.json`;
    const outputPath = path.join(directory, fileName);
    fs.writeFileSync(outputPath, `${JSON.stringify(recipe, null, 2)}\n`);
    entries.push({
      pilotId: pilot.id,
      regionId: pilot.regionId,
      zoneId: pilot.zoneId,
      file: path.relative(ROOT, outputPath).replaceAll(path.sep, '/'),
      recipeFingerprint: recipe.determinism.recipeFingerprint,
      architectureFamilies: recipe.resolved.architectureFamilies.length,
      vegetationFamilies: recipe.resolved.vegetationFamilies.length
    });
  }

  const index = {
    formatVersion: 1,
    indexType: 'waft-visual-recipe-index',
    visualSystem: { id: config.id, version: config.version, sourceFingerprint },
    recipeCount: entries.length,
    recipes: entries
  };
  fs.writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`);

  const report = {
    formatVersion: 1,
    valid: true,
    visualSystemId: config.id,
    visualSystemVersion: config.version,
    sourceFingerprint,
    recipes: entries,
    outputIndex: path.relative(ROOT, INDEX_PATH).replaceAll(path.sep, '/')
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  build();
} catch (error) {
  const report = {
    formatVersion: 1,
    valid: false,
    error: error.stack || error.message
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
