import { BUILD, OBJECTIVES, REGION } from "./config.js";
import { InputController } from "./input-controller.js";
import { PlayerController } from "./player-controller.js";
import { SaveStore } from "./save-store.js";
import { buildScene } from "./scene-builder.js";

const ui = {
  canvas: document.querySelector("#renderCanvas"),
  saveButton: document.querySelector("#saveButton"),
  qualityBadge: document.querySelector("#qualityBadge"),
  objectiveText: document.querySelector("#objectiveText"),
  locationName: document.querySelector("#locationName"),
  distanceText: document.querySelector("#distanceText"),
  interactionPrompt: document.querySelector("#interactionPrompt"),
  interactionText: document.querySelector("#interactionText"),
  toast: document.querySelector("#toast"),
  loadingScreen: document.querySelector("#loadingScreen"),
  loadingBar: document.querySelector("#loadingBar"),
  loadingText: document.querySelector("#loadingText"),
  joystick: document.querySelector("#joystick"),
  joystickKnob: document.querySelector("#joystickKnob"),
  runButton: document.querySelector("#runButton"),
  actionButton: document.querySelector("#actionButton"),
};

const saveStore = new SaveStore();
let world = null;
let input = null;
let player = null;
let objectiveStage = 0;
let collected = [];
let nearestInteractable = null;
let travelledDistance = 0;
let toastTimer = null;
let autosaveTimer = 0;

function setProgress(value, text) {
  ui.loadingBar.style.width = `${Math.round(value * 100)}%`;
  ui.loadingText.textContent = text;
}

function showToast(message, duration = 2200) {
  clearTimeout(toastTimer);
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), duration);
}

function setObjective(stage) {
  objectiveStage = Math.max(0, Math.min(OBJECTIVES.length - 1, stage));
  ui.objectiveText.textContent = OBJECTIVES[objectiveStage];
}

function setCompletedState() {
  for (const interactable of world.interactables) {
    interactable.completed = collected.includes(interactable.id) || objectiveStage > interactable.requiredStage;
    interactable.root.setEnabled(!interactable.completed);
  }
}

function getNearestInteractable() {
  const playerPosition = player.getPosition();
  let nearest = null;
  let nearestDistance = Infinity;

  for (const interactable of world.interactables) {
    if (interactable.completed || interactable.requiredStage !== objectiveStage) continue;
    const distance = Math.hypot(
      playerPosition.x - interactable.root.position.x,
      playerPosition.z - interactable.root.position.z,
    );
    if (distance <= interactable.radius && distance < nearestDistance) {
      nearest = interactable;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function updateInteractionUi() {
  nearestInteractable = getNearestInteractable();
  ui.interactionPrompt.hidden = !nearestInteractable;
  if (nearestInteractable) ui.interactionText.textContent = nearestInteractable.label;
}

function completeInteraction(interactable) {
  if (!interactable || interactable.completed) return;
  interactable.completed = true;
  interactable.root.setEnabled(false);
  collected = [...new Set([...collected, interactable.id])];
  setObjective(interactable.nextStage);
  showToast(interactable.title, 2800);
  saveGame(false);
}

function getLocationName(position) {
  if (position.z < -48) return "Embarcador de sa costa";
  if (position.x > 28 && position.z < 5) return "Olivar de llevant";
  if (position.x < -24 && position.z < 14) return "Vila marinera";
  if (position.z > 30) return "Camí de sa costa";
  return "Pla de Mallorca";
}

function snapshot() {
  return {
    ...player.getSnapshot(),
    objectiveStage,
    collected,
    settings: { quality: world.qualityId },
  };
}

function saveGame(announce = true) {
  try {
    saveStore.save(snapshot());
    if (announce) showToast("Partida guardada · Golden Slice 0.19.0");
  } catch (error) {
    console.error(error);
    showToast("No se ha podido guardar la partida");
  }
}

function restoreGame(save) {
  if (!save) {
    setObjective(0);
    return;
  }
  player.applySave(save);
  objectiveStage = save.objectiveStage;
  collected = save.collected;
  setObjective(objectiveStage);
  setCompletedState();
  showToast("Guardado de la golden slice recuperado");
}

async function start() {
  try {
    world = await buildScene(ui.canvas, setProgress);
    input = new InputController({
      canvas: ui.canvas,
      joystick: ui.joystick,
      joystickKnob: ui.joystickKnob,
      runButton: ui.runButton,
      actionButton: ui.actionButton,
    });
    player = new PlayerController(world, input);

    ui.qualityBadge.textContent = world.quality.label;
    const save = saveStore.load();
    restoreGame(save);

    ui.saveButton.addEventListener("click", () => saveGame(true));
    window.addEventListener("resize", () => world.engine.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveGame(false);
    });
    window.addEventListener("beforeunload", () => saveGame(false));

    let previousTime = performance.now();
    world.engine.runRenderLoop(() => {
      const now = performance.now();
      const delta = Math.min(0.05, (now - previousTime) / 1000);
      previousTime = now;

      travelledDistance += player.update(delta);
      autosaveTimer += delta;
      updateInteractionUi();

      if (input.consumeAction() && nearestInteractable) completeInteraction(nearestInteractable);
      if (input.consumeSave()) saveGame(true);
      if (autosaveTimer >= 45) {
        autosaveTimer = 0;
        saveGame(false);
      }

      const position = player.getPosition();
      ui.locationName.textContent = getLocationName(position);
      ui.distanceText.textContent = `${Math.round(travelledDistance)} m`;

      for (const interactable of world.interactables) {
        if (!interactable.completed && interactable.root.isEnabled()) {
          interactable.glow.rotation.z += delta * 0.42;
          interactable.mesh.rotation.y += delta * 0.28;
          interactable.glow.scaling.setAll(1 + Math.sin(now * 0.003) * 0.05);
        }
      }

      world.scene.render();
    });

    setTimeout(() => ui.loadingScreen.classList.add("hidden"), 280);
    console.info(`[WAFT] ${BUILD.label} ${BUILD.version} · ${REGION.name}`);
  } catch (error) {
    console.error(error);
    setProgress(1, "Error al iniciar la golden slice");
    ui.objectiveText.textContent = "No se ha podido iniciar la escena 3D.";
    showToast(error instanceof Error ? error.message : "Error desconocido", 5000);
  }
}

start();
