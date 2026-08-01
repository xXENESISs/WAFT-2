import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';

const LEGACY = Object.freeze({
  columns: 256,
  rows: 158,
  west: 2.25,
  east: 3.55,
  south: 39.2,
  north: 40.0,
  maxElevationMeters: 1435
});

const EXTRA_ISLANDS = Object.freeze([
  { name: 'Menorca', shape: 'Menorca', maxHeightMeters: 5.15 / 16 * 1435, peaks: [[-.35, -.04, .78], [.30, .05, .57]], smooth: 3 },
  { name: 'Ibiza', shape: 'Ibiza', maxHeightMeters: 5.55 / 16 * 1435, peaks: [[-.18, -.12, .86], [.36, .10, .61]], smooth: 3 },
  { name: 'Formentera', shape: 'Formentera', maxHeightMeters: 2.25 / 16 * 1435, peaks: [[-.30, .05, .47], [.43, -.03, .38]], smooth: 3 },
  { name: 'Cabrera', shape: 'Cabrera', maxHeightMeters: 2.95 / 16 * 1435, peaks: [[-.18, -.05, .69], [.30, .05, .51]], smooth: 3 },
  { name: 'Espalmador', shape: 'Espalmador', maxHeightMeters: .72 / 16 * 1435, peaks: [[0, 0, .38]], smooth: 2, islet: true },
  { name: 'Es Vedrà', shape: 'EsVedra', maxHeightMeters: 2.45 / 16 * 1435, peaks: [[0, 0, .92]], smooth: 2, islet: true }
]);

function extractBootstrapData(html) {
  const terrainMatch = html.match(/window\.MALLORCA_DATA='([^']+)'/);
  if (!terrainMatch) throw new Error('Could not find window.MALLORCA_DATA in legacy HTML');
  const shapesMatch = html.match(/const GEO_SHAPES=(\{.*?\});\s*function projectGeo/s);
  if (!shapesMatch) throw new Error('Could not find GEO_SHAPES in legacy HTML');
  const raw = gunzipSync(Buffer.from(terrainMatch[1], 'base64'));
  if (raw.length !== LEGACY.columns * LEGACY.rows) {
    throw new Error(`Legacy terrain has ${raw.length} bytes; expected ${LEGACY.columns * LEGACY.rows}`);
  }
  return { raw: new Uint8Array(raw), shapes: JSON.parse(shapesMatch[1]) };
}

function morph(source, radius, mode, columns, rows) {
  const output = new Uint8Array(source.length);
  const radiusSquared = radius * radius;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let value = mode === 'erode' ? 1 : 0;
      let done = false;
      for (let dy = -radius; dy <= radius && !done; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radiusSquared) continue;
          const y = row + dy;
          const x = column + dx;
          const inside = x >= 0 && y >= 0 && x < columns && y < rows;
          const current = inside ? source[y * columns + x] : 0;
          if (mode === 'dilate' && current) { value = 1; done = true; break; }
          if (mode === 'erode' && !current) { value = 0; done = true; break; }
        }
      }
      output[row * columns + column] = value;
    }
  }
  return output;
}

function fillClosedHoles(mask, columns, rows) {
  const ocean = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  const push = index => {
    if (index >= 0 && index < mask.length && !mask[index] && !ocean[index]) {
      ocean[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let column = 0; column < columns; column++) {
    push(column);
    push((rows - 1) * columns + column);
  }
  for (let row = 0; row < rows; row++) {
    push(row * columns);
    push(row * columns + columns - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const row = Math.floor(index / columns);
    const column = index - row * columns;
    if (column > 0) push(index - 1);
    if (column < columns - 1) push(index + 1);
    if (row > 0) push(index - columns);
    if (row < rows - 1) push(index + columns);
  }
  const result = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index++) result[index] = ocean[index] ? 0 : 1;
  return result;
}

function distanceFromSources(sourceMask, columns, rows) {
  const distance = new Uint16Array(sourceMask.length);
  distance.fill(65535);
  const queue = new Int32Array(sourceMask.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < sourceMask.length; index++) {
    if (sourceMask[index]) {
      distance[index] = 0;
      queue[tail++] = index;
    }
  }
  while (head < tail) {
    const index = queue[head++];
    const row = Math.floor(index / columns);
    const column = index - row * columns;
    const nextDistance = distance[index] + 1;
    const visit = neighbour => {
      if (distance[neighbour] > nextDistance) {
        distance[neighbour] = nextDistance;
        queue[tail++] = neighbour;
      }
    };
    if (column > 0) visit(index - 1);
    if (column < columns - 1) visit(index + 1);
    if (row > 0) visit(index - columns);
    if (row < rows - 1) visit(index + columns);
  }
  return distance;
}

function prepareMallorca(raw) {
  const { columns, rows } = LEGACY;
  const original = Uint8Array.from(raw, value => value > 0 ? 1 : 0);
  let closed = morph(original, 2, 'dilate', columns, rows);
  closed = morph(closed, 2, 'erode', columns, rows);
  closed = fillClosedHoles(closed, columns, rows);
  const land = new Uint8Array(raw.length);
  const heights = Float32Array.from(raw);
  for (let index = 0; index < land.length; index++) land[index] = closed[index] || original[index] ? 1 : 0;

  for (let pass = 0; pass < 18; pass++) {
    const changes = [];
    for (let row = 1; row < rows - 1; row++) {
      for (let column = 1; column < columns - 1; column++) {
        const index = row * columns + column;
        if (!land[index] || heights[index] > 0) continue;
        let total = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const value = heights[(row + dy) * columns + column + dx];
            if (value > 0) { total += value; count++; }
          }
        }
        if (count >= 2) changes.push([index, Math.max(1, total / count)]);
      }
    }
    for (const [index, value] of changes) heights[index] = value;
    if (!changes.length) break;
  }
  for (let index = 0; index < heights.length; index++) if (land[index] && heights[index] <= 0) heights[index] = 1;

  const waterSources = new Uint8Array(land.length);
  for (let index = 0; index < land.length; index++) waterSources[index] = land[index] ? 0 : 1;
  const coastDistance = distanceFromSources(waterSources, columns, rows);
  for (let row = 1; row < rows - 1; row++) {
    for (let column = 1; column < columns - 1; column++) {
      const index = row * columns + column;
      if (!land[index]) continue;
      const slope = Math.abs(heights[index - 1] - heights[index + 1]) + Math.abs(heights[index - columns] - heights[index + columns]);
      if (coastDistance[index] <= 3 && heights[index] < 42 && slope < 58) {
        let t = Math.max(0, Math.min(1, (coastDistance[index] - .35) / 2.65));
        t = t * t * (3 - 2 * t);
        heights[index] = 1 + (heights[index] - 1) * t;
      }
    }
  }
  return { land, heights };
}

function sampleMallorca(prepared, lon, lat) {
  if (lon < LEGACY.west || lon > LEGACY.east || lat < LEGACY.south || lat > LEGACY.north) return null;
  const gx = (lon - LEGACY.west) / (LEGACY.east - LEGACY.west) * (LEGACY.columns - 1);
  const gy = (LEGACY.north - lat) / (LEGACY.north - LEGACY.south) * (LEGACY.rows - 1);
  const nearestColumn = Math.max(0, Math.min(LEGACY.columns - 1, Math.round(gx)));
  const nearestRow = Math.max(0, Math.min(LEGACY.rows - 1, Math.round(gy)));
  const nearest = nearestRow * LEGACY.columns + nearestColumn;
  if (!prepared.land[nearest]) return null;
  const column = Math.min(LEGACY.columns - 2, Math.max(0, Math.floor(gx)));
  const row = Math.min(LEGACY.rows - 2, Math.max(0, Math.floor(gy)));
  const fx = gx - column;
  const fy = gy - row;
  const ids = [row * LEGACY.columns + column, row * LEGACY.columns + column + 1, (row + 1) * LEGACY.columns + column, (row + 1) * LEGACY.columns + column + 1];
  const center = prepared.heights[nearest] || 1;
  const values = ids.map(index => prepared.land[index] ? prepared.heights[index] : center);
  const top = values[0] + (values[1] - values[0]) * fx;
  const bottom = values[2] + (values[3] - values[2]) * fx;
  return Math.max(0, (top + (bottom - top) * fy) / 255 * LEGACY.maxElevationMeters);
}

function samePoint(a, b) {
  return Math.abs(a[0] - b[0]) < 1e-10 && Math.abs(a[1] - b[1]) < 1e-10;
}

function smoothPolygon(points, iterations) {
  let output = points.length > 2 && samePoint(points[0], points.at(-1)) ? points.slice(0, -1) : points.slice();
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = [];
    for (let index = 0; index < output.length; index++) {
      const a = output[index];
      const b = output[(index + 1) % output.length];
      next.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]);
      next.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    output = next;
  }
  return output;
}

function polygonCentroid(polygon) {
  let area = 0;
  let x = 0;
  let z = 0;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const cross = polygon[previous][0] * polygon[index][1] - polygon[index][0] * polygon[previous][1];
    area += cross;
    x += (polygon[previous][0] + polygon[index][0]) * cross;
    z += (polygon[previous][1] + polygon[index][1]) * cross;
  }
  area *= .5;
  if (Math.abs(area) < 1e-8) return { x: 0, z: 0 };
  return { x: x / (6 * area), z: z / (6 * area) };
}

function pointInPolygon(polygon, x, z) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const xi = polygon[index][0];
    const zi = polygon[index][1];
    const xj = polygon[previous][0];
    const zj = polygon[previous][1];
    const crosses = (zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi || 1e-12) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentDistance(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const denominator = vx * vx + vz * vz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / denominator));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

function polygonEdgeDistance(polygon, x, z) {
  let best = Infinity;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    best = Math.min(best, segmentDistance(x, z, polygon[previous][0], polygon[previous][1], polygon[index][0], polygon[index][1]));
  }
  return best;
}

function prepareExtraIsland(definition, geoShapes, projection) {
  const geoPolygon = geoShapes[definition.shape];
  if (!geoPolygon) throw new Error(`Missing legacy polygon ${definition.shape}`);
  const local = geoPolygon.map(([lon, lat]) => {
    const point = projection.project({ lon, lat });
    return [point.x, point.z];
  });
  const polygon = smoothPolygon(local, definition.smooth);
  const center = polygonCentroid(polygon);
  const xs = polygon.map(point => point[0]);
  const zs = polygon.map(point => point[1]);
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const rz = (Math.max(...zs) - Math.min(...zs)) / 2;
  return {
    ...definition,
    polygon,
    center,
    rx,
    rz,
    edgeWidth: Math.max(3.1, Math.min(rx, rz) * .31)
  };
}

function sampleExtraIsland(island, localX, localZ) {
  if (!pointInPolygon(island.polygon, localX, localZ)) return null;
  const distance = polygonEdgeDistance(island.polygon, localX, localZ);
  const field = distance / island.edgeWidth;
  if (field <= 0) return null;
  const nx = (localX - island.center.x) / (island.rx || 1);
  const nz = (localZ - island.center.z) / (island.rz || 1);
  let peak = .24;
  for (const [px, pz, strength] of island.peaks) {
    const dx = (nx - px) / .52;
    const dz = (nz - pz) / .60;
    peak = Math.max(peak, strength * Math.exp(-(dx * dx + dz * dz) * 1.52));
  }
  const q = Math.min(1, field);
  const edge = q * q * q * (q * (q * 6 - 15) + 10);
  const shore = Math.min(1, q / .42);
  const texture = .988 + .014 * Math.sin((nx * 6.4 + nz * 4.8 + island.maxHeightMeters) * 2) + .008 * Math.sin((nx * 12.2 - nz * 8.6 + island.maxHeightMeters) * 1.6);
  return Math.max(.5, island.maxHeightMeters * (shore * .22 + edge * (.28 + peak * .82)) * texture);
}

export function loadLegacyBalearesSource({ htmlPath, projection }) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { raw, shapes } = extractBootstrapData(html);
  const mallorca = prepareMallorca(raw);
  const extraIslands = EXTRA_ISLANDS.map(definition => prepareExtraIsland(definition, shapes, projection));

  return {
    sample(lon, lat) {
      const mallorcaHeight = sampleMallorca(mallorca, lon, lat);
      if (mallorcaHeight !== null) return { elevationMeters: mallorcaHeight, source: 'legacy-mallorca-dem' };
      const local = projection.project({ lon, lat });
      for (const island of extraIslands) {
        const height = sampleExtraIsland(island, local.x, local.z);
        if (height !== null) return { elevationMeters: height, source: `procedural-${island.name.toLowerCase().replaceAll(' ', '-')}` };
      }
      return null;
    },
    metadata: {
      type: 'legacy-bootstrap',
      htmlPath,
      mallorcaRaster: LEGACY,
      extraIslands: extraIslands.map(island => ({ name: island.name, maxHeightMeters: island.maxHeightMeters })),
      limitations: [
        'Mallorca elevation is imported from the proven mobile prototype raster.',
        'Other islands use their real coast polygons with deterministic bootstrap relief.',
        'This source will be replaced by the external DEM ingestion stage.'
      ]
    }
  };
}
