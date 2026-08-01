const DEG_TO_RAD = Math.PI / 180;
const KM_PER_DEG_LAT = 111.132;
const KM_PER_DEG_LON_EQUATOR = 111.320;

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

export function createLocalProjection(geography) {
  if (!geography || geography.projection !== 'local-equirectangular') {
    throw new Error(`Unsupported projection: ${geography?.projection ?? 'missing'}`);
  }

  const originLon = finite(geography.origin?.lon, 'geography.origin.lon');
  const originLat = finite(geography.origin?.lat, 'geography.origin.lat');
  const unitsPerKm = finite(geography.scale?.horizontalUnitsPerKm, 'horizontalUnitsPerKm');
  const compression = geography.scale?.emptySpaceCompression;
  const compressionFactor = compression?.mode === 'none' ? 1 : finite(compression?.factor ?? 1, 'emptySpaceCompression.factor');
  const kmPerDegreeLon = KM_PER_DEG_LON_EQUATOR * Math.cos(originLat * DEG_TO_RAD);
  const kmPerDegreeLat = KM_PER_DEG_LAT;

  const projectUncompressed = ({ lon, lat }) => ({
    x: (finite(lon, 'position.lon') - originLon) * kmPerDegreeLon * unitsPerKm,
    z: -(finite(lat, 'position.lat') - originLat) * kmPerDegreeLat * unitsPerKm
  });

  const project = position => {
    const raw = projectUncompressed(position);
    return { x: raw.x * compressionFactor, z: raw.z * compressionFactor };
  };

  const unproject = ({ x, z }) => ({
    lon: originLon + finite(x, 'local.x') / compressionFactor / unitsPerKm / kmPerDegreeLon,
    lat: originLat - finite(z, 'local.z') / compressionFactor / unitsPerKm / kmPerDegreeLat
  });

  const bounds = geography.bounds;
  const corners = [
    project({ lon: bounds.west, lat: bounds.north }),
    project({ lon: bounds.east, lat: bounds.north }),
    project({ lon: bounds.west, lat: bounds.south }),
    project({ lon: bounds.east, lat: bounds.south })
  ];
  const localBounds = {
    minX: Math.min(...corners.map(point => point.x)),
    maxX: Math.max(...corners.map(point => point.x)),
    minZ: Math.min(...corners.map(point => point.z)),
    maxZ: Math.max(...corners.map(point => point.z))
  };

  return {
    project,
    unproject,
    projectUncompressed,
    localBounds,
    metadata: {
      type: geography.projection,
      origin: { lon: originLon, lat: originLat },
      unitsPerKm,
      kmPerDegreeLon,
      kmPerDegreeLat,
      compression: {
        mode: compression?.mode ?? 'none',
        factor: compressionFactor,
        preserveCoastline: compression?.preserveCoastline ?? true,
        anchorIds: compression?.anchorIds ?? []
      },
      axis: { x: 'east', y: 'up', z: 'south' }
    }
  };
}

export function geoBoundsContains(bounds, position) {
  return position.lon >= bounds.west && position.lon <= bounds.east && position.lat >= bounds.south && position.lat <= bounds.north;
}
