import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  FACE_NAMES,
  buildTileGrid,
  childTiles,
  cubeFaceUvToUnit,
  latLonToUnit,
  parentTile,
  parseTileKey,
  selectVisibleTiles,
  tileBounds,
  tileContainingLatLon,
  tileKey,
  unitToCubeFaceUv,
  unitToLatLon
} from '../planet-0270/cube-sphere-core.mjs';

const close = (actual, expected, epsilon = 1e-12, message = '') => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} != ${expected}`);
};

for (const point of [
  { lat: 0, lon: 0 },
  { lat: 39.775, lon: -3.125 },
  { lat: -33.8688, lon: 151.2093 },
  { lat: 89.999, lon: 179.999 },
  { lat: -89.999, lon: -179.999 }
]) {
  const unit = latLonToUnit(point.lat, point.lon);
  const roundTrip = unitToLatLon(unit);
  close(roundTrip.lat, point.lat, 1e-8, 'latitude round-trip');
  close(Math.atan2(Math.sin((roundTrip.lon - point.lon) * Math.PI / 180), Math.cos((roundTrip.lon - point.lon) * Math.PI / 180)), 0, 1e-12, 'longitude round-trip');
  const cube = unitToCubeFaceUv(unit);
  const rebuilt = cubeFaceUvToUnit(cube.face, cube.u, cube.v);
  close(rebuilt[0], unit[0], 1e-12, 'cube x round-trip');
  close(rebuilt[1], unit[1], 1e-12, 'cube y round-trip');
  close(rebuilt[2], unit[2], 1e-12, 'cube z round-trip');
}

for (const face of FACE_NAMES) {
  const root = { face, level: 0, x: 0, y: 0 };
  const children = childTiles(root);
  assert.equal(children.length, 4);
  for (const child of children) assert.deepEqual(parentTile(child), { face: FACE_NAMES.indexOf(face), level: 0, x: 0, y: 0 });
}

for (const location of [
  { lat: 0, lon: 0 },
  { lat: 90, lon: 45 },
  { lat: -90, lon: -120 },
  { lat: 0, lon: 179.999999 },
  { lat: 0, lon: -179.999999 }
]) {
  const tile = tileContainingLatLon(location.lat, location.lon, 8);
  assert.deepEqual(parseTileKey(tileKey(tile)), tile);
}

const px = buildTileGrid({ face: 'px', level: 0, x: 0, y: 0 }, 17);
const pz = buildTileGrid({ face: 'pz', level: 0, x: 0, y: 0 }, 17);
for (let row = 0; row < 17; row++) {
  const pxOffset = (row * 17) * 3;
  const pzOffset = (row * 17 + 16) * 3;
  close(px.directions[pxOffset], pz.directions[pzOffset], 1e-15, 'shared face edge x');
  close(px.directions[pxOffset + 1], pz.directions[pzOffset + 1], 1e-15, 'shared face edge y');
  close(px.directions[pxOffset + 2], pz.directions[pzOffset + 2], 1e-15, 'shared face edge z');
}

const rootEdgeOccurrences = new Map();
for (const face of FACE_NAMES) {
  const grid = buildTileGrid({ face, level: 0, x: 0, y: 0 }, 17);
  const boundary = [];
  for (let column = 0; column < 17; column++) boundary.push(column);
  for (let row = 1; row < 17; row++) boundary.push(row * 17 + 16);
  for (let column = 15; column >= 0; column--) boundary.push(16 * 17 + column);
  for (let row = 15; row > 0; row--) boundary.push(row * 17);
  for (const vertex of boundary) {
    const offset = vertex * 3;
    const key = [grid.directions[offset], grid.directions[offset + 1], grid.directions[offset + 2]].map(value => value.toFixed(14)).join(',');
    rootEdgeOccurrences.set(key, (rootEdgeOccurrences.get(key) || 0) + 1);
  }
}
for (const occurrences of rootEdgeOccurrences.values()) {
  assert.ok(occurrences === 2 || occurrences === 3, `cube edge vertex belongs to ${occurrences} faces`);
}

const stableTile = buildTileGrid(tileContainingLatLon(39.775, -3.125, 8), 17);
const stableHash = crypto.createHash('sha256').update(Buffer.from(stableTile.directions.buffer)).update(Buffer.from(stableTile.indices.buffer)).digest('hex');
const rebuiltStableTile = buildTileGrid(tileContainingLatLon(39.775, -3.125, 8), 17);
const rebuiltHash = crypto.createHash('sha256').update(Buffer.from(rebuiltStableTile.directions.buffer)).update(Buffer.from(rebuiltStableTile.indices.buffer)).digest('hex');
assert.equal(rebuiltHash, stableHash, 'a planet-fixed tile changed when rebuilt');

const selectionOptions = {
  cameraDirection: latLonToUnit(39.775, -3.125),
  radius: 2102.432904,
  altitude: 1.5,
  minLevel: 2,
  maxLevel: 8,
  resolution: 17,
  viewportHeight: 720,
  targetPixels: 28
};
const firstSelection = selectVisibleTiles(selectionOptions);
const secondSelection = selectVisibleTiles(selectionOptions);
const firstKeys = firstSelection.tiles.map(tileKey);
const secondKeys = secondSelection.tiles.map(tileKey);
assert.deepEqual(firstKeys, secondKeys, 'LOD selection must be deterministic');
assert.ok(firstKeys.length > 0 && firstKeys.length < 512, `unexpected visible tile count: ${firstKeys.length}`);
assert.equal(new Set(firstKeys).size, firstKeys.length, 'LOD selection returned duplicate tile IDs');
assert.ok(firstSelection.tiles.some(tile => tile.level === 8), 'ground camera never reached the finest LOD');

const orbitalSelection = selectVisibleTiles({ ...selectionOptions, altitude: 4200 });
assert.ok(orbitalSelection.tiles.length > 0, 'orbital camera sees no planet tiles');
assert.ok(orbitalSelection.tiles.length < firstSelection.tiles.length, 'orbital view should use fewer tiles than ground view');

const altitudeBudgets = {};
for (const altitude of [1.5, 50, 300, 1000, 4200]) {
  const selection = selectVisibleTiles({ ...selectionOptions, altitude });
  altitudeBudgets[altitude] = selection.tiles.length;
  assert.ok(selection.tiles.length <= 320, `LOD budget exceeded at altitude ${altitude}: ${selection.tiles.length} tiles`);
  const bounds = selection.tiles.map(tile => ({ ...tile, ...tileBounds(tile) }));
  let maxSameFaceNeighbourDelta = 0;
  for (let leftIndex = 0; leftIndex < bounds.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < bounds.length; rightIndex++) {
      const left = bounds[leftIndex], right = bounds[rightIndex];
      if (left.face !== right.face) continue;
      const vertical = (Math.abs(left.u1 - right.u0) < 1e-12 || Math.abs(right.u1 - left.u0) < 1e-12) && Math.min(left.v1, right.v1) - Math.max(left.v0, right.v0) > 1e-12;
      const horizontal = (Math.abs(left.v1 - right.v0) < 1e-12 || Math.abs(right.v1 - left.v0) < 1e-12) && Math.min(left.u1, right.u1) - Math.max(left.u0, right.u0) > 1e-12;
      if (vertical || horizontal) maxSameFaceNeighbourDelta = Math.max(maxSameFaceNeighbourDelta, Math.abs(left.level - right.level));
    }
  }
  assert.ok(maxSameFaceNeighbourDelta <= 1, `same-face neighbour LOD jump ${maxSameFaceNeighbourDelta} at altitude ${altitude}`);
}

console.log(JSON.stringify({
  valid: true,
  version: '0.27.0-experimental',
  faces: FACE_NAMES.length,
  groundTiles: firstSelection.tiles.length,
  orbitalTiles: orbitalSelection.tiles.length,
  groundMaxLevel: Math.max(...firstSelection.tiles.map(tile => tile.level)),
  visitedNodes: firstSelection.stats.visited,
  stableTileHash: stableHash.slice(0, 16),
  altitudeBudgets
}, null, 2));
