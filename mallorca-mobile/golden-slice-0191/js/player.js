import { cameraRelativeDirection } from "./movement-math.js";

const B = window.BABYLON;

function angleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class Player {
  constructor(world, input) {
    this.world = world;
    this.input = input;
    this.root = world.player.root;
    this.visual = world.player.visual;
    this.camera = world.camera;

    this.cameraYaw = 0;
    this.cameraPitch = 0.34;
    this.cameraDistance = 7.2;
    this.speed = 0;
    this.walkSpeed = 4.25;
    this.runSpeed = 7.1;
    this.cycle = 0;
    this.target = this.root.position.add(new B.Vector3(0, 1.65, 0));

    this.wasMoving = false;
    this.movementBasisYaw = this.cameraYaw;

    this.updateCamera(1, true);
  }

  restore(save) {
    if (!save?.player) return;
    const position = this.world.resolvePosition(save.player.x, save.player.z);
    this.root.position.set(
      position.x,
      this.world.terrainHeight(position.x, position.z),
      position.z,
    );
    this.root.rotation.y = Number.isFinite(save.player.yaw) ? save.player.yaw : this.root.rotation.y;
    if (Number.isFinite(save.cameraYaw)) this.cameraYaw = save.cameraYaw;
    if (Number.isFinite(save.cameraPitch)) this.cameraPitch = save.cameraPitch;
    this.movementBasisYaw = this.cameraYaw;
    this.updateCamera(1, true);
  }

  update(dt) {
    const delta = Math.min(dt, 0.05);
    const cameraDelta = this.input.consumeCamera();

    // Touch camera uses direct screen motion: swipe right turns right, swipe up looks up.
    this.cameraYaw += cameraDelta.x * 0.0039;
    this.cameraPitch = B.Scalar.Clamp(this.cameraPitch - cameraDelta.y * 0.0028, 0.16, 0.61);

    const stick = this.input.movement();
    const moving = stick.magnitude > 0.001;

    if (moving && !this.wasMoving) this.movementBasisYaw = this.cameraYaw;
    if (!moving) this.movementBasisYaw = this.cameraYaw;

    const wantedSpeed = stick.magnitude * (this.input.running() ? this.runSpeed : this.walkSpeed);
    const acceleration = wantedSpeed > this.speed ? 11 : 16;
    this.speed = B.Scalar.Lerp(this.speed, wantedSpeed, Math.min(1, delta * acceleration));

    if (moving) {
      const direction = cameraRelativeDirection(stick.x, stick.y, this.movementBasisYaw);
      const distance = this.speed * delta;
      const resolved = this.world.resolvePosition(
        this.root.position.x + direction.x * distance,
        this.root.position.z + direction.z * distance,
      );

      this.root.position.x = resolved.x;
      this.root.position.z = resolved.z;

      const heading = Math.atan2(direction.x, direction.z);
      this.root.rotation.y += angleDelta(this.root.rotation.y, heading) * Math.min(1, delta * 13);
    }

    this.wasMoving = moving;

    const ground = this.world.terrainHeight(this.root.position.x, this.root.position.z);
    this.root.position.y = B.Scalar.Lerp(this.root.position.y, ground, Math.min(1, delta * 20));

    this.animate(delta, stick.magnitude);
    this.updateCamera(delta, false);
  }

  animate(delta, magnitude) {
    this.cycle += delta * (2.8 + this.speed * 1.05);
    const moving = Math.min(1, magnitude * 1.4);
    const swing = Math.sin(this.cycle) * moving;

    this.world.player.arms[0].rotation.x = swing * 0.7;
    this.world.player.arms[1].rotation.x = -swing * 0.7;
    this.world.player.legs[0].rotation.x = -swing * 0.48;
    this.world.player.legs[1].rotation.x = swing * 0.48;

    this.visual.position.y = Math.abs(Math.sin(this.cycle * 2)) * moving * 0.035;
    this.visual.rotation.x = -0.09 + Math.min(0.08, this.speed * 0.008);

    if (moving < 0.05) {
      this.visual.position.y = Math.sin(this.cycle * 0.35) * 0.012;
      this.world.player.arms[0].rotation.x *= 0.88;
      this.world.player.arms[1].rotation.x *= 0.88;
      this.world.player.legs[0].rotation.x *= 0.88;
      this.world.player.legs[1].rotation.x *= 0.88;
    }
  }

  updateCamera(delta, immediate) {
    const rawTarget = this.root.position.add(new B.Vector3(0, 1.72, 0));
    const blend = immediate ? 1 : Math.min(1, delta * 14);
    this.target = B.Vector3.Lerp(this.target, rawTarget, blend);

    const horizontal = Math.cos(this.cameraPitch) * this.cameraDistance;
    const desired = new B.Vector3(
      this.target.x + Math.sin(this.cameraYaw) * horizontal,
      this.target.y + Math.sin(this.cameraPitch) * this.cameraDistance + 0.5,
      this.target.z + Math.cos(this.cameraYaw) * horizontal,
    );
    desired.y = Math.max(desired.y, this.world.terrainHeight(desired.x, desired.z) + 0.85);

    this.camera.position.copyFrom(
      immediate
        ? desired
        : B.Vector3.Lerp(this.camera.position, desired, Math.min(1, delta * 10)),
    );
    this.camera.setTarget(this.target);
  }

  snapshot() {
    return {
      player: {
        x: this.root.position.x,
        z: this.root.position.z,
        yaw: this.root.rotation.y,
      },
      cameraYaw: this.cameraYaw,
      cameraPitch: this.cameraPitch,
    };
  }
}
