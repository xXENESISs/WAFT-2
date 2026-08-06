import { shapeStick } from "./movement-math.js";

export class Input {
  constructor({ canvas, moveZone, joystickBase, joystickKnob, runButton, actionButton }) {
    this.canvas = canvas;
    this.moveZone = moveZone;
    this.joystickBase = joystickBase;
    this.joystickKnob = joystickKnob;
    this.runButton = runButton;
    this.actionButton = actionButton;

    this.keys = new Set();
    this.stick = { x: 0, y: 0, magnitude: 0, axis: "none" };
    this.cameraDelta = { x: 0, y: 0 };
    this.actionQueued = false;
    this.saveQueued = false;
    this.runningTouch = false;
    this.movePointer = null;
    this.cameraPointer = null;
    this.moveOrigin = { x: 0, y: 0 };
    this.lastCameraPoint = null;
    this.abort = new AbortController();

    this.bind();
  }

  bind() {
    const { signal } = this.abort;

    window.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.code === "KeyS") {
        event.preventDefault();
        this.saveQueued = true;
        return;
      }
      this.keys.add(event.code);
      if (event.code === "KeyE" && !event.repeat) this.actionQueued = true;
    }, { signal });

    window.addEventListener("keyup", (event) => this.keys.delete(event.code), { signal });
    window.addEventListener("blur", () => this.reset(), { signal });

    this.moveZone.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.movePointer = event.pointerId;
      this.moveOrigin = { x: event.clientX, y: event.clientY };
      this.joystickBase.hidden = false;
      this.joystickBase.style.left = `${event.clientX}px`;
      this.joystickBase.style.top = `${event.clientY}px`;
      this.moveZone.setPointerCapture(event.pointerId);
      this.updateStick(event);
    }, { signal });

    this.moveZone.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.movePointer) this.updateStick(event);
    }, { signal });

    const releaseMove = (event) => {
      if (event.pointerId !== this.movePointer) return;
      this.movePointer = null;
      this.stick = { x: 0, y: 0, magnitude: 0, axis: "none" };
      this.joystickKnob.style.transform = "translate(0px, 0px)";
      this.joystickBase.hidden = true;
    };

    this.moveZone.addEventListener("pointerup", releaseMove, { signal });
    this.moveZone.addEventListener("pointercancel", releaseMove, { signal });

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" && event.clientX < innerWidth * 0.43) return;
      this.cameraPointer = event.pointerId;
      this.lastCameraPoint = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    }, { signal });

    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.cameraPointer || !this.lastCameraPoint) return;
      this.cameraDelta.x += event.clientX - this.lastCameraPoint.x;
      this.cameraDelta.y += event.clientY - this.lastCameraPoint.y;
      this.lastCameraPoint = { x: event.clientX, y: event.clientY };
    }, { signal });

    const releaseCamera = (event) => {
      if (event.pointerId !== this.cameraPointer) return;
      this.cameraPointer = null;
      this.lastCameraPoint = null;
    };

    this.canvas.addEventListener("pointerup", releaseCamera, { signal });
    this.canvas.addEventListener("pointercancel", releaseCamera, { signal });

    const setRun = (active) => {
      this.runningTouch = active;
      this.runButton.classList.toggle("active", active);
    };

    this.runButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.runButton.setPointerCapture(event.pointerId);
      setRun(true);
    }, { signal });
    this.runButton.addEventListener("pointerup", () => setRun(false), { signal });
    this.runButton.addEventListener("pointercancel", () => setRun(false), { signal });

    this.actionButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.actionQueued = true;
      this.actionButton.classList.add("active");
    }, { signal });
    this.actionButton.addEventListener("pointerup", () => this.actionButton.classList.remove("active"), { signal });
    this.actionButton.addEventListener("pointercancel", () => this.actionButton.classList.remove("active"), { signal });
  }

  updateStick(event) {
    const radius = 48;
    let dx = event.clientX - this.moveOrigin.x;
    let dy = event.clientY - this.moveOrigin.y;
    const length = Math.hypot(dx, dy);

    if (length > radius) {
      dx = (dx / length) * radius;
      dy = (dy / length) * radius;
    }

    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.stick = shapeStick(dx / radius, -dy / radius);
  }

  movement() {
    const x = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0)
      - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
    const y = (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0)
      - (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);

    if (x || y) return shapeStick(x, y, { deadzone: 0 });
    return this.stick;
  }

  running() {
    return this.runningTouch || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  consumeCamera() {
    const delta = { ...this.cameraDelta };
    this.cameraDelta.x = 0;
    this.cameraDelta.y = 0;
    return delta;
  }

  consumeAction() {
    const value = this.actionQueued;
    this.actionQueued = false;
    return value;
  }

  consumeSave() {
    const value = this.saveQueued;
    this.saveQueued = false;
    return value;
  }

  reset() {
    this.keys.clear();
    this.stick = { x: 0, y: 0, magnitude: 0, axis: "none" };
    this.runningTouch = false;
    this.movePointer = null;
    this.cameraPointer = null;
    this.joystickBase.hidden = true;
  }

  dispose() {
    this.abort.abort();
  }
}
