# WAFT planet renderer 0.27.2 (experimental)

This directory contains the planet-fixed foundation that will replace the player-centred terrain patch after it has passed visual and mobile validation.

## Runtime invariants

- A tile is identified only by `(face, level, x, y)`.
- Tile vertices are derived from fixed cube-face coordinates, never from player position, camera heading or elapsed time.
- All six faces use one cube-sphere hierarchy from ground level to orbit.
- GPU positions are planet-fixed ECEF values. Floating-origin changes update the tangent-frame uniforms, not tile topology.
- The complete geographic quadtree is selected once from fixed content zones and uploaded before gameplay begins.
- The global base is level 3, Europe is permanently refined to level 4 and Iberia to level 6. These levels depend on geography, never on the player or camera.
- Flight performs no mesh builds, parent/child replacements or cache evictions. Movement only culls already-resident immutable leaves.
- A pinned Natural Earth 1:50m land mask defines coast topology; raster terrain supplies height and cover without deciding the shoreline.
- Orbital views use the same prebuilt geometry as ground flight, preserving the exact coastline and terrain silhouette.
- The high-altitude view remains a coherent third-person camera with a fixed near plane; no automatic Earth-centre target can rotate or clip the mounted bird.
- Experimental bearded-vulture forward, coast and dive speeds are exactly three times the 0.27.0 first-delivery values.
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

## Data provenance

`land-50m.bin` is a deterministic packed form of Natural Earth `ne_50m_land.geojson`, pinned to blob `c412c52b5286ba727dcb7047ecd6080bcbeb8298`. Natural Earth data is public domain; the exact source and checksums are recorded in `land-50m.meta.json`.

## Deliberately deferred

- Packed immutable tile files to move the one-time boot construction offline.
- Exact edge stitching between fixed refinement zones; the current immutable tree uses skirts at its permanent LOD boundaries.
- Physical Android profiling.
