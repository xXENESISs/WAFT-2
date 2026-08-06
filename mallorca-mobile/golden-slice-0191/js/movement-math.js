export function shapeStick(x, y, options = {}) {
  const deadzone = options.deadzone ?? 0.16;
  const axisSnapRatio = options.axisSnapRatio ?? 0.58;
  const rawMagnitude = Math.hypot(x, y);

  if (!Number.isFinite(rawMagnitude) || rawMagnitude <= deadzone) {
    return { x: 0, y: 0, magnitude: 0, axis: "none" };
  }

  const clampedMagnitude = Math.min(1, rawMagnitude);
  const magnitude = Math.min(1, (clampedMagnitude - deadzone) / (1 - deadzone));
  let nx = x / rawMagnitude;
  let ny = y / rawMagnitude;
  let axis = "free";

  if (Math.abs(nx) <= Math.abs(ny) * axisSnapRatio) {
    nx = 0;
    ny = Math.sign(ny);
    axis = "vertical";
  } else if (Math.abs(ny) <= Math.abs(nx) * axisSnapRatio) {
    nx = Math.sign(nx);
    ny = 0;
    axis = "horizontal";
  }

  return {
    x: nx * magnitude,
    y: ny * magnitude,
    magnitude,
    axis,
  };
}

export function cameraRelativeDirection(lateral, forward, cameraYaw) {
  const forwardX = -Math.sin(cameraYaw);
  const forwardZ = -Math.cos(cameraYaw);

  // Babylon.js uses a left-handed world by default.
  const rightX = -Math.cos(cameraYaw);
  const rightZ = Math.sin(cameraYaw);

  const x = rightX * lateral + forwardX * forward;
  const z = rightZ * lateral + forwardZ * forward;
  const length = Math.hypot(x, z);

  if (length < 1e-6) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}
