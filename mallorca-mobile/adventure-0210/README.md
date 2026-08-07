# WAFT Adventure 0.22.0 — mundo jugable integrado

Esta entrada no genera otro mapa. El mundo principal utiliza directamente los runtimes regionales precisos existentes:

- `region-runtime-baleares-013.html`
- `region-runtime-catalunya-litoral-003.html`

Adventure se aplica encima sin reconstruir el terreno, las carreteras, las poblaciones ni los paquetes locales.

## Jugabilidad trasladada del mundo 1 (0.15)

- Pingüino visible provisional.
- Movimiento en tercera persona, joystick, WASD, cámara directa y carrera automática.
- Natación y salto cargado.
- Misión completa de Aina: lagartija → gineta → Myotragus.
- Observación y archivo de fauna.
- Fauna del mundo 1: lagartijas/sargantanas, ginetas, Myotragus, cabras, vacas, conejos, comadrejas, salamandras, buitres y tintoreras.
- Fauna adicional de la integración: porc negre/jabalí y currucas.
- Cabra como montura terrestre.
- Tintorera como montura acuática.
- Buitre como montura aérea: ciclos de vuelo/aterrizaje, ventana de monta y aleteo cargado para ganar altura.
- Ruta de expedición A/B/C: marcar, volver, borrar y visualización sobre el terreno al abrir el panel.
- Guardado Adventure automático/manual y conservación del progreso regional.

## Sistemas del mundo 2 que sustituyen o mejoran equivalentes del mundo 1

- Terreno y relieve precisos en lugar del mapa procedural antiguo.
- Baleares + Catalunya litoral/Barcelona en el mismo proyecto.
- Poblaciones, edificios, carreteras y colisiones precisas.
- Streaming por celdas.
- Entrada física en zonas locales detalladas.
- Presets geográficos y progreso regional persistente.
- Pendientes y adaptación al terreno.
- El antiguo viaje rápido marítimo entre islas se sustituye por el sistema regional y la transición física por puertos Baleares ↔ Barcelona.

## Próximo cambio de protagonista

El futuro GLB del macaco sustituirá únicamente al renderizador/control visual del pingüino. El mapa, controles, misión, fauna, monturas, guardado y transiciones regionales permanecerán intactos.

## Validación

CI reconstruye la referencia original de WAFT 0.15, comprueba las familias de fauna y mecánicas transferidas y compila el runtime final ya parcheado para Baleares y Catalunya litoral.
