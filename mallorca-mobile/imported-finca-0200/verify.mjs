import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// This verifier is intentionally changed after the workflow exists on main so GitHub runs it.
const root = path.dirname(new URL(import.meta.url).pathname);
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const vendor = path.resolve(root, "../assets/vendor/polyhaven");

assert.ok(html.includes("WAFT ADVENTURE · 0.20.0"));
assert.ok(html.includes("babylonjs.loaders.min.js"));
assert.ok(css.includes(".joystick"));
assert.ok(app.includes("yaw += dx"), "drag right must turn right");
assert.ok(app.includes("pitch - dy"), "drag up must look up");
assert.ok(app.includes("moveWithCollisions"));
assert.ok(!app.includes('id: "wooden_gate"'), "wooden_gate is a material, not a GLTF model");
assert.ok(app.includes('gate: makePBR("gate-wood", "wooden_gate"'), "gate must use the real wooden_gate PBR set");

const modelIds = [...app.matchAll(/\{ id: "([^"]+)"/g)].map((match) => match[1]);
assert.equal(modelIds.length, 26, `expected all 26 imported models, found ${modelIds.length}`);
assert.equal(new Set(modelIds).size, 26, "model placements must not contain duplicates");
for (const id of modelIds) {
  const entry = path.join(vendor, id, `${id}_1k.gltf`);
  assert.ok(fs.existsSync(entry), `missing GLTF entry: ${entry}`);
}

const textureIds = [
  "dry_ground_01",
  "stony_dirt_path",
  "patio_tiles",
  "white_plaster_rough_01",
  "worn_plaster_wall",
  "stone_wall_05",
  "clay_roof_tiles_03",
  "weathered_planks",
  "wooden_gate",
];
for (const id of textureIds) {
  for (const file of ["diffuse.jpg", "normal_gl.jpg", "roughness.jpg"]) {
    assert.ok(fs.existsSync(path.join(vendor, id, file)), `missing texture ${id}/${file}`);
  }
}

console.log(`Imported finca 0.20.0 validated: ${modelIds.length} GLTF models and ${textureIds.length} PBR materials.`);
