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
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
assert.ok(input.includes("KeyS"));
assert.ok(!input.includes("sHoldThreshold"));
assert.ok(input.includes("getBoundingClientRect"), "fixed joystick must use its actual screen centre");
assert.ok(!input.includes("joystickBase.style.left"), "joystick base must not jump to the touch point");
assert.ok(!input.includes("joystickBase.style.top"), "joystick base must not jump to the touch point");
assert.ok(!input.includes("joystickBase.hidden"), "fixed joystick must remain visible");
assert.ok(html.includes('id="joystickBase" class="joystick-base"'));
assert.ok(!html.includes('id="joystickBase" class="joystick-base" hidden'));
assert.ok(css.includes(".move-zone{position:fixed"));

console.log("WAFT control foundation 0.19.3: fixed joystick and movement tests passed.");
