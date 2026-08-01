import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const generatorRoot = path.join(repoRoot, 'world-generator');
const configsRoot = path.join(generatorRoot, 'configs');
const reportPath = path.join(generatorRoot, 'validation-report.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${path.relative(repoRoot, filePath)}: ${error.message}`);
  }
}

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function typeMatches(value, expected) {
  if (expected === 'null') return value === null;
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'integer') return Number.isInteger(value);
  if (expected === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === expected;
}

function resolvePointer(rootSchema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Only local schema references are supported: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, key) => value?.[key], rootSchema);
}

function validateAgainstSchema(value, schema, rootSchema, pointer, errors) {
  if (!schema || typeof schema !== 'object') {
    errors.push(`${pointer}: invalid schema node`);
    return;
  }

  if (schema.$ref) {
    const target = resolvePointer(rootSchema, schema.$ref);
    if (!target) {
      errors.push(`${pointer}: unresolved schema reference ${schema.$ref}`);
      return;
    }
    validateAgainstSchema(value, target, rootSchema, pointer, errors);
    return;
  }

  if (Array.isArray(schema.oneOf)) {
    const results = schema.oneOf.map(option => {
      const branchErrors = [];
      validateAgainstSchema(value, option, rootSchema, pointer, branchErrors);
      return branchErrors;
    });
    const validBranches = results.filter(branchErrors => branchErrors.length === 0);
    if (validBranches.length !== 1) {
      const closest = results.sort((a, b) => a.length - b.length)[0] || [];
      errors.push(`${pointer}: expected exactly one oneOf branch, matched ${validBranches.length}`);
      errors.push(...closest.slice(0, 4));
    }
    return;
  }

  if (Object.hasOwn(schema, 'const') && !jsonEqual(value, schema.const)) {
    errors.push(`${pointer}: expected constant ${JSON.stringify(schema.const)}`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some(item => jsonEqual(item, value))) {
    errors.push(`${pointer}: value ${JSON.stringify(value)} is not in enum`);
    return;
  }

  if (schema.type !== undefined) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expectedTypes.some(type => typeMatches(value, type))) {
      errors.push(`${pointer}: expected ${expectedTypes.join(' or ')}, received ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${pointer}: string is shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${pointer}: string is longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) errors.push(`${pointer}: string does not match ${schema.pattern}`);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${pointer}: ${value} is below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${pointer}: ${value} is above maximum ${schema.maximum}`);
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
        if (seen.has(key)) errors.push(`${pointer}/${index}: duplicate array item`);
        seen.add(key);
      });
    }
    if (schema.items) value.forEach((item, index) => validateAgainstSchema(item, schema.items, rootSchema, `${pointer}/${index}`, errors));
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(`${pointer}: missing required property ${key}`);
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

function ensureUniqueIds(items, label, errors, key = 'id') {
  const seen = new Set();
  for (const [index, item] of (items || []).entries()) {
    const id = item?.[key];
    if (!id) continue;
    if (seen.has(id)) errors.push(`${label}/${index}: duplicate ${key} ${id}`);
    seen.add(id);
  }
  return seen;
}

function semanticValidation(config, configPath, errors, warnings) {
  const bounds = config.geography?.bounds;
  if (!bounds) return;

  if (!(bounds.west < bounds.east)) errors.push('/geography/bounds: west must be lower than east');
  if (!(bounds.south < bounds.north)) errors.push('/geography/bounds: south must be lower than north');

  const pointInside = (point, label) => {
    if (!point || !bounds) return;
    if (point.lon < bounds.west || point.lon > bounds.east || point.lat < bounds.south || point.lat > bounds.north) {
      errors.push(`${label}: coordinate ${point.lon}, ${point.lat} is outside region bounds`);
    }
  };

  pointInside(config.geography.origin, '/geography/origin');
  config.geography.subregions.forEach((item, index) => item.center && pointInside(item.center, `/geography/subregions/${index}/center`));
  config.generation.settlements.manualInclude?.forEach((item, index) => pointInside(item.position, `/generation/settlements/manualInclude/${index}/position`));
  config.generation.landmarks.manualInclude?.forEach((item, index) => pointInside(item.position, `/generation/landmarks/manualInclude/${index}/position`));
  config.travel.entryPoints.forEach((item, index) => pointInside(item.position, `/travel/entryPoints/${index}/position`));
  config.gameplay.spawnPoints.forEach((item, index) => pointInside(item.position, `/gameplay/spawnPoints/${index}/position`));
  config.gameplay.reservedZones.forEach((item, index) => pointInside(item.center, `/gameplay/reservedZones/${index}/center`));

  const subregionIds = ensureUniqueIds(config.geography.subregions, '/geography/subregions', errors);
  const anchorIds = config.geography.scale.emptySpaceCompression.anchorIds || [];
  for (const id of anchorIds) if (!subregionIds.has(id)) errors.push(`/geography/scale/emptySpaceCompression/anchorIds: unknown subregion ${id}`);

  ensureUniqueIds(config.generation.settlements.manualInclude || [], '/generation/settlements/manualInclude', errors);
  ensureUniqueIds(config.generation.landmarks.manualInclude || [], '/generation/landmarks/manualInclude', errors);
  const entryPointIds = ensureUniqueIds(config.travel.entryPoints, '/travel/entryPoints', errors);
  ensureUniqueIds(config.travel.connections, '/travel/connections', errors);
  ensureUniqueIds(config.gameplay.spawnPoints, '/gameplay/spawnPoints', errors);
  ensureUniqueIds(config.gameplay.reservedZones, '/gameplay/reservedZones', errors);

  for (const [index, connection] of config.travel.connections.entries()) {
    if (!entryPointIds.has(connection.entryPointId)) errors.push(`/travel/connections/${index}/entryPointId: unknown entry point ${connection.entryPointId}`);
    if (connection.targetRegionId === config.id) errors.push(`/travel/connections/${index}/targetRegionId: a region cannot connect to itself`);
  }

  const landmarkRules = config.generation.landmarks;
  if (landmarkRules.uniqueModelScore < landmarkRules.archetypeScore) errors.push('/generation/landmarks: uniqueModelScore must be greater than or equal to archetypeScore');
  if (landmarkRules.archetypeScore < landmarkRules.minimumScore) errors.push('/generation/landmarks: archetypeScore must be greater than or equal to minimumScore');

  const speciesKeys = new Set();
  for (const [index, species] of (config.generation.fauna.manualInclude || []).entries()) {
    const key = species.scientificName.toLowerCase();
    if (speciesKeys.has(key)) errors.push(`/generation/fauna/manualInclude/${index}: duplicate species ${species.scientificName}`);
    speciesKeys.add(key);
    if (species.minimumCount !== undefined && species.maximumCount !== undefined && species.minimumCount > species.maximumCount) {
      errors.push(`/generation/fauna/manualInclude/${index}: minimumCount exceeds maximumCount`);
    }
  }

  const outputNames = Object.entries(config.outputs)
    .filter(([key]) => key !== 'directory')
    .map(([, value]) => value);
  if (new Set(outputNames).size !== outputNames.length) errors.push('/outputs: generated file names must be unique');
  if (!config.outputs.directory.endsWith(`/${config.id}`) && config.outputs.directory !== config.id) {
    errors.push(`/outputs/directory: expected a directory ending in /${config.id}`);
  }

  const regionAreaDegrees = (bounds.east - bounds.west) * (bounds.north - bounds.south);
  if (config.performance.targetProfile.startsWith('mobile') && config.performance.budgets.downloadMb > 100) {
    warnings.push('/performance/budgets/downloadMb: mobile region exceeds the recommended 100 MB ceiling');
  }
  if (regionAreaDegrees > 10 && config.performance.preloadRadiusSectors > 3) {
    warnings.push('/performance/preloadRadiusSectors: large geographic region with an aggressive preload radius');
  }
  if (config.travel.connections.length === 0) warnings.push('/travel/connections: region is isolated from the world graph');

  const overridePath = path.resolve(repoRoot, config.overrides.file);
  if (!overridePath.startsWith(repoRoot + path.sep)) {
    errors.push('/overrides/file: path escapes the repository');
  } else if (!fs.existsSync(overridePath)) {
    errors.push(`/overrides/file: missing ${path.relative(repoRoot, overridePath)}`);
  } else {
    const overrideSchemaPath = path.join(generatorRoot, 'schema', 'region-overrides.schema.json');
    const overrideSchema = readJson(overrideSchemaPath);
    const overrides = readJson(overridePath);
    validateAgainstSchema(overrides, overrideSchema, overrideSchema, '/overrides-document', errors);
    if (overrides.regionId !== config.id) errors.push(`/overrides-document/regionId: expected ${config.id}`);
  }

  const sourceFile = path.relative(repoRoot, configPath);
  if (path.basename(sourceFile) !== `${config.id}.region.json`) {
    warnings.push(`/: file name should be ${config.id}.region.json`);
  }
}

function findConfigFiles() {
  const configArgIndex = process.argv.indexOf('--config');
  if (configArgIndex >= 0) {
    const requested = process.argv[configArgIndex + 1];
    if (!requested) throw new Error('--config requires a file path');
    return [path.resolve(repoRoot, requested)];
  }
  return fs.readdirSync(configsRoot)
    .filter(name => name.endsWith('.region.json'))
    .sort()
    .map(name => path.join(configsRoot, name));
}

const regionSchemaPath = path.join(generatorRoot, 'schema', 'region.schema.json');
const regionSchema = readJson(regionSchemaPath);
const files = findConfigFiles();
const results = [];

for (const configPath of files) {
  const errors = [];
  const warnings = [];
  let config = null;
  try {
    config = readJson(configPath);
    validateAgainstSchema(config, regionSchema, regionSchema, '', errors);
    if (errors.length === 0) semanticValidation(config, configPath, errors, warnings);
  } catch (error) {
    errors.push(error.message);
  }

  results.push({
    file: path.relative(repoRoot, configPath),
    id: config?.id || null,
    version: config?.version || null,
    valid: errors.length === 0,
    errors,
    warnings,
    summary: config ? {
      subregions: config.geography?.subregions?.length || 0,
      manualSettlements: config.generation?.settlements?.manualInclude?.length || 0,
      manualLandmarks: config.generation?.landmarks?.manualInclude?.length || 0,
      manualSpecies: config.generation?.fauna?.manualInclude?.length || 0,
      entryPoints: config.travel?.entryPoints?.length || 0,
      connections: config.travel?.connections?.length || 0
    } : null
  });
}

const report = {
  validatorVersion: 1,
  generatedAt: new Date().toISOString(),
  valid: results.every(result => result.valid),
  schema: path.relative(repoRoot, regionSchemaPath),
  configs: results
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) {
  console.log(`${result.valid ? 'OK' : 'FAILED'} ${result.file}`);
  result.errors.forEach(error => console.error(`  ERROR ${error}`));
  result.warnings.forEach(warning => console.warn(`  WARN  ${warning}`));
}
console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
if (!report.valid) process.exit(1);
