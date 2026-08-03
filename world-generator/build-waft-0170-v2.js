'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const BUILD_ID = 'waft-adventure-0170-dense-places-v2';

function readText(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}
function readJson(relative) {
  return JSON.parse(readText(relative));
}
function readBuffer(relative) {
  return fs.readFileSync(path.join(ROOT, relative));
}
function write(relative, value) {
  const target = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, value);
}
function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function slug(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lugar';
}
function align4(value) {
  return (value + 3) & ~3;
}
function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`No se encontró ${label}`);
  return source.replace(search, replacement);
}
function replaceRegexRequired(source, regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`No se encontró ${label}`);
  return source.replace(regex, replacement);
}
function seedFrom(text) {
  return parseInt(sha256(text).slice(0, 8), 16) >>> 0;
}
function rng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function parseTerrain(buffer) {
  const magic = buffer.subarray(0, 8).toString('utf8');
  if (magic !== 'WAFTHGT1') throw new Error(`Terreno desconocido ${magic}`);
  const headerBytes = buffer.readUInt16LE(10);
  const columns = buffer.readUInt16LE(12);
  const rows = buffer.readUInt16LE(14);
  const nodata = buffer.readInt32LE(56);
  const elevations = new Int16Array(columns * rows);
  for (let index = 0; index < elevations.length; index++) elevations[index] = buffer.readInt16LE(headerBytes + index * 2);
  return { columns, rows, nodata, elevations };
}
function parseLandcover(buffer) {
  const magic = buffer.subarray(0, 8).toString('utf8');
  if (magic !== 'WAFTLCV1') throw new Error(`Cobertura desconocida ${magic}`);
  const headerBytes = buffer.readUInt16LE(10);
  const columns = buffer.readUInt16LE(12);
  const rows = buffer.readUInt16LE(14);
  return { columns, rows, classes: Uint8Array.from(buffer.subarray(headerBytes, headerBytes + columns * rows)) };
}

function sampler(metadata, terrain, landcover) {
  const bounds = metadata.terrain.localBounds;
  const sample = (x, z) => {
    const fx = (x - bounds.minX) / (bounds.maxX - bounds.minX) * (terrain.columns - 1);
    const fz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ) * (terrain.rows - 1);
    if (fx < 0 || fz < 0 || fx > terrain.columns - 1 || fz > terrain.rows - 1) return { raw: terrain.nodata, cover: 0, land: false };
    const column = Math.max(0, Math.min(terrain.columns - 1, Math.round(fx)));
    const row = Math.max(0, Math.min(terrain.rows - 1, Math.round(fz)));
    const index = row * terrain.columns + column;
    const raw = terrain.elevations[index];
    return { raw, cover: landcover.classes[index] || 0, land: raw !== terrain.nodata };
  };
  return sample;
}

function nearestLand(center, radius, sample) {
  if (sample(center.x, center.z).land) return center;
  for (let ring = 1; ring <= radius; ring += 1) {
    for (let step = 0; step < 48; step++) {
      const angle = step / 48 * Math.PI * 2;
      const point = { x: center.x + Math.cos(angle) * ring, z: center.z + Math.sin(angle) * ring };
      if (sample(point.x, point.z).land) return point;
    }
  }
  throw new Error(`No hay terreno firme cerca de ${center.x}, ${center.z}`);
}

function cityClass(name, regionId) {
  const lower = name.toLowerCase();
  if (lower.includes('barcelona') || lower.includes('palma')) return 'metropolis';
  if (lower.includes('tarragona') || lower.includes('girona') || lower.includes('lleida') || lower.includes('alcú') || lower.includes('eivissa') || lower.includes('ibiza') || lower.includes('maó') || lower.includes('mao') || lower.includes('menorca')) return 'city';
  return regionId === 'catalunya-litoral' ? 'town' : 'village';
}
function targetBuildings(cityType) {
  return cityType === 'metropolis' ? 560 : cityType === 'city' ? 390 : cityType === 'town' ? 290 : 230;
}

function createDenseZone(regionId, preset, metadata, sample, outputDir) {
  const zoneSlug = slug(preset.id || preset.name);
  const zoneId = `${regionId}-${zoneSlug}-0170`;
  const type = cityClass(preset.name, regionId);
  const target = targetBuildings(type);
  const regionalRadius = type === 'metropolis' ? 42 : type === 'city' ? 38 : 34;
  const center = nearestLand({ x: Number(preset.x), z: Number(preset.z) }, 18, sample);
  const columns = 97;
  const rows = 97;
  const bounds = { minX: center.x - regionalRadius, maxX: center.x + regionalRadius, minZ: center.z - regionalRadius, maxZ: center.z + regionalRadius };
  const terrainValues = new Int16Array(columns * rows);
  const coverValues = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    const z = bounds.minZ + row / (rows - 1) * (bounds.maxZ - bounds.minZ);
    for (let column = 0; column < columns; column++) {
      const x = bounds.minX + column / (columns - 1) * (bounds.maxX - bounds.minX);
      const value = sample(x, z);
      const index = row * columns + column;
      terrainValues[index] = value.raw;
      coverValues[index] = value.cover;
    }
  }

  const random = rng(seedFrom(`${BUILD_ID}:${regionId}:${preset.id}:${preset.name}`));
  const buildings = [];
  const occupied = new Map();
  const cellSize = 1.15;
  const centralClear = type === 'metropolis' ? 3.2 : 2.6;
  const roadPeriod = type === 'metropolis' ? 6.4 : 7.2;
  const maxRadius = regionalRadius * .73;
  const attempts = target * 45;
  const isRoad = (x, z) => {
    const dx = x - center.x;
    const dz = z - center.z;
    if (Math.abs(dx) < .72 || Math.abs(dz) < .72) return true;
    const gx = Math.abs(((dx + roadPeriod * .5) % roadPeriod + roadPeriod) % roadPeriod - roadPeriod * .5);
    const gz = Math.abs(((dz + roadPeriod * .5) % roadPeriod + roadPeriod) % roadPeriod - roadPeriod * .5);
    return gx < .48 || gz < .48;
  };
  for (let attempt = 0; attempt < attempts && buildings.length / 8 < target; attempt++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * maxRadius;
    let x = center.x + Math.cos(angle) * radius;
    let z = center.z + Math.sin(angle) * radius;
    x += (random() - .5) * .55;
    z += (random() - .5) * .55;
    const distance = Math.hypot(x - center.x, z - center.z);
    if (distance < centralClear || isRoad(x, z)) continue;
    const surface = sample(x, z);
    if (!surface.land) continue;
    const key = `${Math.round(x / cellSize)}:${Math.round(z / cellSize)}`;
    if (occupied.has(key)) continue;
    occupied.set(key, true);
    const urban = 1 - Math.min(1, distance / maxRadius);
    const width = .42 + random() * (.48 + urban * .38);
    const depth = .42 + random() * (.48 + urban * .34);
    const height = type === 'metropolis'
      ? 12 + random() * (26 + urban * 54)
      : type === 'city' ? 8 + random() * (18 + urban * 30)
      : 5 + random() * (12 + urban * 14);
    const angleBuilding = (Math.round(random() * 2) * Math.PI * .5) + (random() - .5) * .12;
    const kind = 1 + Math.floor(random() * 6);
    buildings.push(x, surface.raw, z, width, height, depth, angleBuilding, kind);
  }
  if (buildings.length / 8 < Math.floor(target * .82)) throw new Error(`${preset.name}: solo se generaron ${buildings.length / 8} edificios`);

  const roads = [];
  const roadOffsets = [];
  for (let value = -Math.floor(maxRadius / roadPeriod) * roadPeriod; value <= maxRadius; value += roadPeriod) roadOffsets.push(value);
  if (!roadOffsets.includes(0)) roadOffsets.push(0);
  const pushRoad = (x1, z1, x2, z2, klass) => {
    const a = sample(x1, z1);
    const b = sample(x2, z2);
    if (!a.land || !b.land) return;
    roads.push(x1, a.raw, z1, klass, x2, b.raw, z2, klass);
  };
  for (const offset of roadOffsets) {
    const extent = Math.sqrt(Math.max(0, maxRadius * maxRadius - offset * offset));
    pushRoad(center.x - extent, center.z + offset, center.x + extent, center.z + offset, Math.abs(offset) < .1 ? 2 : 4);
    pushRoad(center.x + offset, center.z - extent, center.x + offset, center.z + extent, Math.abs(offset) < .1 ? 2 : 4);
  }
  for (let segment = 0; segment < 32; segment++) {
    const a = segment / 32 * Math.PI * 2;
    const b = (segment + 1) / 32 * Math.PI * 2;
    const ring = maxRadius * .84;
    pushRoad(center.x + Math.cos(a) * ring, center.z + Math.sin(a) * ring, center.x + Math.cos(b) * ring, center.z + Math.sin(b) * ring, 3);
  }

  const centerSurface = sample(center.x, center.z);
  const landmarks = [
    center.x, centerSurface.raw, center.z, 100, 2,
    center.x + 2.1, sample(center.x + 2.1, center.z + 1.2).raw, center.z + 1.2, 85, 1,
    center.x - 2.2, sample(center.x - 2.2, center.z - 1.1).raw, center.z - 1.1, 78, 1
  ];
  const settlements = [center.x, centerSurface.raw, center.z, type === 'metropolis' ? 250 : type === 'city' ? 180 : 120];

  const terrainBytes = terrainValues.length * 2;
  const landcoverBytes = coverValues.length;
  const terrainOffset = 80;
  const landcoverOffset = terrainOffset + terrainBytes;
  const buildingOffset = align4(landcoverOffset + landcoverBytes);
  const roadOffset = buildingOffset + buildings.length * 4;
  const landmarkOffset = roadOffset + roads.length * 4;
  const settlementOffset = landmarkOffset + landmarks.length * 4;
  const totalBytes = settlementOffset + settlements.length * 4;
  const binary = Buffer.alloc(totalBytes);
  binary.write('WAFTLZ01', 0, 'ascii');
  binary.writeUInt16LE(1, 8);
  binary.writeUInt16LE(80, 10);
  binary.writeUInt16LE(columns, 12);
  binary.writeUInt16LE(rows, 14);
  binary.writeUInt32LE(buildings.length / 8, 16);
  binary.writeUInt32LE(roads.length / 4, 20);
  binary.writeUInt32LE(landmarks.length / 5, 24);
  binary.writeUInt32LE(settlements.length / 4, 28);
  binary.writeUInt32LE(terrainOffset, 32);
  binary.writeUInt32LE(landcoverOffset, 36);
  binary.writeUInt32LE(buildingOffset, 40);
  binary.writeUInt32LE(roadOffset, 44);
  binary.writeUInt32LE(landmarkOffset, 48);
  binary.writeUInt32LE(settlementOffset, 52);
  binary.writeUInt16LE(8, 56);
  binary.writeUInt16LE(4, 58);
  binary.writeUInt16LE(5, 60);
  binary.writeUInt16LE(4, 62);
  binary.writeUInt32LE(totalBytes, 64);
  binary.writeUInt32LE(columns * rows, 68);
  binary.writeInt32LE(-32768, 72);
  binary.writeUInt32LE(buildingOffset - (landcoverOffset + landcoverBytes), 76);
  for (let index = 0; index < terrainValues.length; index++) binary.writeInt16LE(terrainValues[index], terrainOffset + index * 2);
  Buffer.from(coverValues).copy(binary, landcoverOffset);
  const writeFloats = (values, offset) => values.forEach((value, index) => binary.writeFloatLE(value, offset + index * 4));
  writeFloats(buildings, buildingOffset);
  writeFloats(roads, roadOffset);
  writeFloats(landmarks, landmarkOffset);
  writeFloats(settlements, settlementOffset);

  const binaryFile = `${zoneSlug}-dense-v1.bin`;
  const metadataFile = `${zoneSlug}-dense-v1.json`;
  const binaryHash = sha256(binary);
  const zoneBuildId = `${regionId}-${zoneSlug}-${binaryHash.slice(0, 12)}`;
  const zoneName = `${preset.name} · ${type === 'metropolis' ? 'área metropolitana' : type === 'city' ? 'núcleo urbano' : 'entorno local'}`;
  const zoneMetadata = {
    formatVersion: 1,
    packageType: 'waft-local-zone',
    zoneId,
    presetId: preset.id,
    regionId,
    name: zoneName,
    buildId: zoneBuildId,
    center,
    regionalBounds: bounds,
    regionalRadius,
    worldScale: type === 'metropolis' ? 5.2 : 5.7,
    footprintScale: 1,
    terrain: { columns, rows },
    counts: {
      buildings: buildings.length / 8,
      roadVertices: roads.length / 4,
      landmarks: landmarks.length / 5,
      settlements: settlements.length / 4
    },
    labels: {
      landmarks: [
        { name: `Plaça central de ${preset.name}` },
        { name: `Mercat de ${preset.name}` },
        { name: `Mirador de ${preset.name}` }
      ],
      settlements: [{ name: preset.name }]
    },
    binary: { file: binaryFile, bytes: binary.length, sha256: binaryHash }
  };
  write(`${outputDir}/${binaryFile}`, binary);
  write(`${outputDir}/${metadataFile}`, JSON.stringify(zoneMetadata, null, 2) + '\n');
  return {
    id: zoneId,
    presetId: preset.id,
    name: zoneName,
    buildId: zoneBuildId,
    center,
    regionalRadius,
    metadataFile,
    binaryFile,
    binarySha256: binaryHash,
    binaryBytes: binary.length,
    buildingCount: buildings.length / 8,
    roadVertexCount: roads.length / 4,
    cityType: type
  };
}

function generateRegionZones(regionId, previewJson) {
  const metadata = readJson(`regions/${regionId}/preview/${previewJson}`);
  const terrain = parseTerrain(readBuffer(`regions/${regionId}/terrain.bin`));
  const landcover = parseLandcover(readBuffer(`regions/${regionId}/landcover.bin`));
  if (terrain.columns !== landcover.columns || terrain.rows !== landcover.rows) throw new Error(`${regionId}: cuadrículas incompatibles`);
  const sample = sampler(metadata, terrain, landcover);
  const outputDir = `regions/${regionId}/local-0170`;
  const presets = metadata.presets.filter(preset => preset.id !== 'overview');
  if (!presets.length) throw new Error(`${regionId}: no hay destinos jugables`);
  const zones = presets.map(preset => createDenseZone(regionId, preset, metadata, sample, outputDir));
  const registryHash = sha256(JSON.stringify(zones.map(zone => [zone.id, zone.buildId]))).slice(0, 12);
  const registry = {
    formatVersion: 1,
    registryType: 'waft-local-zone-registry',
    regionId,
    buildId: `${regionId}-local-0170-${registryHash}`,
    generatedAt: new Date().toISOString(),
    zoneCount: zones.length,
    totalBuildings: zones.reduce((sum, zone) => sum + zone.buildingCount, 0),
    zones
  };
  write(`${outputDir}/zones-v1.json`, JSON.stringify(registry, null, 2) + '\n');
  return registry;
}

function enhanceRuntime(source, options) {
  let output = source;
  output = output.replace(/<title>WAFT · Runtime regional de ([^<]+)<\/title>/, `<title>WAFT · ${options.label} ${options.version} · Lugares densos</title>`);
  output = output.replace(/<div id="hudTitle">[^<]+<\/div>/, `<div id="hudTitle">${options.label.toUpperCase()} ${options.version} · LUGARES VIVOS</div>`);
  output = replaceRequired(output, "  const localBase = `${base}local/`;", "  const localBase = `${base}local-0170/`;", 'directorio local');
  output = output.replace(/if \(!Array\.isArray\(localRegistry\.zones\)[^;]*;/, "if (!Array.isArray(localRegistry.zones) || localRegistry.zones.length < 1) throw new Error('El registro local no contiene destinos.');");
  output = replaceRequired(output,
    '    const entryRadiusFor = zone => Math.max(16, Math.min(32, Number(zone.regionalRadius) * .82));\n    const discoveryRadiusFor = zone => entryRadiusFor(zone) * 1.75;',
    '    const entryRadiusFor = zone => Math.max(28, Math.min(48, Number(zone.regionalRadius) * 1.15));\n    const discoveryRadiusFor = zone => entryRadiusFor(zone) * 1.55;',
    'radios de entrada');
  output = output.replace("graphicsProfile: 'enhanced-mobile-v3'", "graphicsProfile: 'enhanced-mobile-v4-dense-places'");
  output = output.replace(/version: '(?:012|002)'/, `version: '${options.version}'`);
  output = output.replace("      button.textContent = preset.name;", "      button.textContent = 'VISITAR ' + preset.name.toUpperCase();");
  output = output.replace("      scaleModeButton.textContent = 'SIN ZONA CERCANA';", "      scaleModeButton.textContent = 'ELIGE UN LUGAR ABAJO';");
  output = output.replace("        scaleModeButton.textContent = (retry ? 'REINTENTAR ' : 'ENTRAR EN ') + shortZoneName(proximityZone);", "        scaleModeButton.textContent = (retry ? 'REINTENTAR ' : 'ENTRAR EN ') + shortZoneName(proximityZone) + ' · ' + (proximityZone.buildingCount || '?') + ' EDIFICIOS';");
  output = output.replace('</style>', `
#placesGuide{position:fixed;z-index:18;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);background:rgba(5,20,25,.92);border:1px solid rgba(166,238,211,.55);border-radius:13px;padding:8px 12px;text-align:center;pointer-events:none;box-shadow:0 8px 28px #0008;max-width:min(70vw,520px)}
#placesGuide b{display:block;color:#a8efd2;font-size:11px;letter-spacing:.07em}#placesGuide span{display:block;color:#f0f5f1;font-size:9px;margin-top:2px}
#presets{max-width:68vw;padding:7px;gap:7px}#presets button{min-height:44px;border-color:#a8efd288;background:#173d39;font-size:10px}#scaleMode{min-height:48px;font-size:10px;font-weight:950}
@media(max-width:700px){#placesGuide{top:58px;max-width:76vw;padding:6px 9px}#placesGuide span{font-size:8px}#presets{max-width:62vw}}
</style>`);
  output = output.replace('<div id="presets"></div>', '<div id="placesGuide"><b>ELIGE UN DESTINO</b><span>Pulsa VISITAR abajo y después ENTRAR EN…</span></div><div id="presets"></div>');
  return output;
}

const DIRECT_TRAVEL_SCRIPT = `<script>
'use strict';
(() => {
  const button = document.getElementById('directTravelButton');
  const title = document.getElementById('directTravelTitle');
  const detail = document.getElementById('directTravelDetail');
  let busy = false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const app = () => window.WAFTAdventure0170;
  function refresh() {
    const current = app();
    if (!current) return;
    const state = current.getState();
    const toBarcelona = state.currentRegionId === 'baleares';
    title.textContent = toBarcelona ? 'DESTINO · BARCELONA' : 'DESTINO · MALLORCA';
    detail.textContent = toBarcelona ? 'Salida automática desde Port d’Alcúdia' : 'Regreso automático desde Port de Barcelona';
    button.textContent = busy ? 'PREPARANDO VIAJE…' : toBarcelona ? 'IR A BARCELONA' : 'VOLVER A MALLORCA';
    button.disabled = busy || !state.runtimeReady;
  }
  async function directTravel() {
    if (busy) return;
    const current = app();
    if (!current) throw new Error('WAFT todavía no está listo.');
    busy = true;
    refresh();
    try {
      const initialRegion = current.getState().currentRegionId;
      const probe = current.prepareExitProbe();
      const runtime = current.getRuntime();
      runtime.setInput(0, -1);
      await sleep(Math.max(1000, probe.suggestedMilliseconds || 1100));
      runtime.setInput(0, 0);
      const deadline = performance.now() + 8000;
      while (!current.getState().travelEligible && performance.now() < deadline) await sleep(120);
      if (!current.getState().travelEligible) throw new Error('No se pudo preparar la salida regional.');
      await current.travel();
      const arrivalDeadline = performance.now() + 120000;
      while (current.getState().currentRegionId === initialRegion && performance.now() < arrivalDeadline) await sleep(180);
      if (current.getState().currentRegionId === initialRegion) throw new Error('El viaje regional no terminó.');
    } finally {
      busy = false;
      refresh();
    }
  }
  button.addEventListener('click', () => directTravel().catch(error => {
    busy = false;
    detail.textContent = error.message;
    refresh();
  }));
  setInterval(refresh, 240);
  window.WAFTDirectTravel0170 = { travel: directTravel, refresh };
})();
</script>`;

function enhanceAdventure(source) {
  let output = source;
  output = output.replaceAll('WAFT 0.16.0', 'WAFT 0.17.0');
  output = output.replaceAll('waft-adventure-0160-visual-access-v1', BUILD_ID);
  output = output.replaceAll('region-runtime-baleares-012.html', 'region-runtime-baleares-013.html');
  output = output.replaceAll('region-runtime-catalunya-litoral-002.html', 'region-runtime-catalunya-litoral-003.html');
  output = output.replaceAll('__WAFT_ADVENTURE_0160_', '__WAFT_ADVENTURE_0170_');
  output = output.replaceAll('WAFTAdventure0160', 'WAFTAdventure0170');
  output = output.replaceAll('waft.adventure.0159.world.v1', 'waft.adventure.0170.world.v1');
  output = output.replace('</style>', `
#travelButton{display:none!important}
#directTravel{position:fixed;z-index:96;right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));width:min(245px,46vw);background:rgba(5,19,24,.94);border:1px solid #a8efd288;border-radius:15px;padding:9px;box-shadow:0 10px 34px #000a;backdrop-filter:blur(9px)}
#directTravelTitle{font-size:11px;font-weight:1000;color:#a8efd2;letter-spacing:.07em}#directTravelDetail{font-size:9px;color:#dcebe5;margin:3px 0 7px;line-height:1.25}
#directTravelButton{width:100%;min-height:48px;border:2px solid #a8efd2;border-radius:12px;background:linear-gradient(180deg,#347966,#205347);color:#fff;font-weight:1000;font-size:12px;box-shadow:0 6px 20px #0008}#directTravelButton:disabled{opacity:.62}
@media(max-width:700px){#directTravel{top:auto;bottom:max(12px,env(safe-area-inset-bottom));right:max(10px,env(safe-area-inset-right));width:min(220px,48vw);padding:7px}#directTravelDetail{display:none}#directTravelButton{min-height:46px;font-size:11px}}
</style>`);
  output = output.replace(/(<iframe id="runtime"[^>]*><\/iframe>)/, '<div id="directTravel"><div id="directTravelTitle">DESTINO REGIONAL</div><div id="directTravelDetail">Preparando rutas…</div><button id="directTravelButton" type="button">CARGANDO…</button></div>$1');
  output = output.replace('</body>', `${DIRECT_TRAVEL_SCRIPT}\n</body>`);
  return output;
}

const balearesRegistry = generateRegionZones('baleares', 'baleares-preview-v1.json');
const catalunyaRegistry = generateRegionZones('catalunya-litoral', 'catalunya-litoral-preview-v1.json');

const balearesRuntime = enhanceRuntime(readText('mallorca-mobile/region-runtime-baleares-012.html'), { label: 'Baleares', version: '013' });
const catalunyaRuntime = enhanceRuntime(readText('mallorca-mobile/region-runtime-catalunya-litoral-002.html'), { label: 'Catalunya litoral', version: '003' });
const adventure = enhanceAdventure(readText('mallorca-mobile/waft-0160.html'));

const outputs = {
  'mallorca-mobile/region-runtime-baleares-013.html': balearesRuntime,
  'mallorca-mobile/region-runtime-catalunya-litoral-003.html': catalunyaRuntime,
  'mallorca-mobile/waft-0170.html': adventure
};
for (const [relative, content] of Object.entries(outputs)) write(relative, content);

const status = {
  version: '0.17.0',
  buildId: BUILD_ID,
  generatedAt: new Date().toISOString(),
  travel: { directBarcelonaButton: true, directMallorcaButton: true, hiddenPortTrigger: false },
  regions: {
    baleares: { zones: balearesRegistry.zoneCount, buildings: balearesRegistry.totalBuildings, registryBuildId: balearesRegistry.buildId },
    catalunyaLitoral: { zones: catalunyaRegistry.zoneCount, buildings: catalunyaRegistry.totalBuildings, registryBuildId: catalunyaRegistry.buildId }
  },
  outputs: Object.fromEntries(Object.entries(outputs).map(([relative, content]) => [relative, { bytes: Buffer.byteLength(content), sha256: sha256(content) }]))
};
write('world-generator/waft-0170-build-status.json', JSON.stringify(status, null, 2) + '\n');
console.log(JSON.stringify(status, null, 2));
