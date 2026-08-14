const FACE_NAMES = Object.freeze(['px', 'nx', 'py', 'ny', 'pz', 'nz']);
const FACE_INDEX = new Map(FACE_NAMES.map((name, index) => [name, index]));

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = vector => Math.hypot(vector[0], vector[1], vector[2]);

function normalize(vector) {
  const magnitude = length(vector);
  if (!(magnitude > 0)) throw new Error('Cannot normalize a zero-length vector');
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function assertFace(face) {
  const index = typeof face === 'number' ? face : FACE_INDEX.get(face);
  if (!Number.isInteger(index) || index < 0 || index >= FACE_NAMES.length) {
    throw new RangeError(`Unknown cube face: ${face}`);
  }
  return index;
}

function assertTile(tile) {
  const face = assertFace(tile?.face);
  const level = Number(tile?.level);
  const x = Number(tile?.x);
  const y = Number(tile?.y);
  const side = 2 ** level;
  if (!Number.isInteger(level) || level < 0 || level > 24) throw new RangeError(`Invalid tile level: ${tile?.level}`);
  if (!Number.isInteger(x) || x < 0 || x >= side) throw new RangeError(`Invalid tile x: ${tile?.x}`);
  if (!Number.isInteger(y) || y < 0 || y >= side) throw new RangeError(`Invalid tile y: ${tile?.y}`);
  return { face, level, x, y };
}

export { FACE_NAMES };

export function cubeFaceUvToUnit(face, u, v) {
  const index = assertFace(face);
  const cu = clamp(Number(u), -1, 1);
  const cv = clamp(Number(v), -1, 1);
  switch (index) {
    case 0: return normalize([1, cv, -cu]);
    case 1: return normalize([-1, cv, cu]);
    case 2: return normalize([cu, 1, -cv]);
    case 3: return normalize([cu, -1, cv]);
    case 4: return normalize([cu, cv, 1]);
    default: return normalize([-cu, cv, -1]);
  }
}

export function unitToCubeFaceUv(vector) {
  const [x, y, z] = normalize(vector);
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ax >= ay && ax >= az) {
    return x >= 0
      ? { face: 0, u: -z / ax, v: y / ax }
      : { face: 1, u: z / ax, v: y / ax };
  }
  if (ay >= ax && ay >= az) {
    return y >= 0
      ? { face: 2, u: x / ay, v: -z / ay }
      : { face: 3, u: x / ay, v: z / ay };
  }
  return z >= 0
    ? { face: 4, u: x / az, v: y / az }
    : { face: 5, u: -x / az, v: y / az };
}

export function latLonToUnit(lat, lon) {
  const phi = clamp(Number(lat), -90, 90) * Math.PI / 180;
  const lambda = Number(lon) * Math.PI / 180;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), Math.sin(phi), cosPhi * Math.sin(lambda)];
}

export function unitToLatLon(vector) {
  const [x, y, z] = normalize(vector);
  return {
    lat: Math.asin(clamp(y, -1, 1)) * 180 / Math.PI,
    lon: Math.atan2(z, x) * 180 / Math.PI
  };
}

export function tangentFrame(lat, lon) {
  const up = latLonToUnit(lat, lon);
  const lambda = Number(lon) * Math.PI / 180;
  const phi = clamp(Number(lat), -90, 90) * Math.PI / 180;
  const east = normalize([-Math.sin(lambda), 0, Math.cos(lambda)]);
  const north = normalize([-Math.sin(phi) * Math.cos(lambda), Math.cos(phi), -Math.sin(phi) * Math.sin(lambda)]);
  return { east, north, up };
}

export function tileKey(tile) {
  const valid = assertTile(tile);
  return `${FACE_NAMES[valid.face]}/${valid.level}/${valid.x}/${valid.y}`;
}

export function parseTileKey(key) {
  const [face, level, x, y, extra] = String(key).split('/');
  if (extra !== undefined) throw new Error(`Invalid cube-sphere tile key: ${key}`);
  return assertTile({ face, level: Number(level), x: Number(x), y: Number(y) });
}

export function tileBounds(tile) {
  const valid = assertTile(tile);
  const side = 2 ** valid.level;
  const span = 2 / side;
  const u0 = -1 + valid.x * span;
  const v0 = -1 + valid.y * span;
  return { ...valid, u0, v0, u1: u0 + span, v1: v0 + span };
}

export function tileCenterUnit(tile) {
  const bounds = tileBounds(tile);
  return cubeFaceUvToUnit(bounds.face, (bounds.u0 + bounds.u1) * 0.5, (bounds.v0 + bounds.v1) * 0.5);
}

export function tileAngularRadius(tile) {
  const bounds = tileBounds(tile);
  const center = tileCenterUnit(bounds);
  let radius = 0;
  for (const u of [bounds.u0, bounds.u1]) {
    for (const v of [bounds.v0, bounds.v1]) {
      radius = Math.max(radius, Math.acos(clamp(dot(center, cubeFaceUvToUnit(bounds.face, u, v)), -1, 1)));
    }
  }
  return radius;
}

export function tileContainingUnit(vector, level) {
  const safeLevel = Number(level);
  if (!Number.isInteger(safeLevel) || safeLevel < 0 || safeLevel > 24) throw new RangeError(`Invalid tile level: ${level}`);
  const { face, u, v } = unitToCubeFaceUv(vector);
  const side = 2 ** safeLevel;
  const x = clamp(Math.floor((u + 1) * 0.5 * side), 0, side - 1);
  const y = clamp(Math.floor((v + 1) * 0.5 * side), 0, side - 1);
  return { face, level: safeLevel, x, y };
}

export function tileContainingLatLon(lat, lon, level) {
  return tileContainingUnit(latLonToUnit(lat, lon), level);
}

export function parentTile(tile) {
  const valid = assertTile(tile);
  if (valid.level === 0) return null;
  return { face: valid.face, level: valid.level - 1, x: Math.floor(valid.x / 2), y: Math.floor(valid.y / 2) };
}

export function childTiles(tile) {
  const valid = assertTile(tile);
  const level = valid.level + 1;
  const x = valid.x * 2;
  const y = valid.y * 2;
  return [
    { face: valid.face, level, x, y },
    { face: valid.face, level, x: x + 1, y },
    { face: valid.face, level, x, y: y + 1 },
    { face: valid.face, level, x: x + 1, y: y + 1 }
  ];
}

export function selectFixedQuadtreeTiles(options = {}) {
  const baseLevel = clamp(Math.trunc(Number(options.baseLevel) || 0), 0, 20);
  const zones = (Array.isArray(options.zones) ? options.zones : []).map((zone, index) => {
    const level = clamp(Math.trunc(Number(zone?.level) || baseLevel), baseLevel, 20);
    const radians = clamp(Number(zone?.radians) || 0, 0, Math.PI);
    const lat = clamp(Number(zone?.lat) || 0, -90, 90);
    const lon = Number(zone?.lon) || 0;
    return { name: String(zone?.name || `zone-${index}`), level, radians, unit: latLonToUnit(lat, lon) };
  });
  const selected = [];
  let visited = 0;
  let refined = 0;

  const visit = tile => {
    visited++;
    const center = tileCenterUnit(tile);
    const angularRadius = tileAngularRadius(tile);
    let targetLevel = baseLevel;
    for (const zone of zones) {
      const angularDistance = Math.acos(clamp(dot(center, zone.unit), -1, 1));
      if (angularDistance <= zone.radians + angularRadius) targetLevel = Math.max(targetLevel, zone.level);
    }
    if (tile.level < targetLevel) {
      refined++;
      for (const child of childTiles(tile)) visit(child);
      return;
    }
    selected.push({ ...tile, angularRadius, center });
  };

  for (let face = 0; face < FACE_NAMES.length; face++) visit({ face, level: 0, x: 0, y: 0 });
  let balanced = selected.map(tile => ({ face: tile.face, level: tile.level, x: tile.x, y: tile.y }));
  let balancePasses = 0;
  let balanceRefinements = 0;
  for (; balancePasses < 24; balancePasses++) {
    const bounds = balanced.map(tile => ({ ...tile, ...tileBounds(tile) }));
    const refineKeys = new Set();
    for (let leftIndex = 0; leftIndex < bounds.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex++) {
        const left = bounds[leftIndex];
        const right = bounds[rightIndex];
        if (left.face !== right.face || Math.abs(left.level - right.level) <= 1) continue;
        const vertical = (Math.abs(left.u1 - right.u0) < 1e-12 || Math.abs(right.u1 - left.u0) < 1e-12)
          && Math.min(left.v1, right.v1) - Math.max(left.v0, right.v0) > 1e-12;
        const horizontal = (Math.abs(left.v1 - right.v0) < 1e-12 || Math.abs(right.v1 - left.v0) < 1e-12)
          && Math.min(left.u1, right.u1) - Math.max(left.u0, right.u0) > 1e-12;
        if (vertical || horizontal) refineKeys.add(tileKey(left.level < right.level ? left : right));
      }
    }
    if (!refineKeys.size) break;
    balanceRefinements += refineKeys.size;
    balanced = balanced.flatMap(tile => refineKeys.has(tileKey(tile)) ? childTiles(tile) : [tile]);
  }
  const tiles = balanced.map(tile => ({ ...tile, angularRadius: tileAngularRadius(tile), center: tileCenterUnit(tile) }));
  tiles.sort((a, b) => a.level - b.level || a.face - b.face || a.y - b.y || a.x - b.x);
  return { tiles, stats: { visited, refined, baseLevel, zones: zones.length, balancePasses, balanceRefinements } };
}

export function buildTileGrid(tile, resolution = 17) {
  const bounds = tileBounds(tile);
  const size = Number(resolution);
  if (!Number.isInteger(size) || size < 2 || size > 257) throw new RangeError(`Invalid tile resolution: ${resolution}`);
  const directions = new Float64Array(size * size * 3);
  let cursor = 0;
  for (let row = 0; row < size; row++) {
    const v = bounds.v0 + (bounds.v1 - bounds.v0) * row / (size - 1);
    for (let column = 0; column < size; column++) {
      const u = bounds.u0 + (bounds.u1 - bounds.u0) * column / (size - 1);
      const direction = cubeFaceUvToUnit(bounds.face, u, v);
      directions[cursor++] = direction[0];
      directions[cursor++] = direction[1];
      directions[cursor++] = direction[2];
    }
  }
  const indexCount = (size - 1) * (size - 1) * 6;
  const IndexArray = size * size <= 65535 ? Uint16Array : Uint32Array;
  const indices = new IndexArray(indexCount);
  let index = 0;
  for (let row = 0; row < size - 1; row++) {
    for (let column = 0; column < size - 1; column++) {
      const a = row * size + column;
      const b = a + 1;
      const c = a + size;
      const d = c + 1;
      indices[index++] = a;
      indices[index++] = b;
      indices[index++] = c;
      indices[index++] = b;
      indices[index++] = d;
      indices[index++] = c;
    }
  }
  return { tile: bounds, resolution: size, directions, indices };
}

export function selectVisibleTiles(options = {}) {
  const cameraDirection = normalize(options.cameraDirection || [1, 0, 0]);
  const radius = Number(options.radius) || 1;
  const altitude = Math.max(0.001, Number(options.altitude) || 0.001);
  const minLevel = clamp(Math.trunc(Number(options.minLevel) || 0), 0, 20);
  const maxLevel = clamp(Math.trunc(Number(options.maxLevel) || 8), minLevel, 20);
  const resolution = clamp(Math.trunc(Number(options.resolution) || 17), 2, 257);
  const viewportHeight = Math.max(1, Number(options.viewportHeight) || 720);
  const fovY = clamp(Number(options.fovY) || Math.PI / 3, 0.1, Math.PI - 0.1);
  const targetPixels = Math.max(0.25, Number(options.targetPixels) || 5);
  const horizonPadding = Math.max(0, Number(options.horizonPadding) || 0.015);
  const focalPixels = viewportHeight / (2 * Math.tan(fovY * 0.5));
  const cameraRadius = radius + altitude;
  const cameraPosition = cameraDirection.map(component => component * cameraRadius);
  const horizonAngle = Math.acos(clamp(radius / cameraRadius, -1, 1));
  const selected = [];
  let visited = 0;
  let culled = 0;
  let refined = 0;

  const visit = tile => {
    visited++;
    const center = tileCenterUnit(tile);
    const angularRadius = tileAngularRadius(tile);
    const angularDistance = Math.acos(clamp(dot(cameraDirection, center), -1, 1));
    if (angularDistance > horizonAngle + angularRadius + horizonPadding) {
      culled++;
      return;
    }
    const surfaceCenter = center.map(component => component * radius);
    const centerDistance = Math.hypot(
      cameraPosition[0] - surfaceCenter[0],
      cameraPosition[1] - surfaceCenter[1],
      cameraPosition[2] - surfaceCenter[2]
    );
    const chordRadius = radius * Math.sin(Math.min(Math.PI * 0.5, angularRadius));
    const nearestDistance = Math.max(altitude, centerDistance - chordRadius);
    const geometricError = (2 * radius * Math.sin(angularRadius)) / (resolution - 1);
    const projectedError = geometricError * focalPixels / nearestDistance;
    if (tile.level < minLevel || (tile.level < maxLevel && projectedError > targetPixels)) {
      refined++;
      for (const child of childTiles(tile)) visit(child);
      return;
    }
    selected.push({ ...tile, projectedError, angularDistance, angularRadius });
  };

  for (let face = 0; face < FACE_NAMES.length; face++) visit({ face, level: 0, x: 0, y: 0 });
  selected.sort((a, b) => a.level - b.level || a.face - b.face || a.y - b.y || a.x - b.x);
  return {
    tiles: selected,
    stats: { visited, culled, refined, horizonAngle, minLevel, maxLevel, targetPixels }
  };
}

export const vectorMath = Object.freeze({ clamp, dot, length, normalize });
