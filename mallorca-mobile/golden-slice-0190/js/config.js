export const BUILD = Object.freeze({
  id: "waft-adventure-golden-slice-0190",
  version: "0.19.0",
  label: "Golden Slice Llevant",
  protectedBase: "0.17.0",
});

export const SAVE_KEY = "waft.adventure.goldenSlice.0.19.0";
export const SAVE_SCHEMA_VERSION = 1;

export const REGION = Object.freeze({
  id: "baleares",
  zoneId: "llevant",
  name: "Llevant de Mallorca",
  seed: 180003,
  visualBiome: "mediterranean-coastal",
  modifiers: ["dry", "agricultural", "coastal-salt"],
  culturalFamily: "balearic",
  qualityTargetFps: 30,
  bounds: { minX: -94, maxX: 94, minZ: -86, maxZ: 86 },
  spawn: { x: -18, z: 49, yaw: Math.PI },
});

export const OBJECTIVES = Object.freeze([
  "Sigue el camino de piedra y localiza las notas de la expedición.",
  "Inspecciona las huellas junto al olivar.",
  "Llega al embarcadero para cerrar la ruta de prueba.",
  "Golden slice completada. Explora libremente o guarda la partida.",
]);

export const INTERACTABLES = Object.freeze([
  {
    id: "expedition-notes",
    type: "pickup",
    position: { x: 3, z: 19 },
    radius: 3.2,
    label: "Recoger notas de la expedición",
    title: "Notas de campo recuperadas",
    requiredStage: 0,
    nextStage: 1,
  },
  {
    id: "starter-tracks",
    type: "clue",
    position: { x: 43, z: -10 },
    radius: 3.5,
    label: "Examinar huellas",
    title: "Tres rutas posibles: Europa, África y Asia",
    requiredStage: 1,
    nextStage: 2,
  },
  {
    id: "dock-marker",
    type: "destination",
    position: { x: -52, z: -51 },
    radius: 4.4,
    label: "Examinar el embarcadero",
    title: "Ruta local validada",
    requiredStage: 2,
    nextStage: 3,
  },
]);

export const DISTRICTS = Object.freeze([
  { id: "seafront", weight: 0.24 },
  { id: "tourism", weight: 0.2 },
  { id: "residential-low", weight: 0.18 },
  { id: "agricultural-edge", weight: 0.22 },
  { id: "rural-edge", weight: 0.16 },
]);

export const QUALITY = Object.freeze({
  low: { label: "BAJO", hardwareScale: 1.55, vegetation: 52, buildings: 20, shadows: false },
  medium: { label: "MEDIO", hardwareScale: 1.18, vegetation: 86, buildings: 30, shadows: true },
  high: { label: "ALTO", hardwareScale: 1.0, vegetation: 126, buildings: 40, shadows: true },
});
