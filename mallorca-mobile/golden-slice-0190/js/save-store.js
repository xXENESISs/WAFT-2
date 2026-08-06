import { BUILD, REGION, SAVE_KEY, SAVE_SCHEMA_VERSION } from "./config.js";

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function sanitize(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
  if (raw.regionId !== REGION.id || raw.zoneId !== REGION.zoneId) return null;

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    buildVersion: String(raw.buildVersion || BUILD.version),
    regionId: REGION.id,
    zoneId: REGION.zoneId,
    savedAt: String(raw.savedAt || new Date(0).toISOString()),
    player: {
      x: finiteNumber(raw.player?.x, REGION.spawn.x),
      z: finiteNumber(raw.player?.z, REGION.spawn.z),
      yaw: finiteNumber(raw.player?.yaw, REGION.spawn.yaw),
    },
    camera: {
      yaw: finiteNumber(raw.camera?.yaw, 0),
      pitch: finiteNumber(raw.camera?.pitch, 0.28),
    },
    objectiveStage: Math.max(0, Math.min(3, Math.trunc(raw.objectiveStage || 0))),
    collected: Array.isArray(raw.collected) ? [...new Set(raw.collected.filter((item) => typeof item === "string"))] : [],
    settings: {
      quality: ["low", "medium", "high"].includes(raw.settings?.quality) ? raw.settings.quality : "medium",
    },
  };
}

export class SaveStore {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  load() {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : null;
    } catch (error) {
      console.warn("[WAFT 0.19.0] No se pudo leer el guardado", error);
      return null;
    }
  }

  save(snapshot) {
    const payload = sanitize({
      ...snapshot,
      schemaVersion: SAVE_SCHEMA_VERSION,
      buildVersion: BUILD.version,
      regionId: REGION.id,
      zoneId: REGION.zoneId,
      savedAt: new Date().toISOString(),
    });

    if (!payload) throw new Error("Estado de guardado inválido");
    this.storage.setItem(SAVE_KEY, JSON.stringify(payload));
    return payload;
  }

  clear() {
    this.storage.removeItem(SAVE_KEY);
  }
}
