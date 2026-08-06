const B = window.BABYLON;
const canvas = document.getElementById("renderCanvas");
const status = document.getElementById("status");
const assetList = document.getElementById("assetList");
const engine = new B.Engine(canvas, true, { powerPreference: "high-performance" });
const scene = new B.Scene(engine);
scene.clearColor = B.Color4.FromHexString("#222b27ff");
scene.imageProcessingConfiguration.toneMappingEnabled = true;
scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
scene.imageProcessingConfiguration.exposure = 1.15;
scene.imageProcessingConfiguration.contrast = 1.08;

const camera = new B.ArcRotateCamera("camera", -Math.PI / 2.25, 1.08, 8, new B.Vector3(0, 1, 0), scene);
camera.lowerRadiusLimit = 2.4;
camera.upperRadiusLimit = 18;
camera.wheelPrecision = 55;
camera.pinchPrecision = 90;
camera.attachControl(canvas, true);

const ambient = new B.HemisphericLight("ambient", new B.Vector3(0.2, 1, 0.25), scene);
ambient.intensity = 0.72;
const key = new B.DirectionalLight("key", new B.Vector3(-0.5, -1, 0.35), scene);
key.position = new B.Vector3(7, 12, -8);
key.intensity = 2.4;
const ground = B.MeshBuilder.CreateGround("neutral-ground", { width: 30, height: 30 }, scene);
const groundMaterial = new B.PBRMaterial("neutral-ground-material", scene);
groundMaterial.albedoColor = new B.Color3(0.13, 0.15, 0.13);
groundMaterial.roughness = 1;
ground.material = groundMaterial;

function localUrl(repoPath, file = "") {
  const marker = "mallorca-mobile/";
  const relative = repoPath.startsWith(marker) ? repoPath.slice(marker.length) : repoPath;
  return `../${relative}${file}`;
}

function addCard(asset) {
  const element = document.createElement("div");
  element.className = "asset";
  const bytes = asset.files.reduce((sum, file) => sum + file.bytes, 0);
  element.innerHTML = `<strong>${asset.id}</strong><small>${asset.type} · ${asset.role}<br>${asset.resolution} · ${(bytes / 1048576).toFixed(1)} MB · ${asset.license}</small>`;
  assetList.append(element);
}

function applyTextureSet(asset, index) {
  const rootUrl = localUrl(asset.localRoot);
  const material = new B.PBRMaterial(`material-${asset.id}`, scene);
  material.albedoTexture = new B.Texture(`${rootUrl}${asset.maps.diffuse}`, scene);
  material.bumpTexture = new B.Texture(`${rootUrl}${asset.maps.normal_gl}`, scene);
  material.bumpTexture.level = 0.65;
  material.metallic = 0;
  material.roughness = 0.9;
  const sample = B.MeshBuilder.CreateBox(`sample-${asset.id}`, { width: 2.6, height: 2.6, depth: 0.35 }, scene);
  sample.position.set(2.5 + index * 3.2, 1.35, 0.4);
  sample.material = material;
}

async function loadManifest() {
  const response = await fetch("../assets/vendor/polyhaven/import-manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("El importador todavía no ha generado el manifiesto.");
  const manifest = await response.json();
  let modelIndex = 0;
  let textureIndex = 0;
  for (const asset of manifest.assets) {
    addCard(asset);
    if (asset.type === "model") {
      const result = await B.SceneLoader.ImportMeshAsync("", localUrl(asset.localRoot), asset.entryFile, scene);
      const root = new B.TransformNode(`root-${asset.id}`, scene);
      result.meshes.filter((mesh) => !mesh.parent).forEach((mesh) => { mesh.parent = root; });
      root.position.set(-2.3 + modelIndex * 3.4, 0, 0);
      modelIndex += 1;
    } else {
      applyTextureSet(asset, textureIndex);
      textureIndex += 1;
    }
  }
  status.textContent = `${manifest.assets.length} assets importados con procedencia y hash registrados.`;
}

loadManifest().catch((error) => {
  console.error(error);
  status.textContent = error.message;
});

document.getElementById("resetCamera").addEventListener("click", () => {
  camera.setPosition(new B.Vector3(0, 5.5, -7));
  camera.setTarget(new B.Vector3(0, 1, 0));
});
window.addEventListener("resize", () => engine.resize());
engine.runRenderLoop(() => scene.render());
