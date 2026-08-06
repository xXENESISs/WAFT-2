import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = path.dirname(new URL(import.meta.url).pathname);
const required = [
  "index.html",
  "styles.css",
  "js/config.js",
  "js/movement-math.js",
  "js/input.js",
  "js/save.js",
  "js/world.js",
  "js/player.js",
  "js/main.js",
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Falta ${file}`);
}

const math = await import(pathToFileURL(path.join(root, "js/movement-math.js")));

const straight = math.shapeStick(0.18, 0.92);
assert.equal(straight.x, 0, "small horizontal thumb drift must snap to vertical");
assert.ok(straight.y > 0.8, "forward magnitude should remain strong");
assert.equal(straight.axis, "vertical");

const diagonal = math.shapeStick(0.8, 0.8);
assert.ok(diagonal.x > 0 && diagonal.y > 0, "real diagonals must remain diagonals");
assert.ok(Math.abs(diagonal.magnitude - 1) < 1e-9);

const forward = math.cameraRelativeDirection(0, 1, 0);
assert.ok(Math.abs(forward.x) < 1e-9);
assert.ok(Math.abs(forward.z + 1) < 1e-9);

const screenLeft = math.cameraRelativeDirection(-1, 0, 0);
assert.ok(screenLeft.x > 0, "Babylon left-handed screen-left must map to positive world X at yaw 0");
assert.ok(Math.abs(screenLeft.z) < 1e-9);

let x = 0;
let z = 0;
for (let index = 0; index < 600; index += 1) {
  const direction = math.cameraRelativeDirection(straight.x, straight.y, 0);
  x += direction.x * (1 / 60);
  z += direction.z * (1 / 60);
}
assert.ok(Math.abs(x) < 1e-10, `straight movement drifted laterally by ${x}`);
assert.ok(z < -9.9, "straight movement should advance forward");

const input = fs.readFileSync(path.join(root, "js/input.js"), "utf8");
assert.ok(input.includes("KeyS"));
assert.ok(!input.includes("sHoldThreshold"));

console.log("WAFT control foundation 0.19.2: movement tests passed.");
