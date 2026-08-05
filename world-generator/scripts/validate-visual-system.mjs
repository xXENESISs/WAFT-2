import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'world-generator', 'schema', 'visual-system.schema.json');
const DEFAULT_CONFIG_PATH = path.join(ROOT, 'world-generator', 'configs', 'visual-system-v1.json');
const REPORT_PATH = path.join(ROOT, 'world-generator', 'visual-system-validation-report.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${error.message}`);
  }
}

function typeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolvePointer(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local references are supported: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, key) => value?.[key], rootSchema);
}

function validateAgainstSchema(value, schema, rootSchema, pointer, errors) {
  if (!schema || typeof schema !== 'object') {
    errors.push(`${pointer || '/'}: invalid schema node`);
    return;
  }

  if (schema.$ref) {
    const target = resolvePointer(rootSchema, schema.$ref);
    if (!target) errors.push(`${pointer || '/'}: unresolved reference ${schema.$ref}`);
    else validateAgainstSchema(value, target, rootSchema, pointer, errors);
    return;
  }

  if (Object.hasOwn(schema, 'const') && !jsonEqual(value, schema.const)) {
    errors.push(`${pointer || '/'}: expected constant ${JSON.stringify(schema.const)}`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some(item => jsonEqual(item, value))) {
    errors.push(`${pointer || '/'}: value ${JSON.stringify(value)} is not allowed`);
    return;
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => typeMatches(value, type))) {
      const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      errors.push(`${pointer || '/'}: expected ${types.join(' or ')}, received ${actual}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${pointer}: string shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${pointer}: string longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) errors.push(`${pointer}: string does not match ${schema.pattern}`);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${pointer}: ${value} is below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${pointer}: ${value} is above ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${pointer}: ${value} must be greater than ${schema.exclusiveMinimum}`);
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) errors.push(`${pointer}: ${value} must be lower than ${schema.exclusiveMaximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${pointer}: requires at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${pointer}: allows at most ${schema.maxItems} items`);
    if (schema.uniqueItems) {
      const seen = new Set();
      value.forEach((item, index) => {
        const key = JSON.stringify(item);
        if (seen.has(key)) errors.push(`${pointer}/${index}: duplicate item`);
        seen.add(key);
      });
    }
    if (schema.items) value.forEach((item, index) => validateAgainstSchema(item, schema.items, rootSchema, `${pointer}/${index}`, errors));
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${pointer || '/'}: missing required property ${key}`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(`${pointer}/${key}: unknown property`);
      }
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validateAgainstSchema(value[key], childSchema, rootSchema, `${pointer}/${key}`, errors);
    }
  }
}

function indexById(items, label, errors) {
  const map = new Map();
  for (const [index, item] of (items || []).entries()) {
    if (!item?.id) continue;
    if (map.has(item.id)) errors.push(`${label}/${index}: duplicate id ${item.id}`);
    else map.set(item.id, item);
  }
  return map;
}

function requireReferences(values, target, pointer, errors) {
  for (const [index, value] of (values || []).entries()) {
    if (!target.has(value)) errors.push(`${pointer}/${index}: unknown reference ${value}`);
  }
}

function assertDescending(lods, pointer, errors) {
  if (!lods) return;
  if (!(lods.lod0 > lods.lod1 && lods.lod1 > lods.lod2)) {
    errors.push(`${pointer}: expected lod0 > lod1 > lod2`);
  }
  if (lods.shadow !== undefined && lods.shadow > lods.lod2) {
    errors.push(`${pointer}/shadow: shadow proxy cannot exceed lod2`);
  }
}

function semanticValidation(config, errors, warnings) {
  const quality = indexById(config.qualityProfiles, '/qualityProfiles', errors);
  const materials = indexById(config.materialFamilies, '/materialFamilies', errors);
  const biomes = indexById(config.visualBiomes, '/visualBiomes', errors);
  const modifiers = indexById(config.environmentModifiers, '/environmentModifiers', errors);
  const cultures = indexById(config.culturalFamilies, '/culturalFamilies', errors);
  const architecture = indexById(config.architectureFamilies, '/architectureFamilies', errors);
  const vegetation = indexById(config.vegetationFamilies, '/vegetationFamilies', errors);
  const settlementTypes = indexById(config.settlementTypes, '/settlementTypes', errors);
  const districts = indexById(config.districts, '/districts', errors);
  const pilots = indexById(config.pilots, '/pilots', errors);

  const ratio = Number(config.style?.naturalismRatio || 0) + Number(config.style?.stylizationRatio || 0);
  if (Math.abs(ratio - 1) > 1e-9) errors.push(`/style: naturalismRatio + stylizationRatio must equal 1, received ${ratio}`);

  const requiredLods = new Set(config.assetPipeline?.requiredLods || []);
  for (const id of ['lod0', 'lod1', 'lod2', 'shadow']) {
    if (!requiredLods.has(id)) errors.push(`/assetPipeline/requiredLods: missing ${id}`);
  }

  for (const [profileIndex, profile] of config.qualityProfiles.entries()) {
    if (profile.resolutionScale.minimum > profile.resolutionScale.maximum) {
      errors.push(`/qualityProfiles/${profileIndex}/resolutionScale: minimum exceeds maximum`);
    }
    if (profile.aspirationalFps !== undefined && profile.aspirationalFps < profile.targetFps) {
      errors.push(`/qualityProfiles/${profileIndex}/aspirationalFps: cannot be below targetFps`);
    }
    for (const [budgetName, budget] of Object.entries(profile.budgets)) {
      if (budget.recommended > budget.hardMaximum) {
        errors.push(`/qualityProfiles/${profileIndex}/budgets/${budgetName}: recommended exceeds hardMaximum`);
      }
    }
  }

  for (const [index, biome] of config.visualBiomes.entries()) {
    requireReferences(biome.terrainMaterials, materials, `/visualBiomes/${index}/terrainMaterials`, errors);
    requireReferences(biome.vegetationFamilies, vegetation, `/visualBiomes/${index}/vegetationFamilies`, errors);
  }

  for (const [index, culture] of config.culturalFamilies.entries()) {
    requireReferences(culture.architectureFamilies, architecture, `/culturalFamilies/${index}/architectureFamilies`, errors);
  }

  for (const [index, family] of config.architectureFamilies.entries()) {
    requireReferences(family.compatibleBiomes, biomes, `/architectureFamilies/${index}/compatibleBiomes`, errors);
    requireReferences(family.compatibleSettlementTypes, settlementTypes, `/architectureFamilies/${index}/compatibleSettlementTypes`, errors);
    requireReferences(family.materialFamilies, materials, `/architectureFamilies/${index}/materialFamilies`, errors);
    assertDescending(family.lodTriangleBudgets, `/architectureFamilies/${index}/lodTriangleBudgets`, errors);
    const modules = family.requiredModules;
    if (family.status === 'approved') {
      for (const [name, minimum] of Object.entries({ masses: 4, roofs: 3, corners: 2, entrances: 3, windowRhythms: 4, detailVariants: 2 })) {
        if (modules[name] < minimum) errors.push(`/architectureFamilies/${index}/requiredModules/${name}: approved family requires at least ${minimum}`);
      }
    }
  }

  for (const [index, family] of config.vegetationFamilies.entries()) {
    requireReferences(family.compatibleBiomes, biomes, `/vegetationFamilies/${index}/compatibleBiomes`, errors);
    assertDescending(family.lodTriangleBudgets, `/vegetationFamilies/${index}/lodTriangleBudgets`, errors);
  }

  for (const [index, settlement] of config.settlementTypes.entries()) {
    if (settlement.buildingRange.minimum > settlement.buildingRange.maximum) {
      errors.push(`/settlementTypes/${index}/buildingRange: minimum exceeds maximum`);
    }
    requireReferences(settlement.allowedDistricts, districts, `/settlementTypes/${index}/allowedDistricts`, errors);
  }

  for (const [index, district] of config.districts.entries()) {
    requireReferences(district.architectureFamilies, architecture, `/districts/${index}/architectureFamilies`, errors);
  }

  const pilotZones = new Set();
  for (const [index, pilot] of config.pilots.entries()) {
    if (pilotZones.has(`${pilot.regionId}/${pilot.zoneId}`)) errors.push(`/pilots/${index}: duplicate pilot zone ${pilot.regionId}/${pilot.zoneId}`);
    pilotZones.add(`${pilot.regionId}/${pilot.zoneId}`);
    if (!biomes.has(pilot.visualBiome)) errors.push(`/pilots/${index}/visualBiome: unknown ${pilot.visualBiome}`);
    requireReferences(pilot.modifiers, modifiers, `/pilots/${index}/modifiers`, errors);
    if (!cultures.has(pilot.culturalFamily)) errors.push(`/pilots/${index}/culturalFamily: unknown ${pilot.culturalFamily}`);
    const settlement = settlementTypes.get(pilot.settlementType);
    if (!settlement) errors.push(`/pilots/${index}/settlementType: unknown ${pilot.settlementType}`);

    const mixSum = pilot.districtMix.reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(mixSum - 1) > 1e-6) errors.push(`/pilots/${index}/districtMix: weights must total 1, received ${mixSum}`);
    const districtIds = pilot.districtMix.map(item => item.districtId);
    requireReferences(districtIds, districts, `/pilots/${index}/districtMix`, errors);
    if (settlement) {
      const allowed = new Set(settlement.allowedDistricts);
      for (const [mixIndex, districtId] of districtIds.entries()) {
        if (!allowed.has(districtId)) errors.push(`/pilots/${index}/districtMix/${mixIndex}: ${districtId} is not allowed by ${settlement.id}`);
      }
    }

    const culture = cultures.get(pilot.culturalFamily);
    const cultureArchitecture = new Set(culture?.architectureFamilies || []);
    const biomeId = pilot.visualBiome;
    const resolvedArchitecture = new Set();
    for (const districtId of districtIds) {
      const district = districts.get(districtId);
      for (const familyId of district?.architectureFamilies || []) {
        const family = architecture.get(familyId);
        if (cultureArchitecture.has(familyId) && family?.compatibleBiomes.includes(biomeId) && family?.compatibleSettlementTypes.includes(pilot.settlementType)) {
          resolvedArchitecture.add(familyId);
        }
      }
    }
    if (resolvedArchitecture.size < pilot.acceptance.minimumArchitectureFamilies) {
      errors.push(`/pilots/${index}/acceptance/minimumArchitectureFamilies: resolves ${resolvedArchitecture.size}, requires ${pilot.acceptance.minimumArchitectureFamilies}`);
    }

    const resolvedVegetation = biomes.get(biomeId)?.vegetationFamilies || [];
    if (resolvedVegetation.length < pilot.acceptance.minimumVegetationFamilies) {
      errors.push(`/pilots/${index}/acceptance/minimumVegetationFamilies: resolves ${resolvedVegetation.length}, requires ${pilot.acceptance.minimumVegetationFamilies}`);
    }
  }

  requireReferences([config.transferTest.requiredQualityProfile], quality, '/transferTest/requiredQualityProfile', errors);
  if (config.transferTest.candidateZoneIds.length < 2) errors.push('/transferTest/candidateZoneIds: requires at least two candidates');

  const plannedArchitecture = config.architectureFamilies.filter(item => item.status === 'planned').length;
  const plannedVegetation = config.vegetationFamilies.filter(item => item.status === 'planned').length;
  if (plannedArchitecture === config.architectureFamilies.length) warnings.push('/architectureFamilies: all families are still planned');
  if (plannedVegetation === config.vegetationFamilies.length) warnings.push('/vegetationFamilies: all families are still planned');
  if (!quality.has('mobile-target')) errors.push('/qualityProfiles: mobile-target is mandatory');
  if (!pilots.has('pilot-barcelona') || !pilots.has('pilot-montseny') || !pilots.has('pilot-llevant') || !pilots.has('pilot-alcudia')) {
    errors.push('/pilots: the four canonical 0.18 pilots are mandatory');
  }
}

function configPathFromArgs() {
  const index = process.argv.indexOf('--config');
  if (index === -1) return DEFAULT_CONFIG_PATH;
  const value = process.argv[index + 1];
  if (!value) throw new Error('--config requires a file path');
  return path.resolve(ROOT, value);
}

const startedAt = Date.now();
const errors = [];
const warnings = [];
let config = null;
let schema = null;
let configPath = configPathFromArgs();

try {
  schema = readJson(SCHEMA_PATH);
  config = readJson(configPath);
  validateAgainstSchema(config, schema, schema, '', errors);
  if (errors.length === 0) semanticValidation(config, errors, warnings);
} catch (error) {
  errors.push(error.stack || error.message);
}

const report = {
  formatVersion: 1,
  valid: errors.length === 0,
  schema: path.relative(ROOT, SCHEMA_PATH).replaceAll(path.sep, '/'),
  config: path.relative(ROOT, configPath).replaceAll(path.sep, '/'),
  visualSystemId: config?.id || null,
  visualSystemVersion: config?.version || null,
  counts: config ? {
    qualityProfiles: config.qualityProfiles?.length || 0,
    materialFamilies: config.materialFamilies?.length || 0,
    visualBiomes: config.visualBiomes?.length || 0,
    environmentModifiers: config.environmentModifiers?.length || 0,
    culturalFamilies: config.culturalFamilies?.length || 0,
    architectureFamilies: config.architectureFamilies?.length || 0,
    vegetationFamilies: config.vegetationFamilies?.length || 0,
    settlementTypes: config.settlementTypes?.length || 0,
    districts: config.districts?.length || 0,
    pilots: config.pilots?.length || 0
  } : null,
  errors,
  warnings,
  durationMs: Date.now() - startedAt,
  validatedAt: new Date().toISOString()
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.valid) process.exitCode = 1;
