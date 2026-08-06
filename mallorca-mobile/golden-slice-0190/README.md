# WAFT Adventure — Golden Slice 0.19.0

Primera build jugable aislada de la nueva línea visual de WAFT Adventure.

## Alcance

- Región piloto: Llevant de Mallorca.
- Escena Babylon.js 3D real, no imagen conceptual.
- Cámara en tercera persona y macaco de Berbería procedural provisional.
- Controles de teclado, ratón y móvil.
- Recorrido compacto con costa, relieve, camino, olivar, arquitectura y embarcadero.
- Tres puntos de interacción que prueban una secuencia data-driven.
- Guardado persistente propio y versionado.
- Selección automática de calidad para móvil/escritorio.
- Reutilización de geometría mediante instancias para caminos, muros, edificios y vegetación.

## Controles

- `W`, `A`, `D` y mantener `S`, o flechas: movimiento.
- Ratón o arrastre táctil: cámara.
- `Shift` o botón **Correr**: carrera.
- `E` o botón **Acción**: interacción.
- Toque breve de `S`, `Ctrl/Cmd + S` o botón **Guardar**: guardado.

> Nota: el macaco, edificios y vegetación son geometría procedural de laboratorio. No representan todavía los assets finales.

## Aislamiento y compatibilidad

- No modifica `mallorca-mobile/waft-0170.html`.
- No utiliza ni sobrescribe guardados de `0.17.0`.
- Clave de guardado: `waft.adventure.goldenSlice.0.19.0`.
- La build se aloja en `mallorca-mobile/golden-slice-0190/`.

## Archivos

- `index.html`: shell jugable e interfaz.
- `styles.css`: HUD responsive y controles táctiles.
- `js/config.js`: configuración de build, región, objetivos e interacciones.
- `js/save-store.js`: schema y persistencia aislada.
- `js/input-controller.js`: teclado, ratón y táctil.
- `js/scene-builder.js`: terreno, assets procedurales, iluminación e instancing.
- `js/player-controller.js`: locomoción, cámara y animación provisional.
- `js/main.js`: orquestación, objetivos, interacción y autosave.

## Criterio de validación

Esta build valida el nivel 2 del proyecto: un laboratorio/golden slice funcional. No debe confundirse con una referencia conceptual ni con el juego completo.
