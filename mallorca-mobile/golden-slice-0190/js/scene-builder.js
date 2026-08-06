import { INTERACTABLES, QUALITY, REGION } from "./config.js";

const B = window.BABYLON;

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function material(scene, name, diffuse, options = {}) {
  const mat = new B.StandardMaterial(name, scene);
  mat.diffuseColor = B.Color3.FromHexString(diffuse);
  mat.specularColor = options.specular ? B.Color3.FromHexString(options.specular) : B.Color3.Black();
  mat.roughness = options.roughness ?? 0.95;
  if (options.emissive) mat.emissiveColor = B.Color3.FromHexString(options.emissive);
  if (Number.isFinite(options.alpha)) mat.alpha = options.alpha;
  return mat;
}

function gaussianHill(x, z, centerX, centerZ, width, height) {
  const dx = x - centerX;
  const dz = z - centerZ;
  return Math.exp(-(dx * dx + dz * dz) / (width * width)) * height;
}

export function terrainHeight(x, z) {
  const coast = B.Scalar.Clamp((z + 62) / 16, 0, 1);
  const undulation = Math.sin(x * 0.083) * 0.45 + Math.cos(z * 0.067) * 0.38 + Math.sin((x + z) * 0.035) * 0.42;
  const hills =
    gaussianHill(x, z, 57, 32, 33, 8.8) +
    gaussianHill(x, z, -57, 29, 38, 5.6) +
    gaussianHill(x, z, 20, 72, 45, 4.2);
  const dryValley = gaussianHill(x, z, 13, 5, 28, -1.7);
  return Math.max(0.25, 0.38 + coast * (1.7 + undulation + hills + dryValley));
}

function updateGroundHeights(ground) {
  const positions = ground.getVerticesData(B.VertexBuffer.PositionKind);
  if (!positions) return;
  for (let index = 0; index < positions.length; index += 3) {
    positions[index + 1] = terrainHeight(positions[index], positions[index + 2]);
  }
  ground.updateVerticesData(B.VertexBuffer.PositionKind, positions);
  const indices = ground.getIndices();
  const normals = [];
  B.VertexData.ComputeNormals(positions, indices, normals);
  ground.updateVerticesData(B.VertexBuffer.NormalKind, normals);
  ground.refreshBoundingInfo();
}

function selectQuality() {
  const mobile = matchMedia("(pointer: coarse)").matches;
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (memory <= 3 || cores <= 4) return "low";
  if (!mobile && memory >= 8 && cores >= 8) return "high";
  return "medium";
}

function createTerrain(scene, materials) {
  const ground = B.MeshBuilder.CreateGround("terrain-llevant", {
    width: 200,
    height: 180,
    subdivisions: 72,
    updatable: true,
  }, scene);
  ground.material = materials.ground;
  ground.receiveShadows = true;
  ground.isPickable = false;
  updateGroundHeights(ground);

  const beach = B.MeshBuilder.CreateGround("beach", { width: 200, height: 18, subdivisions: 2 }, scene);
  beach.position.set(0, 0.31, -62);
  beach.material = materials.sand;
  beach.isPickable = false;

  const sea = B.MeshBuilder.CreateGround("mediterranean-sea", { width: 230, height: 80, subdivisions: 2 }, scene);
  sea.position.set(0, 0.08, -103);
  sea.material = materials.water;
  sea.isPickable = false;

  return { ground, beach, sea };
}

function createPath(scene, materials) {
  const route = [
    new B.Vector3(-18, 0, 49),
    new B.Vector3(-9, 0, 35),
    new B.Vector3(3, 0, 19),
    new B.Vector3(20, 0, 8),
    new B.Vector3(43, 0, -10),
    new B.Vector3(19, 0, -28),
    new B.Vector3(-12, 0, -38),
    new B.Vector3(-52, 0, -51),
  ];

  const source = B.MeshBuilder.CreateBox("path-stone-source", { width: 2.2, height: 0.18, depth: 1.45 }, scene);
  source.material = materials.path;
  source.receiveShadows = true;
  source.isPickable = false;
  let placedSource = false;

  route.slice(0, -1).forEach((start, segmentIndex) => {
    const end = route[segmentIndex + 1];
    const distance = B.Vector3.Distance(start, end);
    const count = Math.max(2, Math.floor(distance / 2.2));
    const heading = Math.atan2(end.x - start.x, end.z - start.z);
    for (let index = 0; index < count; index += 1) {
      const t = index / count;
      const x = B.Scalar.Lerp(start.x, end.x, t);
      const z = B.Scalar.Lerp(start.z, end.z, t);
      const stone = placedSource ? source.createInstance(`path-${segmentIndex}-${index}`) : source;
      placedSource = true;
      stone.position.set(x, terrainHeight(x, z) + 0.04, z);
      stone.rotation.y = heading + (index % 3 - 1) * 0.035;
      stone.scaling.x = 0.88 + (index % 4) * 0.045;
    }
  });

  return route;
}

function createStoneWalls(scene, materials) {
  const wallSource = B.MeshBuilder.CreateBox("dry-stone-wall-source", { width: 2.6, height: 0.85, depth: 0.68 }, scene);
  wallSource.material = materials.stone;
  wallSource.receiveShadows = true;
  wallSource.isPickable = false;

  let usedSource = false;
  const lines = [
    { from: [-88, 22], to: [-32, 14] },
    { from: [26, 24], to: [88, 10] },
    { from: [22, -22], to: [76, -35] },
  ];

  lines.forEach(({ from, to }, lineIndex) => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const distance = Math.hypot(dx, dz);
    const count = Math.floor(distance / 2.55);
    const rotation = Math.atan2(dx, dz) + Math.PI / 2;
    for (let index = 0; index < count; index += 1) {
      const t = index / Math.max(1, count - 1);
      const x = B.Scalar.Lerp(from[0], to[0], t);
      const z = B.Scalar.Lerp(from[1], to[1], t);
      const segment = usedSource ? wallSource.createInstance(`wall-${lineIndex}-${index}`) : wallSource;
      usedSource = true;
      segment.position.set(x, terrainHeight(x, z) + 0.38, z);
      segment.rotation.y = rotation;
      segment.scaling.y = 0.85 + (index % 4) * 0.07;
    }
  });
}

function createBuildings(scene, materials, quality, shadowGenerator) {
  const archetypes = [
    { id: "village", width: 5.8, depth: 5.2, height: 3.8, body: materials.plaster, roof: materials.roof },
    { id: "residential", width: 7.2, depth: 5.7, height: 5.2, body: materials.warmPlaster, roof: materials.flatRoof },
    { id: "port", width: 8.0, depth: 4.6, height: 4.3, body: materials.paleStone, roof: materials.flatRoof },
  ];

  const masters = archetypes.map((type) => {
    const body = B.MeshBuilder.CreateBox(`building-${type.id}-body`, {
      width: type.width,
      height: type.height,
      depth: type.depth,
    }, scene);
    body.material = type.body;
    body.receiveShadows = true;
    body.isPickable = false;

    const roof = B.MeshBuilder.CreateBox(`building-${type.id}-roof`, {
      width: type.width + 0.35,
      height: 0.35,
      depth: type.depth + 0.35,
    }, scene);
    roof.material = type.roof;
    roof.receiveShadows = true;
    roof.isPickable = false;

    const door = B.MeshBuilder.CreateBox(`building-${type.id}-door`, { width: 1.1, height: 2.05, depth: 0.15 }, scene);
    door.material = materials.wood;
    door.isPickable = false;

    if (shadowGenerator) shadowGenerator.addShadowCaster(body);
    return { ...type, body, roof, door, used: false };
  });

  const random = mulberry32(REGION.seed + 91);
  const clusters = [
    { center: [-48, -38], radiusX: 31, radiusZ: 13, family: 2 },
    { center: [-34, 2], radiusX: 25, radiusZ: 18, family: 0 },
    { center: [56, 19], radiusX: 28, radiusZ: 19, family: 1 },
  ];

  for (let index = 0; index < quality.buildings; index += 1) {
    const cluster = clusters[index % clusters.length];
    const archetype = masters[(cluster.family + (index % 5 === 0 ? 1 : 0)) % masters.length];
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    const x = cluster.center[0] + Math.cos(angle) * cluster.radiusX * radius;
    const z = cluster.center[1] + Math.sin(angle) * cluster.radiusZ * radius;
    const scale = 0.78 + random() * 0.48;
    const rotation = (Math.round((random() * Math.PI * 2) / (Math.PI / 2)) * Math.PI) / 2;
    const y = terrainHeight(x, z);

    const body = archetype.used ? archetype.body.createInstance(`building-body-${index}`) : archetype.body;
    const roof = archetype.used ? archetype.roof.createInstance(`building-roof-${index}`) : archetype.roof;
    const door = archetype.used ? archetype.door.createInstance(`building-door-${index}`) : archetype.door;
    archetype.used = true;

    body.position.set(x, y + archetype.height * scale * 0.5, z);
    body.scaling.set(scale, scale, scale);
    body.rotation.y = rotation;

    roof.position.set(x, y + archetype.height * scale + 0.18, z);
    roof.scaling.set(scale, scale, scale);
    roof.rotation.y = rotation;

    const doorOffset = new B.Vector3(0, 1.03 * scale, archetype.depth * scale * 0.5 + 0.08);
    const rotationMatrix = B.Matrix.RotationY(rotation);
    const rotatedOffset = B.Vector3.TransformCoordinates(doorOffset, rotationMatrix);
    door.position.set(x + rotatedOffset.x, y + rotatedOffset.y, z + rotatedOffset.z);
    door.scaling.set(scale, scale, scale);
    door.rotation.y = rotation;
  }
}

function createVegetation(scene, materials, quality, shadowGenerator) {
  const random = mulberry32(REGION.seed + 207);

  const pineTrunk = B.MeshBuilder.CreateCylinder("pine-trunk-source", { height: 2.5, diameterTop: 0.3, diameterBottom: 0.48, tessellation: 7 }, scene);
  pineTrunk.material = materials.trunk;
  pineTrunk.isPickable = false;
  const pineCrown = B.MeshBuilder.CreateCylinder("pine-crown-source", { height: 3.7, diameterTop: 0.2, diameterBottom: 3.5, tessellation: 8 }, scene);
  pineCrown.material = materials.pine;
  pineCrown.isPickable = false;

  const oliveTrunk = B.MeshBuilder.CreateCylinder("olive-trunk-source", { height: 1.75, diameterTop: 0.42, diameterBottom: 0.68, tessellation: 7 }, scene);
  oliveTrunk.material = materials.trunk;
  oliveTrunk.isPickable = false;
  const oliveCrown = B.MeshBuilder.CreateSphere("olive-crown-source", { diameter: 2.8, segments: 8 }, scene);
  oliveCrown.material = materials.olive;
  oliveCrown.isPickable = false;

  if (shadowGenerator) {
    shadowGenerator.addShadowCaster(pineCrown);
    shadowGenerator.addShadowCaster(oliveCrown);
  }

  let pineUsed = false;
  let oliveUsed = false;
  for (let index = 0; index < quality.vegetation; index += 1) {
    let x;
    let z;
    let attempts = 0;
    do {
      x = -90 + random() * 180;
      z = -46 + random() * 126;
      attempts += 1;
    } while (attempts < 10 && ((Math.abs(x + 34) < 24 && Math.abs(z - 2) < 17) || (Math.abs(x + 48) < 28 && Math.abs(z + 38) < 14)));

    const isOlive = index % 3 !== 0;
    const scale = isOlive ? 0.72 + random() * 0.48 : 0.85 + random() * 0.65;
    const y = terrainHeight(x, z);

    if (isOlive) {
      const trunk = oliveUsed ? oliveTrunk.createInstance(`olive-trunk-${index}`) : oliveTrunk;
      const crown = oliveUsed ? oliveCrown.createInstance(`olive-crown-${index}`) : oliveCrown;
      oliveUsed = true;
      trunk.position.set(x, y + 0.8 * scale, z);
      trunk.scaling.set(scale, scale, scale);
      crown.position.set(x, y + 2.0 * scale, z);
      crown.scaling.set(scale * 1.15, scale * 0.72, scale);
    } else {
      const trunk = pineUsed ? pineTrunk.createInstance(`pine-trunk-${index}`) : pineTrunk;
      const crown = pineUsed ? pineCrown.createInstance(`pine-crown-${index}`) : pineCrown;
      pineUsed = true;
      trunk.position.set(x, y + 1.2 * scale, z);
      trunk.scaling.set(scale, scale, scale);
      crown.position.set(x, y + 3.4 * scale, z);
      crown.scaling.set(scale, scale, scale);
    }
  }
}

function createDock(scene, materials, shadowGenerator) {
  const dockRoot = new B.TransformNode("dock-root", scene);
  dockRoot.position.set(-52, 0.35, -57);

  const deck = B.MeshBuilder.CreateBox("dock-deck", { width: 8, height: 0.42, depth: 13 }, scene);
  deck.parent = dockRoot;
  deck.position.z = -3.8;
  deck.material = materials.wood;
  deck.receiveShadows = true;

  for (let index = 0; index < 6; index += 1) {
    const post = B.MeshBuilder.CreateCylinder(`dock-post-${index}`, { height: 2.8, diameter: 0.34, tessellation: 8 }, scene);
    post.parent = dockRoot;
    post.position.set(index % 2 === 0 ? -3.4 : 3.4, -0.6, -0.5 - Math.floor(index / 2) * 4.1);
    post.material = materials.woodDark;
    if (shadowGenerator) shadowGenerator.addShadowCaster(post);
  }

  const boat = B.MeshBuilder.CreateCylinder("fishing-boat", { height: 5.6, diameterTop: 1.3, diameterBottom: 2.4, tessellation: 12 }, scene);
  boat.rotation.z = Math.PI / 2;
  boat.rotation.y = 0.18;
  boat.position.set(-61, 0.6, -65);
  boat.scaling.z = 0.55;
  boat.material = materials.boat;
  if (shadowGenerator) shadowGenerator.addShadowCaster(boat);
}

function createPlayer(scene, materials, shadowGenerator) {
  const root = new B.TransformNode("macaque-player", scene);

  const hips = B.MeshBuilder.CreateSphere("macaque-hips", { diameter: 1.15, segments: 12 }, scene);
  hips.parent = root;
  hips.position.y = 1.05;
  hips.scaling.set(0.86, 1.05, 0.72);
  hips.material = materials.furDark;

  const torso = B.MeshBuilder.CreateSphere("macaque-torso", { diameter: 1.45, segments: 12 }, scene);
  torso.parent = root;
  torso.position.y = 1.75;
  torso.scaling.set(0.78, 1.02, 0.62);
  torso.material = materials.fur;

  const chest = B.MeshBuilder.CreateSphere("macaque-chest", { diameter: 0.86, segments: 10 }, scene);
  chest.parent = root;
  chest.position.set(0, 1.78, 0.46);
  chest.scaling.set(0.8, 1.0, 0.3);
  chest.material = materials.furLight;

  const head = B.MeshBuilder.CreateSphere("macaque-head", { diameter: 1.0, segments: 14 }, scene);
  head.parent = root;
  head.position.y = 2.72;
  head.scaling.set(0.88, 1.0, 0.84);
  head.material = materials.fur;

  const muzzle = B.MeshBuilder.CreateSphere("macaque-muzzle", { diameter: 0.62, segments: 12 }, scene);
  muzzle.parent = root;
  muzzle.position.set(0, 2.62, 0.46);
  muzzle.scaling.set(0.85, 0.65, 0.55);
  muzzle.material = materials.face;

  [-1, 1].forEach((side) => {
    const ear = B.MeshBuilder.CreateSphere(`macaque-ear-${side}`, { diameter: 0.38, segments: 10 }, scene);
    ear.parent = root;
    ear.position.set(side * 0.45, 2.78, 0.02);
    ear.scaling.x = 0.45;
    ear.material = materials.face;

    const eye = B.MeshBuilder.CreateSphere(`macaque-eye-${side}`, { diameter: 0.13, segments: 8 }, scene);
    eye.parent = root;
    eye.position.set(side * 0.2, 2.82, 0.4);
    eye.material = materials.eye;
  });

  const nose = B.MeshBuilder.CreateSphere("macaque-nose", { diameter: 0.18, segments: 8 }, scene);
  nose.parent = root;
  nose.position.set(0, 2.65, 0.72);
  nose.scaling.set(1.1, 0.72, 0.55);
  nose.material = materials.nose;

  const limbs = { arms: [], legs: [] };
  [-1, 1].forEach((side) => {
    const armPivot = new B.TransformNode(`arm-pivot-${side}`, scene);
    armPivot.parent = root;
    armPivot.position.set(side * 0.58, 2.05, 0);
    const arm = B.MeshBuilder.CreateCylinder(`macaque-arm-${side}`, { height: 1.35, diameterTop: 0.28, diameterBottom: 0.36, tessellation: 9 }, scene);
    arm.parent = armPivot;
    arm.position.y = -0.62;
    arm.rotation.z = side * 0.13;
    arm.material = materials.fur;
    limbs.arms.push(armPivot);

    const legPivot = new B.TransformNode(`leg-pivot-${side}`, scene);
    legPivot.parent = root;
    legPivot.position.set(side * 0.3, 1.18, 0);
    const leg = B.MeshBuilder.CreateCylinder(`macaque-leg-${side}`, { height: 1.15, diameterTop: 0.36, diameterBottom: 0.27, tessellation: 9 }, scene);
    leg.parent = legPivot;
    leg.position.y = -0.52;
    leg.material = materials.furDark;
    limbs.legs.push(legPivot);
  });

  const tailSegments = [];
  for (let index = 0; index < 5; index += 1) {
    const segment = B.MeshBuilder.CreateCylinder(`tail-${index}`, { height: 0.55, diameterTop: 0.16, diameterBottom: 0.2, tessellation: 8 }, scene);
    segment.parent = root;
    segment.position.set(0, 1.05 - index * 0.11, -0.58 - index * 0.42);
    segment.rotation.x = Math.PI / 2.5 + index * 0.08;
    segment.material = materials.furDark;
    tailSegments.push(segment);
  }

  root.position.set(REGION.spawn.x, terrainHeight(REGION.spawn.x, REGION.spawn.z), REGION.spawn.z);
  root.rotation.y = REGION.spawn.yaw;

  if (shadowGenerator) {
    [hips, torso, head, ...tailSegments].forEach((mesh) => shadowGenerator.addShadowCaster(mesh));
  }

  return { root, limbs, tailSegments };
}

function createInteractables(scene, materials) {
  return INTERACTABLES.map((definition, index) => {
    const root = new B.TransformNode(`interactable-${definition.id}`, scene);
    const x = definition.position.x;
    const z = definition.position.z;
    root.position.set(x, terrainHeight(x, z), z);

    let mesh;
    if (definition.type === "pickup") {
      mesh = B.MeshBuilder.CreateBox(`${definition.id}-mesh`, { width: 0.9, height: 0.28, depth: 0.62 }, scene);
      mesh.position.y = 0.65;
      mesh.rotation.y = 0.35;
      mesh.material = materials.notes;
    } else if (definition.type === "clue") {
      mesh = B.MeshBuilder.CreateTorus(`${definition.id}-mesh`, { diameter: 1.5, thickness: 0.22, tessellation: 16 }, scene);
      mesh.position.y = 0.38;
      mesh.rotation.x = Math.PI / 2;
      mesh.scaling.z = 0.55;
      mesh.material = materials.clue;
    } else {
      mesh = B.MeshBuilder.CreateCylinder(`${definition.id}-mesh`, { height: 2.4, diameterTop: 0.18, diameterBottom: 0.42, tessellation: 8 }, scene);
      mesh.position.y = 1.2;
      mesh.material = materials.marker;
    }
    mesh.parent = root;
    mesh.isPickable = false;

    const glow = B.MeshBuilder.CreateTorus(`${definition.id}-glow`, { diameter: 2.4 + index * 0.2, thickness: 0.055, tessellation: 28 }, scene);
    glow.parent = root;
    glow.position.y = 0.1;
    glow.rotation.x = Math.PI / 2;
    glow.material = materials.glow;
    glow.isPickable = false;

    return { ...definition, root, mesh, glow, completed: false };
  });
}

function createMaterials(scene) {
  return {
    ground: material(scene, "ground-mat", "#8d8a5e"),
    sand: material(scene, "sand-mat", "#c8b985"),
    water: material(scene, "water-mat", "#287f93", { specular: "#b6e7e8", alpha: 0.88 }),
    path: material(scene, "path-mat", "#b2a17a"),
    stone: material(scene, "stone-mat", "#8b806a"),
    plaster: material(scene, "plaster-mat", "#ddd4ba"),
    warmPlaster: material(scene, "warm-plaster-mat", "#c9b38d"),
    paleStone: material(scene, "pale-stone-mat", "#b8ad92"),
    roof: material(scene, "roof-mat", "#936044"),
    flatRoof: material(scene, "flat-roof-mat", "#8f8674"),
    wood: material(scene, "wood-mat", "#79563b"),
    woodDark: material(scene, "wood-dark-mat", "#4e392b"),
    boat: material(scene, "boat-mat", "#e7dfc9"),
    trunk: material(scene, "trunk-mat", "#5d4630"),
    pine: material(scene, "pine-mat", "#365e43"),
    olive: material(scene, "olive-mat", "#677550"),
    fur: material(scene, "fur-mat", "#7b654f"),
    furDark: material(scene, "fur-dark-mat", "#4e4035"),
    furLight: material(scene, "fur-light-mat", "#9b8269"),
    face: material(scene, "face-mat", "#b28f79"),
    eye: material(scene, "eye-mat", "#14110f", { specular: "#ffffff" }),
    nose: material(scene, "nose-mat", "#2c2421"),
    notes: material(scene, "notes-mat", "#d7bc74", { emissive: "#5b4820" }),
    clue: material(scene, "clue-mat", "#9b6d4d", { emissive: "#332117" }),
    marker: material(scene, "marker-mat", "#d1b66d", { emissive: "#49380f" }),
    glow: material(scene, "glow-mat", "#e8cb77", { emissive: "#d6b750", alpha: 0.78 }),
  };
}

export async function buildScene(canvas, onProgress = () => {}) {
  if (!B) throw new Error("Babylon.js no está disponible");

  onProgress(0.08, "Creando motor 3D…");
  const engine = new B.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    adaptToDeviceRatio: false,
    powerPreference: "high-performance",
  });

  const qualityId = selectQuality();
  const quality = QUALITY[qualityId];
  engine.setHardwareScalingLevel(quality.hardwareScale);

  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0.48, 0.69, 0.78, 1);
  scene.fogMode = B.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0048;
  scene.fogColor = new B.Color3(0.67, 0.75, 0.72);
  scene.skipPointerMovePicking = true;
  scene.autoClear = true;

  const camera = new B.FreeCamera("third-person-camera", new B.Vector3(0, 8, 10), scene);
  camera.minZ = 0.2;
  camera.maxZ = 260;
  camera.fov = 0.88;
  scene.activeCamera = camera;

  const ambient = new B.HemisphericLight("ambient-light", new B.Vector3(0.1, 1, 0.2), scene);
  ambient.intensity = 0.72;
  ambient.groundColor = new B.Color3(0.26, 0.22, 0.17);

  const sun = new B.DirectionalLight("mediterranean-sun", new B.Vector3(-0.62, -1, 0.34), scene);
  sun.position = new B.Vector3(62, 95, -46);
  sun.intensity = 1.35;

  let shadowGenerator = null;
  if (quality.shadows) {
    shadowGenerator = new B.ShadowGenerator(1024, sun);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 16;
    shadowGenerator.bias = 0.0008;
  }

  const materials = createMaterials(scene);
  onProgress(0.2, "Modelando costa y relieve…");
  const terrain = createTerrain(scene, materials);

  onProgress(0.34, "Trazando caminos y muros…");
  const route = createPath(scene, materials);
  createStoneWalls(scene, materials);

  onProgress(0.5, "Construyendo arquitectura balear…");
  createBuildings(scene, materials, quality, shadowGenerator);
  createDock(scene, materials, shadowGenerator);

  onProgress(0.67, "Distribuyendo vegetación…");
  createVegetation(scene, materials, quality, shadowGenerator);

  onProgress(0.81, "Preparando expedición y encuentros…");
  const player = createPlayer(scene, materials, shadowGenerator);
  const interactables = createInteractables(scene, materials);

  const pipeline = new B.DefaultRenderingPipeline("golden-slice-pipeline", true, scene, [camera]);
  pipeline.fxaaEnabled = true;
  pipeline.samples = qualityId === "high" ? 2 : 1;
  scene.imageProcessingConfiguration.contrast = 1.08;
  scene.imageProcessingConfiguration.exposure = 1.02;
  pipeline.bloomEnabled = qualityId === "high";
  pipeline.bloomWeight = 0.14;
  pipeline.bloomThreshold = 0.88;

  onProgress(0.94, "Optimizando escena…");
  scene.executeWhenReady(() => onProgress(1, "Listo"));

  return {
    engine,
    scene,
    camera,
    qualityId,
    quality,
    terrain,
    route,
    player,
    interactables,
    bounds: REGION.bounds,
    terrainHeight,
    dispose() {
      scene.dispose();
      engine.dispose();
    },
  };
}
