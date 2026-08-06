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

const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: false,
  stencil: true,
  adaptToDeviceRatio: true,
});
engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.45));

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0.57, 0.68, 0.71, 1);
scene.collisionsEnabled = true;
scene.imageProcessingConfiguration.toneMappingEnabled = true;
scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
scene.imageProcessingConfiguration.exposure = 1.08;
scene.imageProcessingConfiguration.contrast = 1.16;
scene.environmentIntensity = 0.62;
scene.fogMode = B.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.0042;
scene.fogColor = new B.Color3(0.58, 0.67, 0.68);

const startPose = {
  position: new B.Vector3(0, 1.72, -22),
  yaw: 0,
  pitch: 0.02,
};
const camera = new B.UniversalCamera("walker", startPose.position.clone(), scene);
camera.minZ = 0.08;
camera.fov = 0.88;
camera.ellipsoid = new B.Vector3(0.38, 0.82, 0.38);
camera.ellipsoidOffset = new B.Vector3(0, -0.78, 0);
camera.checkCollisions = true;
scene.activeCamera = camera;

let yaw = startPose.yaw;
let pitch = startPose.pitch;

const hemi = new B.HemisphericLight("hemi", new B.Vector3(0, 1, 0), scene);
hemi.intensity = 0.58;
hemi.diffuse = new B.Color3(0.82, 0.86, 0.82);
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

function setProgress(done, total, label) {
  const ratio = total ? done / total : 0;
  loadingBar.style.width = `${Math.max(2, Math.round(ratio * 100))}%`;
  loadingLabel.textContent = label;
}

function makePBR(name, folder, { scale = 4, tint = null, roughness = 1 } = {}) {
  const material = new B.PBRMaterial(name, scene);
  const base = `${ASSETS}/${folder}`;
  material.albedoTexture = new B.Texture(`${base}/diffuse.jpg`, scene, true, false);
  material.bumpTexture = new B.Texture(`${base}/normal_gl.jpg`, scene, true, false);
  const rough = new B.Texture(`${base}/roughness.jpg`, scene, true, false);
  material.metallicTexture = rough;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.metallic = 0;
  material.roughness = roughness;
  material.environmentIntensity = 0.5;
  for (const texture of [material.albedoTexture, material.bumpTexture, rough]) {
    texture.uScale = scale;
    texture.vScale = scale;
    texture.wrapU = texture.wrapV = B.Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
  }
  if (tint) material.albedoColor = B.Color3.FromHexString(tint);
  return material;
}

const mats = {
  ground: makePBR("dry-ground", "dry_ground_01", { scale: 12, tint: "#a18d68" }),
  path: makePBR("stony-path", "stony_dirt_path", { scale: 8 }),
  patio: makePBR("patio-tiles", "patio_tiles", { scale: 6 }),
  plaster: makePBR("white-plaster", "white_plaster_rough_01", { scale: 3.2, tint: "#e4dcc5" }),
  worn: makePBR("worn-plaster", "worn_plaster_wall", { scale: 3 }),
  stone: makePBR("stone-wall", "stone_wall_05", { scale: 3.5 }),
  roof: makePBR("roof-tiles", "clay_roof_tiles_03", { scale: 5 }),
  wood: makePBR("weathered-wood", "weathered_planks", { scale: 3.5 }),
  gate: makePBR("gate-wood", "wooden_gate", { scale: 2.2 }),
};

function box(name, size, position, material, collision = true) {
  const mesh = B.MeshBuilder.CreateBox(name, size, scene);
  mesh.position.copyFrom(position);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.checkCollisions = collision;
  shadows.addShadowCaster(mesh);
  return mesh;
}

function createGateLeaf(name, hingeX, angle) {
  const root = new B.TransformNode(name, scene);
  root.position.set(hingeX, 0, -10.3);
  root.rotation.y = angle;
  const direction = hingeX < 0 ? 1 : -1;
  for (let i = 0; i < 7; i += 1) {
    const plank = box(
      `${name}-plank-${i}`,
      { width: 0.38, height: 2.75, depth: 0.16 },
      new B.Vector3(direction * (0.23 + i * 0.38), 1.5, 0),
      mats.gate,
      false,
    );
    plank.parent = root;
  }
  for (const y of [0.55, 1.55, 2.55]) {
    const rail = box(
      `${name}-rail-${y}`,
      { width: 2.85, height: 0.22, depth: 0.22 },
      new B.Vector3(direction * 1.38, y, -0.06),
      mats.gate,
      false,
    );
    rail.parent = root;
  }
  const brace = box(
    `${name}-brace`,
    { width: 2.65, height: 0.18, depth: 0.24 },
    new B.Vector3(direction * 1.38, 1.5, -0.09),
    mats.gate,
    false,
  );
  brace.parent = root;
  brace.rotation.z = direction * 0.62;
}

function createArch() {
  const dark = new B.PBRMaterial("door-shadow", scene);
  dark.albedoColor = new B.Color3(0.035, 0.03, 0.025);
  dark.roughness = 1;
  box("door-shadow", { width: 3.2, height: 3.9, depth: 0.22 }, new B.Vector3(0, 2.0, 10.88), dark, false);
  box("door-leaf", { width: 2.75, height: 3.35, depth: 0.16 }, new B.Vector3(0, 1.72, 10.68), mats.gate, false);

  const radius = 1.85;
  for (let i = 0; i <= 12; i += 1) {
    const angle = Math.PI - (i / 12) * Math.PI;
    const stone = box(
      `arch-stone-${i}`,
      { width: 0.48, height: 0.72, depth: 0.55 },
      new B.Vector3(Math.cos(angle) * radius, 3.5 + Math.sin(angle) * radius, 10.55),
      mats.stone,
      false,
    );
    stone.rotation.z = -angle + Math.PI / 2;
  }
  for (const x of [-1.85, 1.85]) {
    for (let i = 0; i < 5; i += 1) {
      box(
        `door-jamb-${x}-${i}`,
        { width: 0.58, height: 0.72, depth: 0.55 },
        new B.Vector3(x, 0.4 + i * 0.72, 10.55),
        mats.stone,
        false,
      );
    }
  }
}

function buildArchitecture() {
  const ground = B.MeshBuilder.CreateGround("dry-land", { width: 86, height: 86, subdivisions: 2 }, scene);
  ground.material = mats.ground;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  const path = B.MeshBuilder.CreateGround("arrival-path", { width: 7.2, height: 42, subdivisions: 1 }, scene);
  path.position.set(0, 0.018, -20);
  path.material = mats.path;
  path.receiveShadows = true;

  const patio = B.MeshBuilder.CreateGround("courtyard", { width: 24, height: 20, subdivisions: 1 }, scene);
  patio.position.set(0, 0.032, 0.5);
  patio.material = mats.patio;
  patio.receiveShadows = true;

  box("facade-left", { width: 8.5, height: 5.5, depth: 0.75 }, new B.Vector3(-7.35, 2.75, 11.3), mats.plaster);
  box("facade-right", { width: 8.5, height: 5.5, depth: 0.75 }, new B.Vector3(7.35, 2.75, 11.3), mats.plaster);
  box("facade-lintel", { width: 6.2, height: 1.3, depth: 0.75 }, new B.Vector3(0, 4.95, 11.3), mats.worn);
  box("back-wall", { width: 23.4, height: 5.5, depth: 0.75 }, new B.Vector3(0, 2.75, 18.1), mats.plaster);
  box("side-west", { width: 0.75, height: 5.5, depth: 7.5 }, new B.Vector3(-11.3, 2.75, 14.7), mats.plaster);
  box("side-east", { width: 0.75, height: 5.5, depth: 7.5 }, new B.Vector3(11.3, 2.75, 14.7), mats.plaster);

  const roofA = box("roof-a", { width: 24.2, height: 0.3, depth: 4.45 }, new B.Vector3(0, 5.9, 13.25), mats.roof, false);
  roofA.rotation.x = -0.48;
  const roofB = box("roof-b", { width: 24.2, height: 0.3, depth: 4.45 }, new B.Vector3(0, 5.9, 16.15), mats.roof, false);
  roofB.rotation.x = 0.48;
  box("ridge", { width: 24.3, height: 0.28, depth: 0.42 }, new B.Vector3(0, 6.85, 14.7), mats.roof, false);

  box("stone-plinth", { width: 23.8, height: 0.78, depth: 0.9 }, new B.Vector3(0, 0.39, 11.2), mats.stone);
  box("wall-west", { width: 0.95, height: 1.55, depth: 23 }, new B.Vector3(-13, 0.78, 0), mats.stone);
  box("wall-east", { width: 0.95, height: 1.55, depth: 23 }, new B.Vector3(13, 0.78, 0), mats.stone);
  box("wall-front-left", { width: 9.8, height: 1.55, depth: 0.95 }, new B.Vector3(-8.1, 0.78, -10.7), mats.stone);
  box("wall-front-right", { width: 9.8, height: 1.55, depth: 0.95 }, new B.Vector3(8.1, 0.78, -10.7), mats.stone);
  for (const [x, z, width, depth] of [
    [-13, 0, 1.08, 23.1],
    [13, 0, 1.08, 23.1],
    [-8.1, -10.7, 9.9, 1.08],
    [8.1, -10.7, 9.9, 1.08],
  ]) {
    box(`wall-cap-${x}-${z}`, { width, height: 0.2, depth }, new B.Vector3(x, 1.63, z), mats.stone, false);
  }

  createGateLeaf("gate-left", -3.05, -0.9);
  createGateLeaf("gate-right", 3.05, 0.9);
  createArch();

  for (const x of [-6.25, 6.25]) {
    const glass = new B.PBRMaterial(`window-glass-${x}`, scene);
    glass.albedoColor = new B.Color3(0.045, 0.075, 0.075);
    glass.roughness = 0.22;
    glass.metallic = 0.06;
    box(`window-${x}`, { width: 2.15, height: 1.8, depth: 0.15 }, new B.Vector3(x, 3.1, 10.87), glass, false);
    box(`window-frame-top-${x}`, { width: 2.45, height: 0.18, depth: 0.2 }, new B.Vector3(x, 4.05, 10.72), mats.wood, false);
    box(`window-frame-bottom-${x}`, { width: 2.45, height: 0.18, depth: 0.2 }, new B.Vector3(x, 2.15, 10.72), mats.wood, false);
    for (const side of [-1, 1]) {
      const shutter = box(
        `shutter-${x}-${side}`,
        { width: 0.82, height: 2.05, depth: 0.15 },
        new B.Vector3(x + side * 1.55, 3.1, 10.72),
        mats.wood,
        false,
      );
      shutter.rotation.y = side * 0.22;
    }
  }

  const hillMat = new B.PBRMaterial("distant-hill", scene);
  hillMat.albedoColor = new B.Color3(0.27, 0.32, 0.24);
  hillMat.roughness = 1;
  for (const [x, z, sx, sy, sz] of [
    [-30, 26, 12, 5, 9],
    [28, 30, 15, 6, 10],
    [-33, -8, 10, 4, 8],
    [34, -5, 11, 4.5, 8],
  ]) {
    const hill = B.MeshBuilder.CreateSphere(`hill-${x}-${z}`, { diameter: 2, segments: 20 }, scene);
    hill.position.set(x, -1.1, z);
    hill.scaling.set(sx, sy, sz);
    hill.material = hillMat;
    hill.receiveShadows = true;
  }
}

function boundsOf(meshes) {
  let min = new B.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new B.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of meshes) {
    if (!mesh.getBoundingInfo) continue;
    mesh.computeWorldMatrix(true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = B.Vector3.Minimize(min, bounds.minimumWorld);
    max = B.Vector3.Maximize(max, bounds.maximumWorld);
  }
  return { min, max, size: max.subtract(min) };
}

async function placeAsset(spec) {
  const rootUrl = `${ASSETS}/${spec.id}/`;
  const file = spec.file || `${spec.id}_1k.gltf`;
  const result = await B.SceneLoader.ImportMeshAsync("", rootUrl, file, scene);
  const imported = result.meshes.filter((mesh) => mesh.name !== "__root__");
  const root = new B.TransformNode(`asset-${spec.id}`, scene);
  for (const mesh of result.meshes) {
    if (!mesh.parent) mesh.parent = root;
    if (mesh.getBoundingInfo) {
      mesh.receiveShadows = true;
      shadows.addShadowCaster(mesh);
    }
  }

  root.rotation.set(spec.rotationX || 0, spec.rotationY || 0, spec.rotationZ || 0);
  root.position.set(spec.x, 0, spec.z);
  root.computeWorldMatrix(true);
  let bounds = boundsOf(imported);
  const largest = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 0.001);
  root.scaling.setAll(spec.target / largest);
  root.computeWorldMatrix(true);
  bounds = boundsOf(imported);
  root.position.y += (spec.y || 0) - bounds.min.y;
  root.computeWorldMatrix(true);
  return root;
}

const placements = [
  { id: "gate_latch_01", x: -1.35, z: -9.75, y: 1.15, target: 0.72, rotationY: Math.PI },
  { id: "painted_wooden_bench", x: -9.7, z: 5.2, target: 3.2, rotationY: Math.PI / 2 },
  { id: "small_wooden_table_01", x: 3.1, z: 3.2, target: 2.4, rotationY: -0.22 },
  { id: "wooden_stool_01", x: 1.4, z: 2.6, target: 1.1, rotationY: 0.4 },
  { id: "folding_wooden_stool", x: 4.7, z: 2.4, target: 1.15, rotationY: -0.55 },
  { id: "painted_wooden_stool", x: -7.8, z: 4.2, target: 1.05, rotationY: 0.3 },
  { id: "wooden_table_02", x: -7.6, z: 7.1, target: 2.8, rotationY: 0.12 },
  { id: "wooden_picnic_table", x: 8.1, z: -3.8, target: 4.1, rotationY: -0.35 },
  { id: "wooden_barrels_01", x: 8.2, z: 7.2, target: 3.4, rotationY: -0.25 },
  { id: "wooden_crate_01", x: 7.4, z: 4.5, target: 1.35, rotationY: 0.2 },
  { id: "wooden_crate_02", x: 8.8, z: 4.2, target: 1.25, rotationY: -0.45 },
  { id: "wooden_bucket_01", x: -5.8, z: 4.4, target: 0.75, rotationY: 0.25 },
  { id: "watering_can_metal_01", x: -4.7, z: 4.15, target: 0.85, rotationY: -0.7 },
  { id: "planter_pot_clay", x: -8.8, z: 8.8, target: 1.0, rotationY: 0.1 },
  { id: "wicker_basket_01", x: 4.9, z: 4.3, target: 0.92, rotationY: 0.45 },
  { id: "wicker_basket_02", x: -5.4, z: 7.4, target: 0.9, rotationY: -0.2 },
  { id: "Lantern_01", x: -1.9, z: 10.5, y: 1.8, target: 0.9, rotationY: Math.PI },
  { id: "rusted_spade_01", x: -10.45, z: 7.1, target: 1.7, rotationY: 0.1 },
  { id: "wooden_axe", x: -9.95, z: 6.3, target: 1.15, rotationY: -0.35 },
  { id: "handsaw_wood", x: -6.85, z: 7.0, y: 0.95, target: 1.0, rotationY: 0.5 },
  { id: "trowel_01", x: -6.2, z: 7.1, y: 0.95, target: 0.6, rotationY: -0.25 },
  { id: "metal_jug", x: 2.6, z: 3.2, y: 1.02, target: 0.58, rotationY: 0.15 },
  { id: "pot_enamel_01", x: 3.5, z: 3.25, y: 1.02, target: 0.62, rotationY: -0.25 },
  { id: "Shelf_01", x: 9.9, z: 10.45, target: 2.5, rotationY: Math.PI },
  { id: "modular_wooden_pier", x: -18.2, z: -0.5, target: 8.5, rotationY: Math.PI / 2 },
  { id: "rock_09", x: 17.0, z: -2.0, target: 3.4, rotationY: 0.5 },
];

buildArchitecture();

let loadedAssets = 0;
setProgress(0, placements.length, "Colocando mallas reales…");
for (const spec of placements) {
  try {
    await placeAsset(spec);
    loadedAssets += 1;
    assetCount.textContent = String(loadedAssets);
    setProgress(loadedAssets, placements.length, `Importando ${spec.id.replaceAll("_", " ")}…`);
  } catch (error) {
    console.error(`No se pudo cargar ${spec.id}`, error);
  }
}
statusText.textContent = `${loadedAssets} mallas GLTF reales · 9 materiales PBR · escena nueva`;
setProgress(placements.length, placements.length, "Finca lista");
setTimeout(() => loading.classList.add("hidden"), 350);

const stick = { x: 0, y: 0, pointerId: null };
let running = false;
let lookPointer = null;
let lookX = 0;
let lookY = 0;

function updateStick(event) {
  const rect = joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const radius = rect.width * 0.34;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const length = Math.hypot(dx, dy);
  if (length > radius) {
    dx = (dx / length) * radius;
    dy = (dy / length) * radius;
  }
  stick.x = dx / radius;
  stick.y = -dy / radius;
  joystickKnob.style.transform = `translate3d(${dx}px,${dy}px,0)`;
}

function clearStick() {
  stick.pointerId = null;
  stick.x = 0;
  stick.y = 0;
  joystickKnob.style.transform = "translate3d(0,0,0)";
}

joystick.addEventListener("pointerdown", (event) => {
  stick.pointerId = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  updateStick(event);
  event.preventDefault();
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === stick.pointerId) updateStick(event);
});
joystick.addEventListener("pointerup", clearStick);
joystick.addEventListener("pointercancel", clearStick);

runButton.addEventListener("pointerdown", (event) => {
  running = true;
  runButton.classList.add("active");
  runButton.setPointerCapture(event.pointerId);
  event.preventDefault();
});
const stopRun = () => {
  running = false;
  runButton.classList.remove("active");
};
runButton.addEventListener("pointerup", stopRun);
runButton.addEventListener("pointercancel", stopRun);

canvas.addEventListener("pointerdown", (event) => {
  if (lookPointer !== null) return;
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
  yaw += dx * 0.0042;
  pitch = B.Scalar.Clamp(pitch - dy * 0.0032, -0.55, 0.55);
});
canvas.addEventListener("pointerup", () => { lookPointer = null; });
canvas.addEventListener("pointercancel", () => { lookPointer = null; });

resetButton.addEventListener("click", () => {
  camera.position.copyFrom(startPose.position);
  yaw = startPose.yaw;
  pitch = startPose.pitch;
});

const keyState = new Set();
window.addEventListener("keydown", (event) => keyState.add(event.code));
window.addEventListener("keyup", (event) => keyState.delete(event.code));
window.addEventListener("resize", () => engine.resize());

let previous = performance.now();
engine.runRenderLoop(() => {
  const now = performance.now();
  const dt = Math.min(0.04, (now - previous) / 1000);
  previous = now;

  const keyboardX = (keyState.has("KeyD") ? 1 : 0) - (keyState.has("KeyA") ? 1 : 0);
  const keyboardY = (keyState.has("KeyW") ? 1 : 0) - (keyState.has("KeyS") ? 1 : 0);
  const inputX = B.Scalar.Clamp(stick.x + keyboardX, -1, 1);
  const inputY = B.Scalar.Clamp(stick.y + keyboardY, -1, 1);
  const magnitude = Math.min(1, Math.hypot(inputX, inputY));

  if (magnitude > 0.02) {
    const forward = new B.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new B.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const move = forward.scale(inputY).add(right.scale(inputX));
    move.normalize();
    const speed = (running || keyState.has("ShiftLeft") ? 6.2 : 3.55) * magnitude * dt;
    camera.moveWithCollisions(move.scale(speed));
    camera.position.y = 1.72;
  }

  const lookDirection = new B.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch),
  );
  camera.setTarget(camera.position.add(lookDirection));
  scene.render();
});
