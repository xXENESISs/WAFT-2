const B = window.BABYLON;

function shortestAngle(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export class PlayerController {
  constructor(world, input) {
    this.world = world;
    this.input = input;
    this.root = world.player.root;
    this.camera = world.camera;
    this.cameraYaw = 0.35;
    this.cameraPitch = 0.27;
    this.cameraDistance = 8.2;
    this.walkSpeed = 5.2;
    this.runSpeed = 8.4;
    this.animationTime = 0;
    this.currentSpeed = 0;
    this.lastPosition = this.root.position.clone();
    this.updateCamera(true);
  }

  applySave(save) {
    if (!save) return;
    this.root.position.x = save.player.x;
    this.root.position.z = save.player.z;
    this.root.position.y = this.world.terrainHeight(save.player.x, save.player.z);
    this.root.rotation.y = save.player.yaw;
    this.cameraYaw = save.camera.yaw;
    this.cameraPitch = save.camera.pitch;
    this.updateCamera(true);
  }

  update(deltaSeconds) {
    const delta = Math.min(deltaSeconds, 0.05);
    const cameraDelta = this.input.consumeCameraDelta();
    this.cameraYaw -= cameraDelta.x * 0.0044;
    this.cameraPitch = B.Scalar.Clamp(this.cameraPitch + cameraDelta.y * 0.0032, 0.08, 0.64);

    const movement = this.input.getMovement();
    const magnitude = Math.min(1, Math.hypot(movement.x, movement.y));
    const speed = this.input.isRunning() ? this.runSpeed : this.walkSpeed;
    this.currentSpeed = B.Scalar.Lerp(this.currentSpeed, magnitude * speed, Math.min(1, delta * 9));

    if (magnitude > 0.04) {
      const back = new B.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const right = new B.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
      const direction = right.scale(movement.x).add(back.scale(movement.y));
      direction.normalize();

      const nextX = B.Scalar.Clamp(this.root.position.x + direction.x * speed * magnitude * delta, this.world.bounds.minX, this.world.bounds.maxX);
      const nextZ = B.Scalar.Clamp(this.root.position.z + direction.z * speed * magnitude * delta, this.world.bounds.minZ, this.world.bounds.maxZ);
      const nextY = this.world.terrainHeight(nextX, nextZ);
      const maxClimb = 0.72;
      if (nextY - this.root.position.y < maxClimb) {
        this.root.position.x = nextX;
        this.root.position.z = nextZ;
      }

      const targetYaw = Math.atan2(direction.x, direction.z);
      this.root.rotation.y += shortestAngle(this.root.rotation.y, targetYaw) * Math.min(1, delta * 11);
    }

    const targetGround = this.world.terrainHeight(this.root.position.x, this.root.position.z);
    this.root.position.y = B.Scalar.Lerp(this.root.position.y, targetGround, Math.min(1, delta * 14));
    this.animate(delta, magnitude);
    this.updateCamera(false, delta);

    const travelled = B.Vector3.Distance(this.lastPosition, this.root.position);
    this.lastPosition.copyFrom(this.root.position);
    return travelled;
  }

  animate(delta, movementMagnitude) {
    this.animationTime += delta * (2.4 + this.currentSpeed * 0.72);
    const amplitude = Math.min(0.72, movementMagnitude * (this.input.isRunning() ? 0.72 : 0.48));
    const swing = Math.sin(this.animationTime) * amplitude;
    this.world.player.limbs.arms[0].rotation.x = swing;
    this.world.player.limbs.arms[1].rotation.x = -swing;
    this.world.player.limbs.legs[0].rotation.x = -swing * 0.82;
    this.world.player.limbs.legs[1].rotation.x = swing * 0.82;
    this.root.position.y += Math.abs(Math.sin(this.animationTime * 2)) * movementMagnitude * 0.035;

    this.world.player.tailSegments.forEach((segment, index) => {
      segment.rotation.z = Math.sin(this.animationTime * 0.45 + index * 0.42) * (0.08 + movementMagnitude * 0.05);
    });
  }

  updateCamera(immediate = false, delta = 1 / 60) {
    const target = this.root.position.add(new B.Vector3(0, 2.05, 0));
    const horizontalDistance = Math.cos(this.cameraPitch) * this.cameraDistance;
    const desired = new B.Vector3(
      target.x + Math.sin(this.cameraYaw) * horizontalDistance,
      target.y + Math.sin(this.cameraPitch) * this.cameraDistance + 0.7,
      target.z + Math.cos(this.cameraYaw) * horizontalDistance,
    );
    desired.y = Math.max(desired.y, this.world.terrainHeight(desired.x, desired.z) + 1.0);

    if (immediate) this.camera.position.copyFrom(desired);
    else this.camera.position.copyFrom(B.Vector3.Lerp(this.camera.position, desired, Math.min(1, delta * 11)));
    this.camera.setTarget(target);
  }

  getPosition() {
    return this.root.position;
  }

  getSnapshot() {
    return {
      player: {
        x: this.root.position.x,
        z: this.root.position.z,
        yaw: this.root.rotation.y,
      },
      camera: {
        yaw: this.cameraYaw,
        pitch: this.cameraPitch,
      },
    };
  }
}
