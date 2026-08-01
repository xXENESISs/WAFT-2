const TERRAIN_MAGIC = 'WAFTHGT1';
const LANDCOVER_MAGIC = 'WAFTLCV1';
const HEADER_BYTES = 64;
const NODATA_ELEVATION = -32768;

function writeMagic(buffer, magic) {
  buffer.write(magic, 0, 8, 'ascii');
}

function writeCommonHeader(buffer, magic, columns, rows, bounds) {
  writeMagic(buffer, magic);
  buffer.writeUInt16LE(1, 8);
  buffer.writeUInt16LE(HEADER_BYTES, 10);
  buffer.writeUInt16LE(columns, 12);
  buffer.writeUInt16LE(rows, 14);
  buffer.writeDoubleLE(bounds.west, 16);
  buffer.writeDoubleLE(bounds.east, 24);
  buffer.writeDoubleLE(bounds.south, 32);
  buffer.writeDoubleLE(bounds.north, 40);
}

export function encodeTerrain({ columns, rows, bounds, elevations, seaLevelMeters = 0 }) {
  if (!(elevations instanceof Int16Array)) throw new TypeError('elevations must be Int16Array');
  if (elevations.length !== columns * rows) throw new Error('terrain cell count mismatch');
  const buffer = Buffer.allocUnsafe(HEADER_BYTES + elevations.length * 2);
  writeCommonHeader(buffer, TERRAIN_MAGIC, columns, rows, bounds);
  buffer.writeFloatLE(seaLevelMeters, 48);
  buffer.writeFloatLE(1, 52);
  buffer.writeInt32LE(NODATA_ELEVATION, 56);
  buffer.writeUInt32LE(elevations.length, 60);
  for (let index = 0; index < elevations.length; index++) buffer.writeInt16LE(elevations[index], HEADER_BYTES + index * 2);
  return buffer;
}

export function encodeLandcover({ columns, rows, bounds, classes, classCount }) {
  if (!(classes instanceof Uint8Array)) throw new TypeError('classes must be Uint8Array');
  if (classes.length !== columns * rows) throw new Error('landcover cell count mismatch');
  const buffer = Buffer.allocUnsafe(HEADER_BYTES + classes.length);
  writeCommonHeader(buffer, LANDCOVER_MAGIC, columns, rows, bounds);
  buffer.writeUInt16LE(classCount, 48);
  buffer.writeUInt16LE(0, 50);
  buffer.writeUInt32LE(classes.length, 52);
  buffer.writeUInt32LE(0, 56);
  buffer.writeUInt32LE(0, 60);
  Buffer.from(classes.buffer, classes.byteOffset, classes.byteLength).copy(buffer, HEADER_BYTES);
  return buffer;
}

export function decodeTerrainHeader(buffer) {
  if (buffer.subarray(0, 8).toString('ascii') !== TERRAIN_MAGIC) throw new Error('Invalid terrain magic');
  return {
    formatVersion: buffer.readUInt16LE(8),
    headerBytes: buffer.readUInt16LE(10),
    columns: buffer.readUInt16LE(12),
    rows: buffer.readUInt16LE(14),
    bounds: {
      west: buffer.readDoubleLE(16),
      east: buffer.readDoubleLE(24),
      south: buffer.readDoubleLE(32),
      north: buffer.readDoubleLE(40)
    },
    seaLevelMeters: buffer.readFloatLE(48),
    metersPerUnit: buffer.readFloatLE(52),
    nodata: buffer.readInt32LE(56),
    cellCount: buffer.readUInt32LE(60)
  };
}

export function decodeLandcoverHeader(buffer) {
  if (buffer.subarray(0, 8).toString('ascii') !== LANDCOVER_MAGIC) throw new Error('Invalid landcover magic');
  return {
    formatVersion: buffer.readUInt16LE(8),
    headerBytes: buffer.readUInt16LE(10),
    columns: buffer.readUInt16LE(12),
    rows: buffer.readUInt16LE(14),
    bounds: {
      west: buffer.readDoubleLE(16),
      east: buffer.readDoubleLE(24),
      south: buffer.readDoubleLE(32),
      north: buffer.readDoubleLE(40)
    },
    classCount: buffer.readUInt16LE(48),
    cellCount: buffer.readUInt32LE(52)
  };
}

export const REGION_BINARY_FORMAT = Object.freeze({
  version: 1,
  headerBytes: HEADER_BYTES,
  nodataElevation: NODATA_ELEVATION,
  terrainMagic: TERRAIN_MAGIC,
  landcoverMagic: LANDCOVER_MAGIC
});
