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
engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0.55, 0.68, 0.72, 1);
scene.collisionsEnabled = true;
scene.imageProcessingConfiguration.toneMappingEnabled = true;
scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
scene.imageProcessingConfiguration.exposure = 1.04;
scene.imageProcessingConfiguration.contrast = 1.18;
scene.environmentIntensity = 0.7;

const camera = new B.UniversalCamera("walker", new B.Vector3(0, 1.72, -10), scene);
camera.minZ = 0.08;
camera.fov = 0.9;
camera.ellipsoid = new B.Vector3(0.38, 0.82, 0.38);
camera.ellipsoidOffset = new B.Vector3(0, -0.78, 0);
camera.checkCollisions = true;
scene.activeCamera = camera;

let yaw = 0;
let pitch = 0.02;
const startPose = { position: new B.Vector3(0, 1.72, -10), yaw: 0, pitch: 0.02 };

const hemi = new B.HemisphericLight("hemi", new B.Vector3(0, 1, 0), scene);
hemi.intensity = 0.52;
hemi.diffuse = new B.Color3(0.78, 0.84, 0.8);
hemi.groundColor = new B.Color3(0.22, 0.18, 0.13);

const sun = new B.DirectionalLight("sun", new B.Vector3(-0.55, -1, 0.35), scene);
sun.position = new B.Vector3(28, 38, -24);
sun.intensity = 2.35;
sun.diffuse = new B.Color3(1, 0.83, 0.62);
const shadows = new B.ShadowGenerator(1024, sun);
shadows.useBlurExponentialShadowMap = true;
shadows.blurKernel = 18;
shadows.bias = 0.0005;

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
  material.environmentIntensity = 0.55;
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
  ground: makePBR("dry-ground", "dry_ground_01", { scale: 11, tint: "#a7936e" }),
  path: makePBR("stony-path", "stony_dirt_path", { scale: 7 }),
  patio: makePBR("patio-tiles", "patio_tiles", { scale: 6 }),
  plaster: makePBR("white-plaster", "white_plaster_rough_01", { scale: 3.2, tint: "#e6dfc9" }),
  worn: makePBR("worn-plaster", "worn_plaster_wall", { scale: 3 }),
  stone: makePBR("stone-wall", "stone_wall_05", { scale: 3.5 }),
  roof: makePBR("roof-tiles", "clay_roof_tiles_03", { scale: 5 }),
  wood: makePBR("weathered-wood", "weathered_planks", { scale: 3.5 }),
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

function buildArchitecture() {
  const ground = B.MeshBuilder.CreateGround("dry-land", { width: 72, height: 72, subdivisions: 2 }, scene);
  ground.material = mats.ground;
  ground.receiveShadows = true;
  ground.checkCollisions = true;

  const path = B.MeshBuilder.CreateGround("arrival-path", { width: 7.5, height: 34, subdivisions: 1 }, scene);
  path.position.set(0, 0.018, -18);
  path.material = mats.path;
  path.receiveShadows = true;

  const patio = B.MeshBuilder.CreateGround("courtyard", { width: 24, height: 20, subdivisions: 1 }, scene);
  patio.position.set(0, 0.032, 1.5);
  patio.material = mats.patio;
  patio.receiveShadows = true;

  box("facade-left", { width: 8.5, height: 5.4, depth: 0.7 }, new B.Vector3(-7.25, 2.7, 11.3), mats.plaster);
  box("facade-right", { width: 8.5, height: 5.4, depth: 0.7 }, new B.Vector3(7.25, 2.7, 11.3), mats.plaster);
  box("facade-lintel", { width: 6, height: 1.55, depth: 0.7 }, new B.Vector3(0, 4.62, 11.3), mats.worn);
  box("back-wall", { width: 23, height: 5.4, depth: 0.7 }, new B.Vector3(0, 2.7, 17.8), mats.plaster);
  box("side-west", { width: 0.7, height: 5.4, depth: 7.2 }, new B.Vector3(-11.15, 2.7, 14.55), mats.plaster);
  box("side-east", { width: 0.7, height: 5.4, depth: 7.2 }, new B.Vector3(11.15, 2.7, 14.55), mats.plaster);

  const roofA = box("roof-a", { width: 23.8, height: 0.28, depth: 4.2 }, new B.Vector3(0, 5.75, 13.25), mats.roof, false);
  roofA.rotation.x = -0.48;
  const roofB = box("roof-b", { width: 23.8, height: 0.28, depth: 4.2 }, new B.Vector3(0, 5.75, 15.85), mats.roof, false);
  roofB.rotation.x = 0.48;

  box("stone-plinth", { width: 23.4, height: 0.72, depth: 0.82 }, new B.Vector3(0, 0.36, 11.22), mats.stone);
  box("wall-west", { width: 0.9, height: 1.45, depth: 22 }, new B.Vector3(-12.8, 0.72, 0), mats.stone);
  box("wall-east", { width: 0.9, height: 1.45, depth: 22 }, new B.Vector3(12.8, 0.72, 0), mats.stone);
  box("wall-front-left", { width: 9.5, height: 1.45, depth: 0.9 }, new B.Vector3(-8.05, 0.72, -10.7), mats.stone);
  box("wall-front-right", { width: 9.5, height: 1.45, depth: 0.9 }, new B.Vector3(8.05, 0.72, -10.7), mats.stone);

  for (const x of [-6.2, 6.2]) {
    const recess = box(`window-${x}`, { width: 2.25, height: 2.05, depth: 0.16 }, new B.Vector3(x, 3.15, 10.91), mats.wood, false);
    recess.material = new B.PBRMaterial(`window-dark-${x}`, scene);
    recess.material.albedoColor = new B.Color3(0.055, 0.075, 0.07);
    recess.material.roughness = 0.25;
    for (const side of [-1, 1]) {
      const shutter = box(`shutter-${x}-${side}`, { width: 0.78, height: 2.15, depth: 0.14 }, new B.Vector3(x + side * 1.55, 3.15, 10.83), mats.wood, false);
      shutter.rotation.y = side * 0.16;
    }
  }

  const leafMat = new B.PBRMaterial("olive-leaves", scene);
  leafMat.albedoColor = B.Color3.FromHexString("#66715a");
  leafMat.roughness = 1;
  const trunkMat = new B.PBRMaterial("olive-trunk", scene);
  trunkMat.albedoColor = B.Color3.FromHexString("#5b4737");
  trunkMat.roughness = 1;
  for (const [x, z, s] of [[-20, -4, 1.2], [19, 5, 1.05], [-18, 15, 0.95], [20, 17, 1.15]]) {
    const trunk = B.MeshBuilder.CreateCylinder(`olive-trunk-${x}`, { height: 3.2 * s, diameterTop: 0.38 * s, diameterBottom: 0.75 * s, tessellation: 9 }, scene);
    trunk.position.set(x, 1.6 * s, z);
    trunk.material = trunkMat;
    shadows.addShadowCaster(trunk);
    for (let i = 0; i < 4; i++) {
      const crown = B.MeshBuilder.CreateIcoSphere(`olive-crown-${x}-${i}`, { radius: 1.35 * s, subdivisions: 2 }, scene);
      crown.scaling.set(1.35, 0.65, 1);
      crown.position.set(x + (i % 2 ? 0.85 : -0.75) * s, 3.2 * s + (i > 1 ? 0.5 : 0), z + (i - 1.5) * 0.55 * s);
      crown.material = leafMat;
      shadows.addShadowCaster(crown);
    }
  }
}

function boundsOf(meshes) {
  let min = new B.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new B.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const mesh of meshes) {
    if (!mesh.getBoundingInfo) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    min = B.Vector3.Minimize(min, box.minimumWorld);
    max = B.Vector3.Maximize(max, box.maximumWorld);
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

  root.rotation.y = spec.rotationY || 0;
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
  { id: "wooden_gate", x: 0, z: -10.25, target: 5.2, rotationY: Math.PI },
  { id: "painted_wooden_bench", x: -9.7, z: 5.2, target: 3.2, rotationY: Math.PI / 2 },
  { id: "small_wooden_table_01", x: 3.1, z: 3.3, target: 2.4, rotationY: -0.22 },
  { id: "wooden_stool_01", x: 1.4, z: 2.7, target: 1.1, rotationY: 0.4 },
  { id: "folding_wooden_stool", x: 4.7, z: 2.5, target: 1.15, rotationY: -0.55 },
  { id: "wooden_barrels_01", x: 8.2, z: 7.2, target: 3.4, rotationY: -0.25 },
  { id: "wooden_crate_01", x: 7.4, z: 4.5, target: 1.35, rotationY: 0.2 },
  { id: "wooden_crate_02", x: 8.8, z: 4.2, target: 1.25, rotationY: -0.45 },
  { id: "wooden_bucket_01", x: -5.8, z: 4.4, target: 0.75, rotationY: 0.25 },
  { id: "watering_can_metal_01", x: -4.7, z: 4.15, target: 0.85, rotationY: -0.7 },
  { id: "planter_pot_clay", x: -8.8, z: 8.8, target: 1.0, rotationY: 0.1 },
  { id: "wicker_basket_01", x: 4.9, z: 4.3, target: 0.92, rotationY: 0.45 },
  { id: "Lantern_01", x: -1.9, z: 10.55, y: 1.8, target: 0.9, rotationY: Math.PI },
  { id: "rusted_spade_01", x: -10.45, z: 7.1, target: 1.7, rotationY: 0.1 },
  { id: "wooden_axe", x: -9.95, z: 6.3, target: 1.15, rotationY: -0.35 },
  { id: "metal_jug", x: 2.6, z: 3.3, y: 1.05, target: 0.58, rotationY: 0.15 },
  { id: "pot_enamel_01", x: 3.5, z: 3.35, y: 1.05, target: 0.62, rotationY: -0.25 },
  { id: "rock_09", x: 16.3, z: -1.5, target: 3.4, rotationY: 0.5 },
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
statusText.textContent = `${loadedAssets} mallas GLTF reales · 8 materiales PBR · recorrido móvil`;
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
