import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, 'world-generator', 'schema', 'visual-zone-recipe.schema.json');
const RECIPE_ROOT = path.join(ROOT, 'world-generator', 'generated', 'visual-recipes');
const INDEX_PATH = path.join(RECIPE_ROOT, 'index.json');
const REPORT_PATH = path.join(ROOT, 'world-generator', 'visual-recipe-validation-report.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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
  if (!ref.startsWith('#/')) throw new Error(`Only local schema references are supported: ${ref}`);
  return ref.slice(2).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~')).reduce((value, key) => value?.[key], rootSchema);
}

function validateAgainstSchema(value, schema, rootSchema, pointer, errors) {
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
      errors.push(`${pointer || '/'}: expected ${types.join(' or ')}`);
      return;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${pointer}: string shorter than ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${pointer}: string longer than ${schema.maxLength}`);
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) errors.push(`${pointer}: string does not match ${schema.pattern}`);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${pointer}: ${value} below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${pointer}: ${value} above ${schema.maximum}`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(`${pointer}: ${value} must be greater than ${schema.exclusiveMinimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${pointer}: requires at least ${schema.minItems} items`);
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
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) errors.push(`${pointer || '/'}: missing ${key}`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(`${pointer}/${key}: unknown property`);
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validateAgainstSchema(value[key], childSchema, rootSchema, `${pointer}/${key}`, errors);
    }
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function listRecipeFiles() {
  if (!fs.existsSync(RECIPE_ROOT)) return [];
  const files = [];
  for (const regionName of fs.readdirSync(RECIPE_ROOT).sort()) {
    const regionPath = path.join(RECIPE_ROOT, regionName);
    if (!fs.statSync(regionPath).isDirectory()) continue;
    for (const name of fs.readdirSync(regionPath).sort()) {
      if (name.endsWith('.visual-recipe-v1.json')) files.push(path.join(regionPath, name));
    }
  }
  return files;
}

const startedAt = Date.now();
const errors = [];
const warnings = [];
const recipeResults = [];

try {
  const schema = readJson(SCHEMA_PATH);
  const index = readJson(INDEX_PATH);
  const files = listRecipeFiles();
  const indexByFile = new Map(index.recipes.map(item => [item.file, item]));

  if (files.length !== index.recipeCount) errors.push(`/index: found ${files.length} files but index declares ${index.recipeCount}`);

  for (const filePath of files) {
    const relative = path.relative(ROOT, filePath).replaceAll(path.sep, '/');
    const recipe = readJson(filePath);
    const recipeErrors = [];
    validateAgainstSchema(recipe, schema, schema, '', recipeErrors);

    const expectedFingerprint = recipe.determinism?.recipeFingerprint;
    const clone = structuredClone(recipe);
    if (clone.determinism) delete clone.determinism.recipeFingerprint;
    const computedFingerprint = sha256(stableJson(clone));
    if (expectedFingerprint !== computedFingerprint) recipeErrors.push(`/determinism/recipeFingerprint: expected ${computedFingerprint}, received ${expectedFingerprint}`);

    const architectureWeight = (recipe.resolved?.architectureFamilies || []).reduce((sum, item) => sum + item.weight, 0);
    if (Math.abs(architectureWeight - 1) > 0.00001) recipeErrors.push(`/resolved/architectureFamilies: weights total ${architectureWeight}`);
    if ((recipe.resolved?.architectureFamilies?.length || 0) < (recipe.acceptance?.minimumArchitectureFamilies || Infinity)) {
      recipeErrors.push('/acceptance: architecture family minimum not met');
    }
    if ((recipe.resolved?.vegetationFamilies?.length || 0) < (recipe.acceptance?.minimumVegetationFamilies || Infinity)) {
      recipeErrors.push('/acceptance: vegetation family minimum not met');
    }

    const indexEntry = indexByFile.get(relative);
    if (!indexEntry) recipeErrors.push('/: missing from recipe index');
    else if (indexEntry.recipeFingerprint !== expectedFingerprint) recipeErrors.push('/: index fingerprint mismatch');

    errors.push(...recipeErrors.map(error => `${relative}${error}`));
    recipeResults.push({
      file: relative,
      valid: recipeErrors.length === 0,
      regionId: recipe.regionId,
      zoneId: recipe.zoneId,
      recipeFingerprint: expectedFingerprint,
      architectureFamilies: recipe.resolved?.architectureFamilies?.length || 0,
      vegetationFamilies: recipe.resolved?.vegetationFamilies?.length || 0,
      errors: recipeErrors
    });
  }

  for (const entry of index.recipes) {
    if (!fs.existsSync(path.join(ROOT, entry.file))) errors.push(`/index: missing recipe file ${entry.file}`);
  }
} catch (error) {
  errors.push(error.stack || error.message);
}

const report = {
  formatVersion: 1,
  valid: errors.length === 0,
  schema: path.relative(ROOT, SCHEMA_PATH).replaceAll(path.sep, '/'),
  recipeRoot: path.relative(ROOT, RECIPE_ROOT).replaceAll(path.sep, '/'),
  recipes: recipeResults,
  errors,
  warnings,
  durationMs: Date.now() - startedAt,
  validatedAt: new Date().toISOString()
};

fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.valid) process.exitCode = 1;
