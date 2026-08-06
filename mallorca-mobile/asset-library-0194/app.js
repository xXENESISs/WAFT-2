const B = window.BABYLON;

const canvas = document.getElementById("renderCanvas");
const summary = document.getElementById("summary");
const status = document.getElementById("status");
const assetList = document.getElementById("assetList");
const searchInput = document.getElementById("searchInput");
const typeFilter = document.getElementById("typeFilter");
const categoryFilter = document.getElementById("categoryFilter");
const assetInfo = document.getElementById("assetInfo");
const assetTitle = document.getElementById("assetTitle");
const assetMeta = document.getElementById("assetMeta");

const engine = new B.Engine(canvas, true, {
  powerPreference: "high-performance",
  adaptToDeviceRatio: false,
});
engine.setHardwareScalingLevel(Math.min(1.5, window.devicePixelRatio || 1));

const scene = new B.Scene(engine);
scene.clearColor = B.Color4.FromHexString("#29342dff");
scene.imageProcessingConfiguration.toneMappingEnabled = true;
scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
scene.imageProcessingConfiguration.exposure = 1.08;
scene.imageProcessingConfiguration.contrast = 1.12;
scene.environmentIntensity = 0.75;

const camera = new B.ArcRotateCamera(
  "camera",
  -Math.PI / 2.3,
  1.08,
  7.2,
  new B.Vector3(0, 1.25, 0),
  scene,
);
camera.lowerRadiusLimit = 2.2;
camera.upperRadiusLimit = 18;
camera.lowerBetaLimit = 0.25;
camera.upperBetaLimit = Math.PI / 2.05;
camera.wheelPrecision = 55;
camera.pinchPrecision = 85;
camera.panningSensibility = 0;
camera.attachControl(canvas, true);

const ambient = new B.HemisphericLight("ambient", new B.Vector3(0.15, 1, 0.25), scene);
ambient.intensity = 0.85;
ambient.groundColor = new B.Color3(0.18, 0.16, 0.12);
const key = new B.DirectionalLight("key", new B.Vector3(-0.55, -1, 0.35), scene);
key.position = new B.Vector3(8, 13, -9);
key.intensity = 2.25;
const fill = new B.DirectionalLight("fill", new B.Vector3(0.65, -0.4, -0.55), scene);
fill.intensity = 0.45;

const ground = B.MeshBuilder.CreateGround("neutral-ground", { width: 26, height: 26 }, scene);
const groundMaterial = new B.PBRMaterial("neutral-ground-material", scene);
groundMaterial.albedoColor = new B.Color3(0.12, 0.15, 0.12);
groundMaterial.roughness = 1;
ground.material = groundMaterial;
ground.receiveShadows = true;

let manifest = null;
let activeAssetId = null;
let preview = null;

function localUrl(repoPath, file = "") {
  const marker = "mallorca-mobile/";
  const relative = repoPath.startsWith(marker) ? repoPath.slice(marker.length) : repoPath;
  return `../${relative}${file}`;
}

function bytesOf(asset) {
  return asset.files.reduce((sum, file) => sum + file.bytes, 0);
}

function resetCamera() {
  camera.alpha = -Math.PI / 2.3;
  camera.beta = 1.08;
  camera.radius = 7.2;
  camera.setTarget(new B.Vector3(0, 1.25, 0));
}

function disposePreview() {
  if (!preview) return;
  for (const animation of preview.animationGroups ?? []) animation.dispose();
  for (const skeleton of preview.skeletons ?? []) skeleton.dispose();
  for (const node of preview.nodes ?? []) {
    if (!node.isDisposed?.()) node.dispose(false, true);
  }
  for (const material of preview.materials ?? []) {
    if (!material.isDisposed?.()) material.dispose(true, true);
  }
  for (const texture of preview.textures ?? []) {
    if (!texture.isDisposed?.()) texture.dispose();
  }
  preview = null;
}

function modelBounds(meshes) {
  let minimum = new B.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let maximum = new B.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  let found = false;

  for (const mesh of meshes) {
    if (typeof mesh.getBoundingInfo !== "function" || mesh.getTotalVertices?.() === 0) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minimum = B.Vector3.Minimize(minimum, box.minimumWorld);
    maximum = B.Vector3.Maximize(maximum, box.maximumWorld);
    found = true;
  }

  if (!found) return { minimum: B.Vector3.Zero(), maximum: new B.Vector3(1, 1, 1) };
  return { minimum, maximum };
}

async function showModel(asset) {
  const result = await B.SceneLoader.ImportMeshAsync(
    "",
    localUrl(asset.localRoot),
    asset.entryFile,
    scene,
  );
  const root = new B.TransformNode(`preview-${asset.id}`, scene);
  const importedSet = new Set(result.meshes);
  for (const mesh of result.meshes) {
    if (!mesh.parent || !importedSet.has(mesh.parent)) mesh.parent = root;
    mesh.isPickable = false;
  }

  const { minimum, maximum } = modelBounds(result.meshes);
  const size = maximum.subtract(minimum);
  const largest = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 4 / largest;
  const centerX = (minimum.x + maximum.x) * 0.5;
  const centerZ = (minimum.z + maximum.z) * 0.5;
  root.scaling.setAll(scale);
  root.position.set(-centerX * scale, -minimum.y * scale, -centerZ * scale);

  preview = {
    nodes: [root, ...result.meshes, ...(result.transformNodes ?? [])],
    materials: result.materials ?? [],
    textures: result.textures ?? [],
    skeletons: result.skeletons ?? [],
    animationGroups: result.animationGroups ?? [],
  };
}

function textureWithScale(url, uScale = 2.2, vScale = 2.2) {
  const texture = new B.Texture(url, scene);
  texture.uScale = uScale;
  texture.vScale = vScale;
  texture.anisotropicFilteringLevel = 4;
  return texture;
}

function showTexture(asset) {
  const rootUrl = localUrl(asset.localRoot);
  const root = new B.TransformNode(`preview-${asset.id}`, scene);
  const material = new B.PBRMaterial(`material-${asset.id}`, scene);
  const albedo = textureWithScale(`${rootUrl}${asset.maps.diffuse}`);
  const normal = textureWithScale(`${rootUrl}${asset.maps.normal_gl}`);
  const roughness = textureWithScale(`${rootUrl}${asset.maps.roughness}`);

  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.bumpTexture.level = 0.72;
  material.metallicTexture = roughness;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.metallic = 0;
  material.roughness = 1;

  const wall = B.MeshBuilder.CreateBox(`wall-${asset.id}`, { width: 4.5, height: 3.2, depth: 0.28 }, scene);
  wall.parent = root;
  wall.position.set(0, 1.6, 0.65);
  wall.material = material;

  const slab = B.MeshBuilder.CreateBox(`slab-${asset.id}`, { width: 4.5, height: 0.24, depth: 3.4 }, scene);
  slab.parent = root;
  slab.position.set(0, 0.12, -1.05);
  slab.material = material;

  const sphere = B.MeshBuilder.CreateSphere(`sphere-${asset.id}`, { diameter: 1.25, segments: 28 }, scene);
  sphere.parent = root;
  sphere.position.set(-1.45, 0.9, -0.3);
  sphere.material = material;

  preview = {
    nodes: [root, wall, slab, sphere],
    materials: [material],
    textures: [albedo, normal, roughness],
    skeletons: [],
    animationGroups: [],
  };
}

async function selectAsset(asset) {
  if (activeAssetId === asset.id) return;
  activeAssetId = asset.id;
  document.querySelectorAll(".asset-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.assetId === asset.id);
  });

  status.textContent = `Cargando ${asset.id}…`;
  disposePreview();
  resetCamera();

  try {
    if (asset.type === "model") await showModel(asset);
    else showTexture(asset);
    const megabytes = (bytesOf(asset) / 1_048_576).toFixed(1);
    assetTitle.textContent = asset.id;
    assetMeta.textContent = `${asset.type === "model" ? "Malla" : "Material"} · ${asset.category} · ${asset.role} · ${megabytes} MB · ${asset.license}`;
    assetInfo.hidden = false;
    status.textContent = `${asset.id} cargado. Arrastra para girar y pellizca para acercarte.`;
  } catch (error) {
    console.error(error);
    activeAssetId = null;
    status.textContent = `No se pudo cargar ${asset.id}: ${error.message}`;
  }
}

function visibleAssets() {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  const category = categoryFilter.value;
  return manifest.assets.filter((asset) => {
    if (type !== "all" && asset.type !== type) return false;
    if (category !== "all" && asset.category !== category) return false;
    if (!query) return true;
    return `${asset.id} ${asset.role} ${asset.category}`.toLowerCase().includes(query);
  });
}

function renderAssetList() {
  const assets = visibleAssets();
  const groups = new Map();
  for (const asset of assets) {
    const key = asset.category || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
  }

  assetList.replaceChildren();
  for (const [category, categoryAssets] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const heading = document.createElement("div");
    heading.className = "category-heading";
    heading.textContent = `${category} · ${categoryAssets.length}`;
    assetList.append(heading);

    for (const asset of categoryAssets.sort((a, b) => a.id.localeCompare(b.id))) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "asset-button";
      button.dataset.assetId = asset.id;
      button.classList.toggle("active", asset.id === activeAssetId);
      const megabytes = (bytesOf(asset) / 1_048_576).toFixed(1);
      button.innerHTML = `<strong>${asset.id}</strong><small>${asset.type === "model" ? "Malla" : "Material"} · ${asset.role}<br>${megabytes} MB · ${asset.resolution}</small>`;
      button.addEventListener("click", () => selectAsset(asset));
      assetList.append(button);
    }
  }

  if (!assets.length) {
    const empty = document.createElement("p");
    empty.textContent = "No hay assets que coincidan con estos filtros.";
    assetList.append(empty);
  }
}

async function loadManifest() {
  const response = await fetch("../assets/vendor/polyhaven/import-manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("El importador todavía no ha generado el manifiesto 0.19.4.");
  manifest = await response.json();

  const categories = [...new Set(manifest.assets.map((asset) => asset.category).filter(Boolean))].sort();
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  }

  const totalMb = ((manifest.totalBytes ?? manifest.assets.reduce((sum, asset) => sum + bytesOf(asset), 0)) / 1_048_576).toFixed(1);
  summary.textContent = `${manifest.importedCount ?? manifest.assets.length} importados · ${manifest.rejectedCount ?? 0} rechazados · ${totalMb} MB locales`;
  status.textContent = "Selecciona un asset; el visor solo carga uno cada vez.";
  renderAssetList();

  const firstModel = manifest.assets.find((asset) => asset.type === "model");
  if (firstModel) await selectAsset(firstModel);
}

for (const control of [searchInput, typeFilter, categoryFilter]) {
  control.addEventListener(control === searchInput ? "input" : "change", renderAssetList);
}

document.getElementById("resetCamera").addEventListener("click", resetCamera);
window.addEventListener("resize", () => engine.resize());
engine.runRenderLoop(() => scene.render());

loadManifest().catch((error) => {
  console.error(error);
  summary.textContent = "Biblioteca no disponible";
  status.textContent = error.message;
});
