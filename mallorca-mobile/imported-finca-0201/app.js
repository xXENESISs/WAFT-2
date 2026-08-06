const B = window.BABYLON;
const canvas = document.getElementById("renderCanvas");
const loading = document.getElementById("loading");
const loadingBar = document.getElementById("loadingBar");
const loadingLabel = document.getElementById("loadingLabel");
const statusText = document.getElementById("statusText");
const assetCount = document.getElementById("assetCount");
const resetButton = document.getElementById("resetButton");
const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystickKnob");
const runButton = document.getElementById("runButton");

const engine = new B.Engine(canvas, true, { stencil: true, adaptToDeviceRatio: true });
engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.45));

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0.57, 0.68, 0.71, 1);
scene.collisionsEnabled = true;
scene.imageProcessingConfiguration.toneMappingEnabled = true;
scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
scene.imageProcessingConfiguration.exposure = 1.08;
scene.imageProcessingConfiguration.contrast = 1.16;
scene.fogMode = B.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.0038;
scene.fogColor = new B.Color3(0.58, 0.67, 0.68);

const camera = new B.FreeCamera("third-person-camera", new B.Vector3(0, 4, -30), scene);
camera.minZ = 0.08;
camera.fov = 0.86;
scene.activeCamera = camera;

const hemi = new B.HemisphericLight("hemi", new B.Vector3(0, 1, 0), scene);
hemi.intensity = 0.6;
hemi.diffuse = new B.Color3(0.82, 0.87, 0.84);
hemi.groundColor = new B.Color3(0.24, 0.18, 0.12);

const sun = new B.DirectionalLight("sun", new B.Vector3(-0.55, -1, 0.35), scene);
sun.position = new B.Vector3(28, 38, -24);
sun.intensity = 2.25;
sun.diffuse = new B.Color3(1, 0.84, 0.64);
const shadows = new B.ShadowGenerator(1024, sun);
shadows.useBlurExponentialShadowMap = true;
shadows.blurKernel = 20;
shadows.bias = 0.0006;

const ASSETS = "../assets/vendor/polyhaven";

function progress(done, total, text) {
  loadingBar.style.width = `${Math.max(2, Math.round((done / Math.max(total, 1)) * 100))}%`;
  loadingLabel.textContent = text;
}

function pbr(name, folder, scale = 4, tint = null) {
  const material = new B.PBRMaterial(name, scene);
  const base = `${ASSETS}/${folder}`;
  material.albedoTexture = new B.Texture(`${base}/diffuse.jpg`, scene, true, false);
  material.bumpTexture = new B.Texture(`${base}/normal_gl.jpg`, scene, true, false);
  const rough = new B.Texture(`${base}/roughness.jpg`, scene, true, false);
  material.metallicTexture = rough;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.metallic = 0;
  material.roughness = 1;
  for (const texture of [material.albedoTexture, material.bumpTexture, rough]) {
    texture.uScale = scale;
    texture.vScale = scale;
    texture.wrapU = texture.wrapV = B.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
  }
  if (tint) material.albedoColor = B.Color3.FromHexString(tint);
  return material;
}

const materials = {
  ground: pbr("dry-ground", "dry_ground_01", 12, "#a18d68"),
  path: pbr("stony-path", "stony_dirt_path", 8),
  patio: pbr("patio", "patio_tiles", 6),
  plaster: pbr("plaster", "white_plaster_rough_01", 3.2, "#e4dcc5"),
  worn: pbr("worn", "worn_plaster_wall", 3),
  stone: pbr("stone", "stone_wall_05", 3.5),
  roof: pbr("roof", "clay_roof_tiles_03", 5),
  wood: pbr("wood", "weathered_planks", 3.5),
  gate: pbr("gate", "wooden_gate", 2.2),
};

function makeBox(name, size, position, material, collidable = true) {
  const mesh = B.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.copyFrom(position);
  mesh.material = material;
  mesh.checkCollisions = collidable;
  mesh.receiveShadows = true;
  shadows.addShadowCaster(mesh);
  return mesh;
}

function gateLeaf(name, hingeX, angle) {
  const root = new B.TransformNode(name, scene);
  root.position.set(hingeX, 0, -10.3);
  root.rotation.y = angle;
  const direction = hingeX < 0 ? 1 : -1;
  for (let index = 0; index < 7; index += 1) {
    const plank = makeBox(`${name}-plank-${index}`, { width: 0.38, height: 2.75, depth: 0.16 }, new B.Vector3(direction * (0.23 + index * 0.38), 1.5, 0), materials.gate, false);
    plank.parent = root;
  }
  for (const y of [0.55, 1.55, 2.55]) {
    const rail = makeBox(`${name}-rail-${y}`, { width: 2.85, height: 0.22, depth: 0.22 }, new B.Vector3(direction * 1.38, y, -0.06), materials.gate, false);
    rail.parent = root;
  }
  const brace = makeBox(`${name}-brace`, { width: 2.65, height: 0.18, depth: 0.24 }, new B.Vector3(direction * 1.38, 1.5, -0.09), materials.gate, false);
  brace.parent = root;
  brace.rotation.z = direction * 0.62;
}

function buildWorld() {
  const ground = B.MeshBuilder.CreateGround("ground", { width: 86, height: 86, subdivisions: 2 }, scene);
  ground.material = materials.ground;
  ground.checkCollisions = true;
  ground.receiveShadows = true;

  const path = B.MeshBuilder.CreateGround("path", { width: 7.2, height: 42 }, scene);
  path.position.set(0, 0.018, -20);
  path.material = materials.path;
  path.receiveShadows = true;

  const patio = B.MeshBuilder.CreateGround("patio", { width: 24, height: 20 }, scene);
  patio.position.set(0, 0.032, 0.5);
  patio.material = materials.patio;
  patio.receiveShadows = true;

  makeBox("facade-left", { width: 8.5, height: 5.5, depth: 0.75 }, new B.Vector3(-7.35, 2.75, 11.3), materials.plaster);
  makeBox("facade-right", { width: 8.5, height: 5.5, depth: 0.75 }, new B.Vector3(7.35, 2.75, 11.3), materials.plaster);
  makeBox("facade-top", { width: 6.2, height: 1.3, depth: 0.75 }, new B.Vector3(0, 4.95, 11.3), materials.worn);
  makeBox("back-wall", { width: 23.4, height: 5.5, depth: 0.75 }, new B.Vector3(0, 2.75, 18.1), materials.plaster);
  makeBox("side-west", { width: 0.75, height: 5.5, depth: 7.5 }, new B.Vector3(-11.3, 2.75, 14.7), materials.plaster);
  makeBox("side-east", { width: 0.75, height: 5.5, depth: 7.5 }, new B.Vector3(11.3, 2.75, 14.7), materials.plaster);

  const roofA = makeBox("roof-a", { width: 24.2, height: 0.3, depth: 4.45 }, new B.Vector3(0, 5.9, 13.25), materials.roof, false);
  roofA.rotation.x = -0.48;
  const roofB = makeBox("roof-b", { width: 24.2, height: 0.3, depth: 4.45 }, new B.Vector3(0, 5.9, 16.15), materials.roof, false);
  roofB.rotation.x = 0.48;
  makeBox("ridge", { width: 24.3, height: 0.28, depth: 0.42 }, new B.Vector3(0, 6.85, 14.7), materials.roof, false);

  makeBox("stone-plinth", { width: 23.8, height: 0.78, depth: 0.9 }, new B.Vector3(0, 0.39, 11.2), materials.stone);
  makeBox("wall-west", { width: 0.95, height: 1.55, depth: 23 }, new B.Vector3(-13, 0.78, 0), materials.stone);
  makeBox("wall-east", { width: 0.95, height: 1.55, depth: 23 }, new B.Vector3(13, 0.78, 0), materials.stone);
  makeBox("wall-front-left", { width: 9.8, height: 1.55, depth: 0.95 }, new B.Vector3(-8.1, 0.78, -10.7), materials.stone);
  makeBox("wall-front-right", { width: 9.8, height: 1.55, depth: 0.95 }, new B.Vector3(8.1, 0.78, -10.7), materials.stone);

  gateLeaf("gate-left", -3.05, -0.9);
  gateLeaf("gate-right", 3.05, 0.9);

  const dark = new B.PBRMaterial("door-dark", scene);
  dark.albedoColor = new B.Color3(0.035, 0.03, 0.025);
  dark.roughness = 1;
  makeBox("door-shadow", { width: 3.2, height: 3.9, depth: 0.22 }, new B.Vector3(0, 2, 10.88), dark, false);
  makeBox("door", { width: 2.75, height: 3.35, depth: 0.16 }, new B.Vector3(0, 1.72, 10.68), materials.gate, false);

  const radius = 1.85;
  for (let index = 0; index <= 12; index += 1) {
    const angle = Math.PI - (index / 12) * Math.PI;
    const stone = makeBox(`arch-${index}`, { width: 0.48, height: 0.72, depth: 0.55 }, new B.Vector3(Math.cos(angle) * radius, 3.5 + Math.sin(angle) * radius, 10.55), materials.stone, false);
    stone.rotation.z = -angle + Math.PI / 2;
  }

  for (const x of [-6.25, 6.25]) {
    const glass = new B.PBRMaterial(`glass-${x}`, scene);
    glass.albedoColor = new B.Color3(0.045, 0.075, 0.075);
    glass.roughness = 0.22;
    makeBox(`window-${x}`, { width: 2.15, height: 1.8, depth: 0.15 }, new B.Vector3(x, 3.1, 10.87), glass, false);
    for (const side of [-1, 1]) {
      const shutter = makeBox(`shutter-${x}-${side}`, { width: 0.82, height: 2.05, depth: 0.15 }, new B.Vector3(x + side * 1.55, 3.1, 10.72), materials.wood, false);
      shutter.rotation.y = side * 0.22;
    }
  }

  const hillMaterial = new B.PBRMaterial("hills", scene);
  hillMaterial.albedoColor = new B.Color3(0.27, 0.32, 0.24);
  hillMaterial.roughness = 1;
  for (const [x, z, sx, sy, sz] of [[-30, 28, 12, 4, 9], [30, 31, 15, 5, 10]]) {
    const hill = B.MeshBuilder.CreateSphere(`hill-${x}`, { diameter: 2, segments: 18 }, scene);
    hill.position.set(x, -1.3, z);
    hill.scaling.set(sx, sy, sz);
    hill.material = hillMaterial;
    hill.receiveShadows = true;
  }
}

function createAvatar() {
  const collider = B.MeshBuilder.CreateCapsule("player-collider", { height: 1.8, radius: 0.42, tessellation: 12 }, scene);
  collider.position.set(0, 0.92, -22);
  collider.isVisible = false;
  collider.checkCollisions = true;
  collider.ellipsoid = new B.Vector3(0.42, 0.9, 0.42);
  collider.ellipsoidOffset = B.Vector3.Zero();

  const fur = new B.PBRMaterial("temporary-fur", scene);
  fur.albedoColor = B.Color3.FromHexString("#4b4036");
  fur.roughness = 0.96;
  const face = new B.PBRMaterial("temporary-face", scene);
  face.albedoColor = B.Color3.FromHexString("#b58a70");
  face.roughness = 0.9;

  const root = new B.TransformNode("temporary-barbary-macaque", scene);
  root.parent = collider;

  const body = B.MeshBuilder.CreateCapsule("avatar-body", { height: 1.0, radius: 0.29, tessellation: 12 }, scene);
  body.parent = root;
  body.position.y = 0.02;
  body.material = fur;

  const head = B.MeshBuilder.CreateSphere("avatar-head", { diameter: 0.7, segments: 16 }, scene);
  head.parent = root;
  head.position.y = 0.78;
  head.scaling.set(0.95, 1, 0.9);
  head.material = fur;

  const muzzle = B.MeshBuilder.CreateSphere("avatar-muzzle", { diameter: 0.42, segments: 14 }, scene);
  muzzle.parent = root;
  muzzle.position.set(0, 0.69, 0.28);
  muzzle.scaling.set(1, 0.78, 0.7);
  muzzle.material = face;

  for (const side of [-1, 1]) {
    const ear = B.MeshBuilder.CreateSphere(`avatar-ear-${side}`, { diameter: 0.23, segments: 12 }, scene);
    ear.parent = root;
    ear.position.set(side * 0.34, 0.82, 0);
    ear.scaling.z = 0.55;
    ear.material = face;
  }

  const limbs = {};
  for (const side of [-1, 1]) {
    const arm = B.MeshBuilder.CreateCapsule(`avatar-arm-${side}`, { height: 1.08, radius: 0.12, tessellation: 10 }, scene);
    arm.parent = root;
    arm.position.set(side * 0.43, 0.02, 0);
    arm.rotation.z = side * 0.14;
    arm.material = fur;
    limbs[`arm${side}`] = arm;

    const leg = B.MeshBuilder.CreateCapsule(`avatar-leg-${side}`, { height: 0.68, radius: 0.145, tessellation: 10 }, scene);
    leg.parent = root;
    leg.position.set(side * 0.17, -0.58, 0);
    leg.material = fur;
    limbs[`leg${side}`] = leg;

    const hand = B.MeshBuilder.CreateSphere(`avatar-hand-${side}`, { diameter: 0.25, segments: 10 }, scene);
    hand.parent = root;
    hand.position.set(side * 0.5, -0.5, 0.02);
    hand.material = face;
  }

  for (const mesh of root.getChildMeshes()) shadows.addShadowCaster(mesh);
  return { collider, root, limbs };
}

function meshBounds(meshes) {
  let min = new B.Vector3(Infinity, Infinity, Infinity);
  let max = new B.Vector3(-Infinity, -Infinity, -Infinity);
  for (const mesh of meshes) {
    if (!mesh.getBoundingInfo || mesh.getTotalVertices() === 0) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = B.Vector3.Minimize(min, box.minimumWorld);
    max = B.Vector3.Maximize(max, box.maximumWorld);
  }
  return { min, max, size: max.subtract(min) };
}

async function placeAsset(spec) {
  const result = await B.SceneLoader.ImportMeshAsync("", `${ASSETS}/${spec.id}/`, `${spec.id}_1k.gltf`, scene);
  const holder = new B.TransformNode(`asset-${spec.id}`, scene);
  for (const mesh of result.meshes) {
    if (!mesh.parent) mesh.parent = holder;
    if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
      mesh.receiveShadows = true;
      shadows.addShadowCaster(mesh);
    }
  }
  const renderMeshes = result.meshes.filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
  holder.position.set(spec.x, 0, spec.z);
  holder.rotation.y = spec.rotationY || 0;
  holder.computeWorldMatrix(true);
  let bounds = meshBounds(renderMeshes);
  const largest = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 0.001);
  holder.scaling.setAll(spec.target / largest);
  holder.computeWorldMatrix(true);
  bounds = meshBounds(renderMeshes);
  holder.position.y += (spec.y || 0) - bounds.min.y;
}

const placements = [
  { id: "painted_wooden_bench", x: -9.5, z: 5.2, target: 3.2, rotationY: Math.PI / 2 },
  { id: "small_wooden_table_01", x: 3.1, z: 3.2, target: 2.4, rotationY: -0.22 },
  { id: "wooden_stool_01", x: 1.4, z: 2.6, target: 1.1, rotationY: 0.4 },
  { id: "wooden_barrels_01", x: 8.2, z: 7.2, target: 3.4, rotationY: -0.25 },
  { id: "wooden_crate_01", x: 7.4, z: 4.5, target: 1.35, rotationY: 0.2 },
  { id: "wooden_crate_02", x: 8.8, z: 4.2, target: 1.25, rotationY: -0.45 },
  { id: "wooden_bucket_01", x: -5.8, z: 4.4, target: 0.75, rotationY: 0.25 },
  { id: "watering_can_metal_01", x: -4.7, z: 4.15, target: 0.85, rotationY: -0.7 },
  { id: "planter_pot_clay", x: -8.8, z: 8.8, target: 1.0, rotationY: 0.1 },
  { id: "wicker_basket_01", x: 4.9, z: 4.3, target: 0.92, rotationY: 0.45 },
  { id: "Lantern_01", x: -1.9, z: 10.5, y: 1.8, target: 0.9, rotationY: Math.PI },
  { id: "rusted_spade_01", x: -10.45, z: 7.1, target: 1.7, rotationY: 0.1 },
  { id: "wooden_axe", x: -9.95, z: 6.3, target: 1.15, rotationY: -0.35 },
  { id: "metal_jug", x: 2.6, z: 3.2, y: 1.02, target: 0.58, rotationY: 0.15 },
  { id: "pot_enamel_01", x: 3.5, z: 3.25, y: 1.02, target: 0.62, rotationY: -0.25 },
];

buildWorld();
const avatar = createAvatar();

let imported = 0;
progress(0, placements.length, "Colocando objetos reales…");
for (const spec of placements) {
  try {
    await placeAsset(spec);
    imported += 1;
    assetCount.textContent = String(imported);
    progress(imported, placements.length, `Importando ${spec.id.replaceAll("_", " ")}…`);
  } catch (error) {
    console.error(`No se pudo importar ${spec.id}`, error);
  }
}
statusText.textContent = `Tercera persona · avatar temporal visible · ${imported} mallas reales`;
progress(placements.length, placements.length, "Listo para caminar");
setTimeout(() => loading.classList.add("hidden"), 350);

const startPosition = new B.Vector3(0, 0.92, -22);
let cameraYaw = 0;
let cameraPitch = 0.18;
let runHeld = false;
let walkClock = 0;
const stick = { x: 0, y: 0, pointerId: null };
const keys = new Set();
let lookPointer = null;
let lookX = 0;
let lookY = 0;

function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = rect.width * 0.34;
  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;
  const length = Math.hypot(dx, dy);
  if (length > radius) {
    dx = (dx / length) * radius;
    dy = (dy / length) * radius;
  }
  stick.x = dx / radius;
  stick.y = -dy / radius;
  joystickKnob.style.transform = `translate3d(${dx}px,${dy}px,0)`;
}

function releaseJoystick() {
  stick.pointerId = null;
  stick.x = 0;
  stick.y = 0;
  joystickKnob.style.transform = "translate3d(0,0,0)";
}

joystick.addEventListener("pointerdown", (event) => {
  stick.pointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateJoystick(event);
  event.preventDefault();
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === stick.pointerId) updateJoystick(event);
});
joystick.addEventListener("pointerup", releaseJoystick);
joystick.addEventListener("pointercancel", releaseJoystick);

runButton.addEventListener("pointerdown", (event) => {
  runHeld = true;
  runButton.classList.add("active");
  runButton.setPointerCapture(event.pointerId);
  event.preventDefault();
});
const releaseRun = () => {
  runHeld = false;
  runButton.classList.remove("active");
};
runButton.addEventListener("pointerup", releaseRun);
runButton.addEventListener("pointercancel", releaseRun);

canvas.addEventListener("pointerdown", (event) => {
  lookPointer = event.pointerId;
  lookX = event.clientX;
  lookY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== lookPointer) return;
  const dx = event.clientX - lookX;
  const dy = event.clientY - lookY;
  lookX = event.clientX;
  lookY = event.clientY;
  cameraYaw += dx * 0.0042;
  cameraPitch = B.Scalar.Clamp(cameraPitch + dy * 0.003, -0.12, 0.52);
});
canvas.addEventListener("pointerup", () => { lookPointer = null; });
canvas.addEventListener("pointercancel", () => { lookPointer = null; });

window.addEventListener("keydown", (event) => keys.add(event.code));
window.addEventListener("keyup", (event) => keys.delete(event.code));
window.addEventListener("resize", () => engine.resize());

resetButton.addEventListener("click", () => {
  avatar.collider.position.copyFrom(startPosition);
  avatar.root.rotation.y = 0;
  cameraYaw = 0;
  cameraPitch = 0.18;
});

function updateCamera() {
  const target = avatar.collider.position.add(new B.Vector3(0, 0.48, 0));
  const distance = 7.4;
  const forward = new B.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  const desired = target.subtract(forward.scale(distance * Math.cos(cameraPitch)));
  desired.y += 1.65 + distance * Math.sin(cameraPitch);
  camera.position = B.Vector3.Lerp(camera.position, desired, 0.16);
  camera.setTarget(target.add(new B.Vector3(0, 0.18, 0)));
}

let previous = performance.now();
engine.runRenderLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.04, (now - previous) / 1000);
  previous = now;

  const keyboardX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  const keyboardY = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
  const inputX = B.Scalar.Clamp(stick.x + keyboardX, -1, 1);
  const inputY = B.Scalar.Clamp(stick.y + keyboardY, -1, 1);
  const magnitude = Math.min(1, Math.hypot(inputX, inputY));

  if (magnitude > 0.03) {
    const forward = new B.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    const right = new B.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const direction = forward.scale(inputY).add(right.scale(inputX));
    direction.normalize();
    const running = runHeld || keys.has("ShiftLeft") || keys.has("ShiftRight");
    avatar.collider.moveWithCollisions(direction.scale((running ? 6.4 : 3.7) * magnitude * dt));
    avatar.collider.position.y = 0.92;
    avatar.root.rotation.y = Math.atan2(direction.x, direction.z);

    walkClock += dt * (running ? 12 : 8);
    const swing = Math.sin(walkClock) * (running ? 0.72 : 0.48);
    avatar.limbs["arm1"].rotation.x = swing;
    avatar.limbs["arm-1"].rotation.x = -swing;
    avatar.limbs["leg1"].rotation.x = -swing * 0.72;
    avatar.limbs["leg-1"].rotation.x = swing * 0.72;
  } else {
    avatar.limbs["arm1"].rotation.x *= 0.82;
    avatar.limbs["arm-1"].rotation.x *= 0.82;
    avatar.limbs["leg1"].rotation.x *= 0.82;
    avatar.limbs["leg-1"].rotation.x *= 0.82;
  }

  updateCamera();
  scene.render();
});
