# WAFT Adventure 0.23.0 — mundo jugable integrado

Esta entrada mantiene los dos runtimes regionales precisos como mundo principal:

- `region-runtime-baleares-013.html`
- `region-runtime-catalunya-litoral-003.html`

Adventure se aplica encima sin reconstruir el terreno, las carreteras, las poblaciones ni los paquetes locales.

## Jugabilidad heredada del mundo 1

- Pingüino provisional como protagonista hasta sustituirlo por el GLB del macaco.
- Movimiento en tercera persona, joystick/WASD, cámara, carrera automática, natación y salto cargado.
- Misión de Aina: lagartija → gineta → Myotragus.
- Observación y archivo de fauna.
- Cabra terrestre, tintorera acuática y buitre aéreo con aleteo cargado.
- Ruta A/B/C con marcar, volver, borrar y visualización sobre el terreno.
- Guardado Adventure automático/manual conectado al progreso regional.

## Pasada de jugabilidad 0.23

- HUD geográfico permanente con latitud, longitud, altitud real aproximada en metros sobre el nivel del mar y rumbo de brújula.
- Navegación al puerto: nombre, flecha relativa, distancia y dirección real hacia el otro territorio.
- Port d'Alcúdia y Port de Barcelona mantienen el traslado rápido cuando el jugador llega físicamente al puerto.
- Cruce alternativo por mar: el jugador puede abandonar la región nadando por mar abierto en la dirección geográfica correcta y continuar la travesía en el runtime regional opuesto.
- Baleares y Catalunya usan sus proyecciones reales (x = este, z = sur); la conversión geográfica de Baleares compensa además su compresión por islas.
- Interfaz reorganizada para que salto, carrera, respawn, acciones, ruta, guardado y destinos no se monten unos sobre otros; en móvil horizontal `DESTINOS` pasa a `MAPA`.
- Los botones de presets geográficos dejan de ocupar permanentemente la parte inferior y se abren bajo demanda.
- Fauna activa ampliada de forma determinista y con límites diferentes para móvil/escritorio.
- Nuevo renderizador por especie con siluetas y anatomía diferenciadas para lagartijas, ginetas, Myotragus, cabras, vacas, cerdos, conejos, comadrejas, salamandras, currucas, buitres y tintoreras.
- LOD/culling de fauna para poder aumentar densidad sin dibujar todos los detalles de todos los animales a cualquier distancia.

## Mundo 2 conservado

- Terreno/relieve regional preciso.
- Baleares + Catalunya litoral/Barcelona.
- Poblaciones, edificios, carreteras y colisiones.
- Streaming por celdas y zonas locales detalladas.
- Presets geográficos y progreso regional persistente.
- Pendientes y adaptación al terreno.

## Pendiente visual deliberado

Los animales 0.23 ya no comparten la silueta genérica anterior, pero siguen siendo geometría procedural del prototipo. La sustitución por mallas/GLB definitivas continúa siendo una fase posterior. Los edificios tampoco se rehacen en esta pasada: su sustitución por mejores mallas, materiales y arquitectura se mantiene separada para no mezclarla con navegación y jugabilidad.

## Validación

CI compila el loader, el módulo Adventure, la capa 0.23 y el plugin final ya parcheado; después smoke-testea el HTML generado contra los runtimes exactos de Baleares y Catalunya litoral.
