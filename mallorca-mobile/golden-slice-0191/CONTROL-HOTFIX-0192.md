# WAFT Adventure control hotfix 0.19.2

This patch fixes the mobile locomotion foundation without changing the visual scene.

- Corrects the camera-right vector for Babylon.js's default left-handed coordinate system.
- Replaces per-axis deadzones with a radial deadzone.
- Snaps small thumb drift to cardinal axes.
- Locks the movement camera basis for each continuous gesture so forward input remains straight.
- Adds regression tests for left/right direction and zero lateral drift.

The visual direction of 0.19.1 is not approved and will be replaced by an asset-based scene rather than extended with more procedural primitives.
