# WAFT planet renderer 0.27.0 (experimental)

This directory contains the planet-fixed foundation that will replace the player-centred terrain patch after it has passed visual and mobile validation.

## Runtime invariants

- A tile is identified only by `(face, level, x, y)`.
- Tile vertices are derived from fixed cube-face coordinates, never from player position, camera heading or elapsed time.
- All six faces use one cube-sphere hierarchy from ground level to orbit.
- GPU positions are planet-fixed ECEF values. Floating-origin changes update the tangent-frame uniforms, not tile topology.
- Missing child tiles render through an already-resident parent. A partial child set never leaves a hole.
- The public 0.26.1 renderer remains the default until the experimental renderer passes stability and mobile budgets.

Launch the experimental renderer with:

```text
mallorca-mobile/adventure-0210/index.html?region=iberia&renderer=0270
```

Run the deterministic geometry checks with:

```bash
node mallorca-mobile/adventure-0210/tools/verify-cube-sphere-0270.mjs
node mallorca-mobile/adventure-0210/verify-0270.mjs
```

## Deliberately deferred

- Topology-preserving coastline tile generation.
- Worker-based tile decoding and packed immutable tile files.
- Exact neighbour LOD balancing. The first vertical slice uses skirts plus parent fallback.
- Automated browser coast-mask comparison and physical Android profiling.
