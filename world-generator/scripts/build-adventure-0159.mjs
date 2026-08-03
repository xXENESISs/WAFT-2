import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE_RUNTIME = path.join(ROOT, 'mallorca-mobile/region-runtime-baleares-011.html');
const CATALUNYA_RUNTIME = path.join(ROOT, 'mallorca-mobile/region-runtime-catalunya-litoral-001.html');
const ADVENTURE_PAGE = path.join(ROOT, 'mallorca-mobile/waft-0159.html');
const BUILD_REPORT = path.join(ROOT, 'world-generator/adventure-0159-build.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}`);
  return source.replace(search, replacement);
}

function replaceBalancedFunction(source, signature, replacement) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing function signature: ${signature}`);
  const braceStart = source.indexOf('{', start + signature.length - 1);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = braceStart; index < source.length; index++) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth++;
    else if (character === '}') {
      depth--;
      if (depth === 0) {
        const semicolon = source.indexOf(';', index);
        if (semicolon < 0) throw new Error(`Missing function terminator: ${signature}`);
        return source.slice(0, start) + replacement + source.slice(semicolon + 1);
      }
    }
  }
  throw new Error(`Unbalanced function: ${signature}`);
}

function project(position, manifest) {
  return {
    x: Number(((position.lon - manifest.projection.origin.lon) * manifest.projection.kmPerDegreeLon * manifest.projection.unitsPerKm).toFixed(4)),
    z: Number((-(position.lat - manifest.projection.origin.lat) * manifest.projection.kmPerDegreeLat * manifest.projection.unitsPerKm).toFixed(4))
  };
}

function entry(config, manifest, id) {
  const item = config.travel.entryPoints.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Missing entry point ${config.regionId}/${id}`);
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    ...project(item.position, manifest),
    heading: Number((item.arrivalHeadingDegrees * Math.PI / 180).toFixed(6))
  };
}

const balearesConfig = readJson(path.join(ROOT, 'world-generator/configs/baleares.region.json'));
const catalunyaConfig = readJson(path.join(ROOT, 'world-generator/configs/catalunya-litoral.region.json'));
const balearesManifest = readJson(path.join(ROOT, 'regions/baleares/manifest.json'));
const catalunyaManifest = readJson(path.join(ROOT, 'regions/catalunya-litoral/manifest.json'));
const catalunyaMetadata = readJson(path.join(ROOT, 'regions/catalunya-litoral/preview/catalunya-litoral-preview-v1.json'));
const sourceRuntime = fs.readFileSync(SOURCE_RUNTIME, 'utf8');

const regions = {
  baleares: {
    id: 'baleares',
    name: 'Baleares',
    runtime: 'region-runtime-baleares-011.html',
    expectedBuildId: readJson(path.join(ROOT, 'regions/baleares/preview/baleares-preview-v1.json')).buildId,
    departure: entry(balearesConfig, balearesManifest, 'port-alcudia'),
    arrival: entry(balearesConfig, balearesManifest, 'port-alcudia')
  },
  'catalunya-litoral': {
    id: 'catalunya-litoral',
    name: 'Catalunya litoral',
    runtime: 'region-runtime-catalunya-litoral-001.html',
    expectedBuildId: catalunyaMetadata.buildId,
    departure: entry(catalunyaConfig, catalunyaManifest, 'port-barcelona'),
    arrival: entry(catalunyaConfig, catalunyaManifest, 'port-barcelona')
  }
};

const route = {
  id: 'baleares-catalunya-long-water',
  capability: 'long_water',
  from: 'baleares',
  to: 'catalunya-litoral',
  departures: {
    baleares: regions.baleares.departure,
    'catalunya-litoral': regions['catalunya-litoral'].departure
  },
  arrivals: {
    baleares: regions.baleares.arrival,
    'catalunya-litoral': regions['catalunya-litoral'].arrival
  }
};

function buildCatalunyaRuntime() {
  let output = sourceRuntime;
  output = replaceOnce(output, '<title>WAFT · Runtime regional de Baleares 011</title>', '<title>WAFT · Runtime regional de Catalunya litoral 001</title>', 'runtime title');
  output = output.replaceAll('WAFT · BALEARES', 'WAFT · CATALUNYA LITORAL');
  output = output.replaceAll('RUNTIME REGIONAL 011', 'RUNTIME CATALUNYA 001');
  output = output.replaceAll('runtime regional.', 'runtime regional de Catalunya.');
  output = replaceOnce(output, "  const base = '../regions/baleares/';", "  const base = '../regions/catalunya-litoral/';", 'region base');
  output = output.replaceAll('baleares-preview-v1.json', 'catalunya-litoral-preview-v1.json');
  output = output.replaceAll("'waft.baleares.travel.v1'", "'waft.catalunya-litoral.travel.v1'");
  output = output.replaceAll("'baleares'", "'catalunya-litoral'");
  output = output.replaceAll("localRegistry.zones.length < 2", "localRegistry.zones.length < 0");
  output = output.replaceAll("item.name.toLowerCase().includes('palma')", "item.id === 'barcelona'");
  output = output.replaceAll("const palmaPreset = runtimeControls.playable.find(item => item.id === 'palma') || runtimeControls.playable[0];", "const startPreset = runtimeControls.playable.find(item => item.id === 'barcelona') || runtimeControls.playable[0];");
  output = output.replaceAll('runtimeControls.spawn(palmaPreset);', 'runtimeControls.spawn(startPreset);');
  output = output.replaceAll("discoverTravelNode('palma', 'reset-start');", "discoverTravelNode('barcelona', 'reset-start');");
  output = output.replaceAll("discoverTravelNode('palma', 'initial-start');", "discoverTravelNode('barcelona', 'initial-start');");
  output = output.replaceAll("version: '011'", "version: 'catalunya-001'");

  const travelStart = output.indexOf("    const travelNodeIds = ['palma'");
  const travelEnd = output.indexOf('    const travelNodeById =', travelStart);
  if (travelStart < 0 || travelEnd < 0) throw new Error('Could not locate runtime travel graph');
  const travelGraph = `    const travelNodeIds = ['barcelona','tarragona','girona','subregion-montserrat','subregion-montseny','subregion-maresme'];
    const travelPresetById = new Map(metadata.presets.map(preset => [preset.id, preset]));
    const travelNodes = travelNodeIds.map(id => {
      const preset = travelPresetById.get(id);
      if (!preset) throw new Error('Falta el nodo regional ' + id);
      return {
        id,
        name: preset.name,
        x: preset.x,
        z: preset.z,
        discoveryRadius: id.startsWith('subregion-') ? 15 : 13,
        arrivalRadius: id.startsWith('subregion-') ? 10 : 9
      };
    });
`;
  output = output.slice(0, travelStart) + travelGraph + output.slice(travelEnd);

  const routesStart = output.indexOf('    const travelRoutes = [', travelStart);
  const routesEnd = output.indexOf('    const travelRouteById =', routesStart);
  if (routesStart < 0 || routesEnd < 0) throw new Error('Could not locate runtime route list');
  const routes = `    const travelRoutes = [
      { id: 'barcelona-tarragona', from: 'barcelona', to: 'tarragona', mode: 'land', name: 'Barcelona · Tarragona' },
      { id: 'barcelona-girona', from: 'barcelona', to: 'girona', mode: 'land', name: 'Barcelona · Girona' },
      { id: 'barcelona-montserrat', from: 'barcelona', to: 'subregion-montserrat', mode: 'land', name: 'Barcelona · Montserrat' },
      { id: 'barcelona-montseny', from: 'barcelona', to: 'subregion-montseny', mode: 'land', name: 'Barcelona · Montseny' },
      { id: 'barcelona-maresme', from: 'barcelona', to: 'subregion-maresme', mode: 'land', name: 'Barcelona · Maresme' }
    ];
`;
  output = output.slice(0, routesStart) + routes + output.slice(routesEnd);

  const locomotion = `    const buildLocomotionProbes = () => {
      if (locomotionProbes) return locomotionProbes;
      const source = terrainMesh;
      const bounds = source.bounds;
      const columns = source.columns, rows = source.rows;
      const dx = (bounds.maxX - bounds.minX) / (columns - 1);
      const dz = (bounds.maxZ - bounds.minZ) / (rows - 1);
      const rawAt = (column, row) => source.elevations[row * columns + column];
      let mountain = null;
      const directions = [[1,0],[-1,0],[0,1],[0,-1]];
      for (let row = 2; row < rows - 2; row++) {
        for (let column = 2; column < columns - 2; column++) {
          const baseRaw = rawAt(column, row);
          if (baseRaw === source.nodata) continue;
          for (const [dc, dr] of directions) {
            const targetRaw = rawAt(column + dc, row + dr);
            if (targetRaw === source.nodata || targetRaw <= baseRaw) continue;
            const rise = (targetRaw - baseRaw) * source.verticalScale;
            const horizontal = Math.hypot(dc * dx, dr * dz);
            const angle = Math.atan2(rise, horizontal);
            if (rise < .18 || angle < .08 || angle > .92) continue;
            const startX = bounds.minX + column * dx;
            const startZ = bounds.minZ + row * dz;
            const targetX = bounds.minX + (column + dc) * dx;
            const targetZ = bounds.minZ + (row + dr) * dz;
            if (collidesFullRegionalBuilding(startX, startZ) || collidesFullRegionalBuilding(targetX, targetZ)) continue;
            const score = angle * 4 + rise * .15 + Math.max(0, baseRaw) * .0003;
            if (!mountain || score > mountain.score) {
              const length = Math.hypot(targetX - startX, targetZ - startZ) || 1;
              const directionX = (targetX - startX) / length;
              const directionZ = (targetZ - startZ) / length;
              mountain = { start: { x: startX, z: startZ }, target: { x: targetX, z: targetZ }, direction: { x: directionX, z: directionZ }, yaw: Math.atan2(directionX, directionZ), rise, angle, score, suggestedMilliseconds: 850 };
            }
          }
        }
      }
      let water = null;
      for (let row = 4; row < rows - 4 && !water; row += 2) {
        for (let column = 4; column < columns - 4 && !water; column += 2) {
          if (rawAt(column, row) !== source.nodata) continue;
          const x = bounds.minX + column * dx;
          const z = bounds.minZ + row * dz;
          for (const [dc, dr] of directions) {
            let clear = true;
            for (let sample = -2; sample <= 8; sample++) {
              const check = sampleTerrainInfo(x + dc * sample * Math.max(.8, dx), z + dr * sample * Math.max(.8, dz));
              if (!check.inside || check.land) { clear = false; break; }
            }
            if (clear) {
              water = { start: { x, z }, direction: { x: dc, z: dr }, yaw: Math.atan2(dc, dr), route: 'litoral-catalunya', suggestedMilliseconds: 1200 };
              break;
            }
          }
        }
      }
      if (!mountain) throw new Error('No mountain locomotion probe could be generated');
      if (!water) throw new Error('No open-water locomotion probe could be generated');
      locomotionProbes = { mountain, water };
      return locomotionProbes;
    }`;
  output = replaceBalancedFunction(output, '    const buildLocomotionProbes = () => {', locomotion);

  if (output.includes('../regions/baleares/') || output.includes('baleares-preview-v1')) throw new Error('Baleares data path remains in Catalunya runtime');
  return output;
}

const catalunyaRuntime = buildCatalunyaRuntime();
const inputsHash = sha256([
  sourceRuntime,
  stableJson(balearesConfig),
  stableJson(catalunyaConfig),
  stableJson(balearesManifest),
  stableJson(catalunyaManifest),
  stableJson(catalunyaMetadata),
  catalunyaRuntime
].join('\n'));
const buildId = `waft-adventure-0159-${inputsHash.slice(0, 12)}`;

const regionJson = JSON.stringify(regions);
const routeJson = JSON.stringify(route);
const adventure = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#07161d">
<title>WAFT Adventure 0.15.9 · Dos regiones reales</title>
<style>
:root{color-scheme:dark;--gold:#e7bd63;--panel:rgba(6,20,27,.91);--line:rgba(231,189,99,.42)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#07161d;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#fff}
#runtime{position:fixed;inset:0;width:100%;height:100%;border:0;background:#07161d}
#world{position:fixed;z-index:80;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid var(--line);border-radius:13px;background:var(--panel);box-shadow:0 8px 30px #0008;backdrop-filter:blur(10px);max-width:calc(100vw - 20px)}
#world strong{color:var(--gold);font-size:11px;letter-spacing:.06em;white-space:nowrap}
#world small{font-size:9px;color:#c9dad6;white-space:nowrap}
#travelButton{display:none;border:1px solid #9fe3cc88;background:#255e51;color:#f3fffa;border-radius:10px;padding:8px 11px;font-weight:950;font-size:10px;white-space:nowrap}
#travelButton.visible{display:block}
#toast{position:fixed;z-index:90;left:50%;top:62px;transform:translate(-50%,-12px);opacity:0;pointer-events:none;padding:9px 13px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:#fff2cc;font-size:11px;font-weight:800;transition:.25s;box-shadow:0 7px 25px #0009}
#toast.show{opacity:1;transform:translate(-50%,0)}
#loading{position:fixed;z-index:100;inset:0;display:grid;place-items:center;text-align:center;padding:25px;background:radial-gradient(circle at 50% 35%,#173642,#07161d 70%);transition:opacity .35s}
#loading.hide{opacity:0;pointer-events:none}
#loading b{display:block;color:var(--gold);font-size:28px;letter-spacing:.08em}.loadText{margin-top:9px;color:#d9e4e1;font-weight:700}
#error{display:none;position:fixed;z-index:110;inset:12%;padding:20px;border:1px solid #d36d60;border-radius:15px;background:#190d0d;color:#ffd7d0;white-space:pre-wrap;overflow:auto}
@media(max-width:700px){#world{top:6px;padding:5px 7px;gap:5px}#world small{display:none}#world strong{font-size:9px}#travelButton{padding:6px 8px;font-size:9px}#toast{top:49px}}
</style>
</head>
<body>
<iframe id="runtime" title="Mundo regional WAFT"></iframe>
<div id="world"><strong id="regionName">CARGANDO MUNDO</strong><small id="worldStats">land · long_water</small><button id="travelButton"></button></div>
<div id="toast"></div>
<div id="loading"><div><b>WAFT 0.15.9</b><div class="loadText" id="loadText">Recuperando la expedición regional…</div></div></div>
<pre id="error"></pre>
<script>
'use strict';
(() => {
  const BUILD_ID = ${JSON.stringify(buildId)};
  const REGIONS = ${regionJson};
  const ROUTE = ${routeJson};
  const SAVE_KEY = 'waft.adventure.0159.world.v1';
  const CAPABILITIES = new Set(['land','long_water']);
  const frame = document.getElementById('runtime');
  const loading = document.getElementById('loading');
  const loadText = document.getElementById('loadText');
  const regionName = document.getElementById('regionName');
  const worldStats = document.getElementById('worldStats');
  const travelButton = document.getElementById('travelButton');
  const toast = document.getElementById('toast');
  const errorBox = document.getElementById('error');
  const cacheKey = new URLSearchParams(location.search).get('v') || BUILD_ID;
  const state = {
    schemaVersion: 1,
    currentRegionId: 'baleares',
    discoveredRegions: new Set(['baleares']),
    discoveredConnections: new Set(),
    transitionCount: 0,
    restored: false,
    runtimeReady: false,
    runtimeBuildId: null,
    runtimeBinarySha256: null,
    movementSinceLoad: 0,
    lastPosition: null,
    exitDistance: null,
    travelEligible: false,
    travelInProgress: false,
    lastSavedAt: 0,
    saveCount: 0,
    pageErrors: []
  };

  function fail(error) {
    console.error(error);
    state.pageErrors.push(String(error?.message || error));
    errorBox.style.display = 'block';
    errorBox.textContent = 'No se pudo abrir WAFT Adventure 0.15.9.\\n\\n' + (error?.stack || error?.message || error);
    loading.classList.add('hide');
    window.__WAFT_ADVENTURE_0159_ERROR__ = String(error?.message || error);
  }
  addEventListener('error', event => fail(event.error || event.message));
  addEventListener('unhandledrejection', event => fail(event.reason));

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function snapshot() {
    return {
      schemaVersion: state.schemaVersion,
      buildId: BUILD_ID,
      currentRegionId: state.currentRegionId,
      discoveredRegions: [...state.discoveredRegions],
      discoveredConnections: [...state.discoveredConnections],
      transitionCount: state.transitionCount,
      lastSavedAt: state.lastSavedAt,
      saveCount: state.saveCount
    };
  }
  function saveWorld(reason = 'manual') {
    const payload = { ...snapshot(), reason, lastSavedAt: Date.now(), saveCount: state.saveCount + 1 };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    state.lastSavedAt = payload.lastSavedAt;
    state.saveCount = payload.saveCount;
    try { frame.contentWindow?.WAFTRegionRuntime?.saveProgress(); } catch (error) { console.warn(error); }
    return snapshot();
  }
  function restoreWorld() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const payload = JSON.parse(raw);
      if (payload.schemaVersion !== state.schemaVersion || !REGIONS[payload.currentRegionId]) return false;
      state.currentRegionId = payload.currentRegionId;
      state.discoveredRegions = new Set((payload.discoveredRegions || []).filter(id => REGIONS[id]));
      state.discoveredRegions.add(state.currentRegionId);
      state.discoveredConnections = new Set(payload.discoveredConnections || []);
      state.transitionCount = Math.max(0, Number(payload.transitionCount) || 0);
      state.lastSavedAt = Math.max(0, Number(payload.lastSavedAt) || 0);
      state.saveCount = Math.max(0, Number(payload.saveCount) || 0);
      state.restored = true;
      return true;
    } catch (error) {
      console.warn('WAFT world restore failed', error);
      return false;
    }
  }
  function runtime() {
    return frame.contentWindow?.WAFTRegionRuntime || null;
  }
  function currentRegion() {
    return REGIONS[state.currentRegionId];
  }
  function targetRegionId() {
    return state.currentRegionId === ROUTE.from ? ROUTE.to : ROUTE.from;
  }
  function updateWorldHud() {
    const region = currentRegion();
    regionName.textContent = region.name.toUpperCase();
    worldStats.textContent = 'Regiones ' + state.discoveredRegions.size + '/2 · ruta ' + (state.discoveredConnections.has(ROUTE.id) ? 'descubierta' : 'sin descubrir') + ' · land · long_water';
    if (state.travelEligible && !state.travelInProgress) {
      travelButton.textContent = 'NAVEGAR A ' + REGIONS[targetRegionId()].name.toUpperCase();
      travelButton.classList.add('visible');
    } else travelButton.classList.remove('visible');
  }
  async function waitForRuntime(timeout = 120000) {
    const started = performance.now();
    while (performance.now() - started < timeout) {
      const api = runtime();
      if (api && frame.contentWindow.__WAFT_RUNTIME_011_READY__ === true) return api;
      const runtimeError = frame.contentWindow?.__WAFT_RUNTIME_011_ERROR__;
      if (runtimeError) throw new Error(runtimeError);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('El runtime regional no terminó de cargar.');
  }
  async function loadRegion(regionId, arrival = null) {
    if (!REGIONS[regionId]) throw new Error('Región desconocida: ' + regionId);
    state.currentRegionId = regionId;
    state.runtimeReady = false;
    state.travelEligible = false;
    state.travelInProgress = Boolean(arrival);
    state.movementSinceLoad = 0;
    state.lastPosition = null;
    loading.classList.remove('hide');
    loadText.textContent = 'Cargando ' + REGIONS[regionId].name + '…';
    updateWorldHud();
    const runtimeUrl = REGIONS[regionId].runtime + '?v=' + encodeURIComponent(cacheKey + '-' + BUILD_ID);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('La navegación regional no terminó.')), 120000);
      frame.addEventListener('load', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      frame.src = runtimeUrl;
    });
    const api = await waitForRuntime();
    if (api.metadata.regionId !== regionId) throw new Error('El runtime abrió ' + api.metadata.regionId + ' en lugar de ' + regionId);
    if (api.metadata.buildId !== REGIONS[regionId].expectedBuildId) throw new Error('Build regional inesperada: ' + api.metadata.buildId);
    if (arrival) {
      api.setRegionalPosition(arrival.x, arrival.z);
      api.setHeading(arrival.heading);
      api.saveProgress();
    }
    const runtimeState = api.getState();
    state.runtimeReady = true;
    state.runtimeBuildId = api.metadata.buildId;
    state.runtimeBinarySha256 = api.metadata.binary.sha256;
    state.lastPosition = { x: runtimeState.position.x, z: runtimeState.position.z };
    state.discoveredRegions.add(regionId);
    state.travelInProgress = false;
    loading.classList.add('hide');
    updateWorldHud();
    saveWorld(arrival ? 'region-arrival' : 'region-load');
    return api;
  }
  async function travel() {
    if (!state.travelEligible || state.travelInProgress) return false;
    if (!CAPABILITIES.has(ROUTE.capability)) throw new Error('La expedición no dispone de ' + ROUTE.capability);
    const api = runtime();
    if (!api) return false;
    const from = state.currentRegionId;
    const to = targetRegionId();
    state.travelInProgress = true;
    state.travelEligible = false;
    updateWorldHud();
    api.saveProgress();
    state.discoveredConnections.add(ROUTE.id);
    state.transitionCount++;
    showToast('Ruta marítima descubierta: ' + currentRegion().name + ' ↔ ' + REGIONS[to].name);
    await loadRegion(to, ROUTE.arrivals[to]);
    saveWorld('regional-transition');
    return true;
  }
  function pollRuntime() {
    if (!state.runtimeReady || state.travelInProgress) return;
    const api = runtime();
    if (!api) return;
    const runtimeState = api.getState();
    const position = runtimeState.position;
    if (state.lastPosition) {
      const delta = Math.hypot(position.x - state.lastPosition.x, position.z - state.lastPosition.z);
      if (delta >= .002 && delta <= 5) state.movementSinceLoad += delta;
    }
    state.lastPosition = { x: position.x, z: position.z };
    const departure = ROUTE.departures[state.currentRegionId];
    state.exitDistance = Math.hypot(position.x - departure.x, position.z - departure.z);
    state.travelEligible = state.movementSinceLoad >= 1.2 && state.exitDistance <= 14 && CAPABILITIES.has(ROUTE.capability) && runtimeState.worldMode === 'regional';
    updateWorldHud();
    window.__WAFT_ADVENTURE_0159_STATS__ = {
      buildId: BUILD_ID,
      valid: true,
      currentRegionId: state.currentRegionId,
      discoveredRegions: state.discoveredRegions.size,
      discoveredConnections: state.discoveredConnections.size,
      transitionCount: state.transitionCount,
      runtimeReady: state.runtimeReady,
      runtimeBuildId: state.runtimeBuildId,
      runtimeBinarySha256: state.runtimeBinarySha256,
      movementSinceLoad: state.movementSinceLoad,
      exitDistance: state.exitDistance,
      travelEligible: state.travelEligible,
      capabilities: [...CAPABILITIES],
      restored: state.restored,
      pageErrors: [...state.pageErrors]
    };
  }
  function prepareExitProbe() {
    const api = runtime();
    if (!api) throw new Error('Runtime no disponible');
    const departure = ROUTE.departures[state.currentRegionId];
    const candidates = [];
    for (let radius = 5; radius >= 2; radius -= 1) {
      for (let index = 0; index < 24; index++) {
        const angle = index / 24 * Math.PI * 2;
        const x = departure.x + Math.cos(angle) * radius;
        const z = departure.z + Math.sin(angle) * radius;
        const surface = api.sampleSurface(x, z);
        if (!surface.inside) continue;
        candidates.push({ x, z, radius, water: !surface.land });
      }
    }
    const candidate = candidates.find(item => item.water) || candidates[0];
    if (!candidate) throw new Error('No se encontró una aproximación al punto de salida');
    api.setRegionalPosition(candidate.x, candidate.z);
    const dx = departure.x - candidate.x;
    const dz = departure.z - candidate.z;
    const yaw = Math.atan2(dx, dz);
    api.setHeading(yaw);
    state.movementSinceLoad = 0;
    state.lastPosition = { x: candidate.x, z: candidate.z };
    return { start: candidate, target: { ...departure }, yaw, suggestedMilliseconds: 1100 };
  }

  travelButton.addEventListener('click', () => travel().catch(fail));
  addEventListener('beforeunload', () => { try { saveWorld('beforeunload'); } catch {} });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { try { saveWorld('hidden'); } catch {} } });
  restoreWorld();
  setInterval(pollRuntime, 180);

  window.WAFTAdventure0159 = {
    getState() { return { ...snapshot(), runtimeReady: state.runtimeReady, runtimeBuildId: state.runtimeBuildId, runtimeBinarySha256: state.runtimeBinarySha256, movementSinceLoad: state.movementSinceLoad, exitDistance: state.exitDistance, travelEligible: state.travelEligible, capabilities: [...CAPABILITIES], pageErrors: [...state.pageErrors] }; },
    getRuntime() { return runtime(); },
    getRoute() { return JSON.parse(JSON.stringify(ROUTE)); },
    prepareExitProbe,
    travel,
    save() { return saveWorld('api'); },
    reset() { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('waft.baleares.travel.v1'); localStorage.removeItem('waft.catalunya-litoral.travel.v1'); location.reload(); },
    buildId: BUILD_ID,
    regions: JSON.parse(JSON.stringify(REGIONS))
  };

  loadRegion(state.currentRegionId).then(() => {
    window.__WAFT_ADVENTURE_0159_READY__ = true;
  }).catch(fail);
})();
</script>
</body>
</html>`;

fs.writeFileSync(CATALUNYA_RUNTIME, catalunyaRuntime);
fs.writeFileSync(ADVENTURE_PAGE, adventure);
const report = {
  formatVersion: 1,
  valid: true,
  buildId,
  inputsSha256: inputsHash,
  outputs: {
    adventure: path.relative(ROOT, ADVENTURE_PAGE),
    catalunyaRuntime: path.relative(ROOT, CATALUNYA_RUNTIME)
  },
  protectedInputs: {
    balearesRuntimeBlobExpected: '54efca64586886fdd2f385f928489c786f925f31',
    adventure0158BlobExpected: 'b605801b9b18cf5d88e24968b9674db0503eef21'
  },
  regions,
  route,
  capabilities: ['land', 'long_water']
};
fs.writeFileSync(BUILD_REPORT, stableJson(report));
process.stdout.write(stableJson(report));
