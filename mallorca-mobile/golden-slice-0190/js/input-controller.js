const KEY_BINDINGS = Object.freeze({
  forward: ["KeyW", "ArrowUp"],
  backward: ["ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"],
});

export class InputController {
  constructor({ canvas, joystick, joystickKnob, runButton, actionButton }) {
    this.canvas = canvas;
    this.joystick = joystick;
    this.joystickKnob = joystickKnob;
    this.runButton = runButton;
    this.actionButton = actionButton;

    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.touchRun = false;
    this.actionQueued = false;
    this.saveQueued = false;
    this.cameraDelta = { x: 0, y: 0 };
    this.joystickPointerId = null;
    this.cameraPointerId = null;
    this.sPressedAt = null;
    this.sHoldThresholdMs = 190;
    this.lastCameraPoint = null;

    this.abortController = new AbortController();
    this.bindEvents();
  }

  bindEvents() {
    const { signal } = this.abortController;

    window.addEventListener("keydown", (event) => {
      if (event.code === "KeyS") {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          this.saveQueued = true;
          return;
        }
        if (this.sPressedAt === null) this.sPressedAt = performance.now();
        return;
      }
      if (event.repeat && event.code === "KeyE") return;
      this.keys.add(event.code);
      if (event.code === "KeyE") this.actionQueued = true;
    }, { signal });

    window.addEventListener("keyup", (event) => {
      if (event.code === "KeyS") {
        const heldFor = this.sPressedAt === null ? Infinity : performance.now() - this.sPressedAt;
        const otherMovementHeld = ["KeyW", "KeyA", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]
          .some((code) => this.keys.has(code));
        if (heldFor < this.sHoldThresholdMs && !otherMovementHeld) this.saveQueued = true;
        this.sPressedAt = null;
        return;
      }
      this.keys.delete(event.code);
    }, { signal });
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.touchMove = { x: 0, y: 0 };
      this.touchRun = false;
      this.sPressedAt = null;
      this.resetJoystick();
    }, { signal });

    this.joystick?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      this.joystick.setPointerCapture(event.pointerId);
      this.updateJoystick(event);
    }, { signal });
    this.joystick?.addEventListener("pointermove", (event) => {
      if (event.pointerId === this.joystickPointerId) this.updateJoystick(event);
    }, { signal });
    const releaseJoystick = (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.touchMove = { x: 0, y: 0 };
      this.resetJoystick();
    };
    this.joystick?.addEventListener("pointerup", releaseJoystick, { signal });
    this.joystick?.addEventListener("pointercancel", releaseJoystick, { signal });

    const setRun = (active) => {
      this.touchRun = active;
      this.runButton?.classList.toggle("active", active);
    };
    this.runButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.runButton.setPointerCapture(event.pointerId);
      setRun(true);
    }, { signal });
    this.runButton?.addEventListener("pointerup", () => setRun(false), { signal });
    this.runButton?.addEventListener("pointercancel", () => setRun(false), { signal });

    this.actionButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.actionQueued = true;
      this.actionButton.classList.add("active");
    }, { signal });
    this.actionButton?.addEventListener("pointerup", () => this.actionButton.classList.remove("active"), { signal });
    this.actionButton?.addEventListener("pointercancel", () => this.actionButton.classList.remove("active"), { signal });

    this.canvas.addEventListener("pointerdown", (event) => {
      if (event.target !== this.canvas || this.joystickPointerId !== null) return;
      this.cameraPointerId = event.pointerId;
      this.lastCameraPoint = { x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture(event.pointerId);
    }, { signal });
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.cameraPointerId || !this.lastCameraPoint) return;
      const dx = event.clientX - this.lastCameraPoint.x;
      const dy = event.clientY - this.lastCameraPoint.y;
      this.cameraDelta.x += dx;
      this.cameraDelta.y += dy;
      this.lastCameraPoint = { x: event.clientX, y: event.clientY };
    }, { signal });
    const releaseCamera = (event) => {
      if (event.pointerId !== this.cameraPointerId) return;
      this.cameraPointerId = null;
      this.lastCameraPoint = null;
    };
    this.canvas.addEventListener("pointerup", releaseCamera, { signal });
    this.canvas.addEventListener("pointercancel", releaseCamera, { signal });
  }

  updateJoystick(event) {
    const rect = this.joystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.34;
    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;
    const length = Math.hypot(dx, dy);
    if (length > maxRadius) {
      dx = (dx / length) * maxRadius;
      dy = (dy / length) * maxRadius;
    }
    this.touchMove.x = dx / maxRadius;
    this.touchMove.y = dy / maxRadius;
    this.joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  resetJoystick() {
    if (this.joystickKnob) this.joystickKnob.style.transform = "translate(0, 0)";
  }

  isPressed(action) {
    return KEY_BINDINGS[action]?.some((code) => this.keys.has(code)) ?? false;
  }

  getMovement() {
    let x = (this.isPressed("right") ? 1 : 0) - (this.isPressed("left") ? 1 : 0);
    const sHeldForMovement = this.sPressedAt !== null && performance.now() - this.sPressedAt >= this.sHoldThresholdMs;
    let y = ((this.isPressed("backward") || sHeldForMovement) ? 1 : 0) - (this.isPressed("forward") ? 1 : 0);
    if (Math.abs(this.touchMove.x) > Math.abs(x)) x = this.touchMove.x;
    if (Math.abs(this.touchMove.y) > Math.abs(y)) y = this.touchMove.y;
    const length = Math.hypot(x, y);
    if (length > 1) return { x: x / length, y: y / length };
    return { x, y };
  }

  isRunning() {
    return this.touchRun || this.isPressed("run");
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

  consumeCameraDelta() {
    const value = { ...this.cameraDelta };
    this.cameraDelta.x = 0;
    this.cameraDelta.y = 0;
    return value;
  }

  dispose() {
    this.abortController.abort();
  }
}
