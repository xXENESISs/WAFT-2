# WAFT Adventure 0.18.0 — Especificación técnica del sistema visual global

**Estado:** contrato de implementación v1  
**Documento superior:** `WAFT-ADVENTURE-VISUAL-BIBLE-v1.md`  
**Versión objetivo:** 0.18.x  
**Compatibilidad mínima:** mundo, rutas y partidas de WAFT 0.17.0  

---

## 0. Decisión de producto

WAFT 0.18.x no amplía el mapa ni introduce la campaña. Construye el **motor artístico reutilizable** que deberá vestir cualquier región futura sin código especial por país o ciudad.

La 0.17.0 permanece como prueba funcional de geografía, viaje, zonas locales y persistencia. Sus primitivas visuales no se consideran assets definitivos.

La implementación se aprobará únicamente cuando:

1. el macaco deje de estar construido visualmente mediante primitivas separadas;
2. Barcelona, Montseny, Llevant y Alcúdia presenten identidades inequívocas;
3. una quinta zona se genere con las mismas reglas sin una rama específica en código;
4. el sistema conserve 30 FPS estables en el perfil móvil objetivo;
5. el generador pueda explicar por qué seleccionó cada material, edificio y vegetación;
6. la 0.17.0 siga siendo restaurable y las partidas existentes no se invaliden.

---

# 1. Alcance

## 1.1 Incluido

- Contratos JSON para perfiles visuales, recetas de zona y catálogo de assets.
- Generador determinista de recetas visuales.
- Materiales de terreno combinados por reglas.
- Kits modulares de arquitectura regional.
- Vegetación instanciada con distribución ecológica y urbana.
- Agua, costa, caminos y atmósfera renovados.
- Nuevo macaco de Berbería con malla, rig, materiales, animaciones y LOD.
- Streaming y niveles de detalle independientes del gameplay.
- Herramientas de diagnóstico visual y validación automática.
- Pilotos: Barcelona, Montseny, Llevant y Alcúdia.
- Quinta zona de transferencia sin personalización específica.

## 1.2 Fuera de alcance

- Interiores transitables generales.
- Ciclo completo día/noche.
- Clima dinámico mundial.
- Historia, misiones y NPC finales.
- Combate Adventure integrado.
- Modelado exacto de cada edificio real.
- Ray tracing, pelo por hebras o materiales de escritorio incompatibles con móvil.

---

# 2. Arquitectura general

```text
Datos geográficos y OSM
        ↓
Clasificador físico
(costa, pendiente, altitud, agua, uso de suelo)
        ↓
Resolutor visual
(bioma + modificadores + cultura + asentamiento + distrito)
        ↓
Receta visual determinista
        ↓
Compiladores de capas
├── terreno y materiales
├── carreteras, plazas y costa
├── arquitectura
├── vegetación y props
├── iluminación y atmósfera
└── hitos y overrides
        ↓
Paquete visual streamable
        ↓
Runtime WebGL2
(LOD + instancing + culling + caché)
```

La lógica geográfica no debe contener modelos concretos. Produce etiquetas y medidas. El resolutor visual convierte esas etiquetas en una receta. Los compiladores convierten la receta en buffers, instancias y referencias a assets.

---

# 3. Contratos y archivos

## 3.1 Estructura objetivo

```text
docs/visual/
  WAFT-ADVENTURE-VISUAL-BIBLE-v1.md
  WAFT-0180-TECHNICAL-SPEC-v1.md

world-generator/
  schema/
    visual-system.schema.json
    visual-zone-recipe.schema.json        # fase 0.18.1
    visual-asset-manifest.schema.json      # fase 0.18.1
  configs/
    visual-system-v1.json
  scripts/
    validate-visual-system.mjs
    resolve-visual-recipe.mjs              # fase 0.18.1
    compile-visual-zone.mjs                # fase 0.18.2
  generated/
    visual-recipes/<region>/<zone>.json
    visual-packages/<region>/<zone>/

assets/
  visual/
    characters/barbary-macaque/
    architecture/<family>/
    vegetation/<family>/
    materials/<family>/
    props/<kit>/
    landmarks/<region>/

regions/<region-id>/
  visual/
    manifest.json
    zone-index.json
    packages/
```

## 3.2 `visual-system-v1.json`

Es el registro mundial autoral. Declara:

- estilo y versión;
- perfiles de calidad;
- biomas visuales;
- modificadores ambientales;
- familias culturales;
- familias arquitectónicas;
- materiales;
- vegetación;
- tipos de asentamiento y distritos;
- reglas de combinación;
- pilotos y criterios de aceptación.

No contiene posiciones de edificios individuales.

## 3.3 Receta de zona

La receta generada debe incluir como mínimo:

```json
{
  "regionId": "catalunya-litoral",
  "zoneId": "barcelona",
  "seed": 170018,
  "inputs": {
    "visualBiome": "mediterranean_coastal",
    "modifiers": ["urban_heat", "coastal_salt"],
    "culturalFamily": "iberian_east",
    "settlementType": "metropolis",
    "districtMix": {
      "urban_grid": 0.42,
      "historic_core": 0.18,
      "port": 0.16,
      "residential_dense": 0.16,
      "civic_center": 0.08
    }
  },
  "resolved": {
    "architectureFamilies": [],
    "terrainPalette": [],
    "vegetationFamilies": [],
    "propKits": [],
    "lightingProfile": "mediterranean-clear-day"
  },
  "explanation": []
}
```

`explanation` es obligatoria y debe registrar decisiones como: “se eligió cubierta plana por distrito urbano costero y familia ibérica oriental”. Esto permite depurar resultados sin adivinar qué regla falló.

## 3.4 Manifiesto de assets

Cada GLB, textura, atlas o conjunto procedural declarará:

- identificador estable;
- versión;
- familia;
- tags compatibles;
- escala real;
- LOD disponibles;
- triángulos por LOD;
- materiales y texturas;
- memoria estimada;
- collider;
- sombra;
- licencia y atribución;
- hash;
- estado: `placeholder`, `candidate`, `approved`, `deprecated`.

Solo assets `approved` podrán entrar en una build estable.

---

# 4. Resolución visual

## 4.1 Orden obligatorio

1. Medir geografía y uso del suelo.
2. Seleccionar bioma visual principal.
3. Añadir modificadores ambientales.
4. Seleccionar familia cultural.
5. Clasificar el asentamiento.
6. Dividir en distritos.
7. Resolver familias de arquitectura y vegetación.
8. Aplicar hitos y overrides.
9. Asignar semilla determinista.
10. Ajustar al perfil de calidad.
11. Emitir explicación y métricas.

## 4.2 Determinismo

La misma combinación de:

`visualSystemVersion + regionBuildId + zoneId + authorSeed + sourceHashes`

debe producir los mismos resultados y hashes.

No se utilizará `Math.random()` sin generador sembrado. Una regeneración no puede cambiar una ciudad completa por azar.

## 4.3 Reglas y prioridades

Las reglas se evalúan por prioridad y especificidad:

1. override humano explícito;
2. hito o distrito único;
3. familia cultural + adaptación climática;
4. tipo de asentamiento;
5. bioma y modificadores;
6. fallback mundial.

Si dos reglas incompatibles empatan, el compilador debe fallar; no elegirá una silenciosamente.

---

# 5. Terreno y superficies

## 5.1 Representación

El terreno mantiene el heightmap regional existente, pero añade:

- máscara de pendiente;
- máscara de curvatura;
- distancia a costa y agua;
- distancia a carreteras;
- uso de suelo;
- humedad aproximada;
- máscara urbana;
- máscara de roca;
- mezcla de hasta cuatro materiales por sector.

## 5.2 Shader móvil objetivo

- Un único shader de terreno por zona.
- Atlas o array de materiales comprimidos.
- Hasta cuatro capas mezcladas.
- Normal map opcional por perfil.
- Macrovariación para evitar repetición.
- Niebla integrada.
- Sin tessellation.
- Sin parallax mapping en móvil.

## 5.3 Reglas iniciales

- Pendiente > umbral del perfil: aumenta roca.
- Entorno de carretera: tierra compactada, grava o pavimento según clase.
- Distrito urbano: base continua de acera/piedra/asfalto.
- Costa: transición arena–grava–roca según tipo.
- Montaña húmeda: hojarasca, hierba, suelo oscuro y roca.
- Rural balear: tierra clara, hierba seca, piedra y parcelas.

## 5.4 Plataformas urbanas

Los edificios no deforman el relieve uno por uno. Se crean plataformas suaves por manzana o grupo, con bordes mezclados. La pendiente residual máxima bajo una masa urbana debe declararse por familia.

---

# 6. Arquitectura modular

## 6.1 Estrategia

Se separan cuatro niveles:

1. **footprint:** huella real o procedural;
2. **massing:** volumen, altura, retranqueos y cubierta;
3. **facade grammar:** ritmo de entradas, ventanas y balcones;
4. **detail kit:** cornisas, persianas, toldos, canalones y props.

Una huella real no obliga a copiar el edificio real. Se usa para preservar calle y densidad mientras la gramática regional produce una fachada coherente.

## 6.2 Primeras familias implementables

- `balearic_rural`
- `mediterranean_village`
- `iberian_urban_block`
- `catalan_mountain`
- `mediterranean_port`
- `modern_mediterranean_residential`

## 6.3 Módulos mínimos por familia

Cada familia aprobada necesita:

- 4 masas base;
- 3 variantes de cubierta;
- 2 esquinas;
- 3 entradas;
- 4 ritmos de ventana;
- 2 balcones o elementos equivalentes;
- 2 materiales principales;
- 3 variantes de color controladas;
- 2 estados de desgaste;
- LOD0, LOD1 y LOD2;
- collider footprint o compound;
- shadow proxy.

No hace falta modelar cada combinación como GLB independiente. El runtime puede ensamblar módulos e instanciarlos.

## 6.4 Reglas de calidad

- Bevel visible en aristas cercanas.
- Puerta identificable y a escala.
- Planta baja diferenciada cuando proceda.
- Cubierta con grosor y remate.
- Ventanas agrupadas mediante atlas; no líneas negras sin marco.
- Nada debe flotar, atravesar calles o bloquear completamente una ruta.
- La misma fachada exacta no puede repetirse más de tres veces consecutivas en una calle principal.

## 6.5 Hitos

Los hitos se cargan después del tejido urbano. El sistema reserva su entorno y reduce o elimina módulos incompatibles. Un hito único nunca se utilizará como parche para ocultar una ciudad genérica.

---

# 7. Vegetación y props

## 7.1 Distribución

Se generan campos de instancias por sector. Cada instancia almacena asset, transformación, variación cromática y LOD.

La colocación utiliza:

- bioma;
- altitud;
- humedad;
- pendiente;
- uso de suelo;
- distancia a carretera;
- distancia a edificio;
- patrón urbano, agrícola u orgánico.

## 7.2 Reglas iniciales

- Bosque: grupos con claros, bordes y sucesión de tamaños.
- Calle: alineación, separación regular y alcorques.
- Agricultura: hileras orientadas por parcela.
- Costa seca: baja densidad y especies resistentes.
- Montaña: densidad creciente hasta límite altitudinal y reducción en roca expuesta.

## 7.3 Props

Los props se agrupan por kits. Un distrito declara presupuesto y probabilidades; nunca se colocan todos los tipos en todas las calles.

Kits 0.18.x:

- `mediterranean-street`
- `mediterranean-port`
- `balearic-rural`
- `catalan-mountain`
- `road-signage`
- `plaza-promenade`
- `agriculture`

---

# 8. Macaco protagonista

## 8.1 Pipeline

1. hoja de proporciones y siluetas;
2. malla LOD0 orgánica;
3. retopología y UV;
4. materiales de pelaje, piel, ojos y uñas;
5. rig compatible con locomoción y futura manipulación de objetos;
6. animaciones base;
7. LOD1 y LOD2;
8. colliders y cámara;
9. exportación GLB;
10. prueba móvil en Barcelona y Montseny.

## 8.2 Contrato del asset

- Unidad: metro.
- Eje vertical: Y.
- Frente: +Z en reposo.
- Origen: suelo bajo el centro corporal.
- LOD0: 14k–22k triángulos.
- LOD1: 7k–11k.
- LOD2: 2.5k–4.5k.
- 45–60 huesos.
- Un material principal y un segundo material opcional para ojos.
- Atlas máximo 2048 en perfil objetivo; 1024 en perfil bajo.
- Animaciones separables en clips.

## 8.3 Integración temporal

Mientras el GLB definitivo no exista, la 0.18.0 no deberá seguir refinando el mono de primitivas. Se permite un **proxy orgánico único** generado como malla continua para validar cámara, escala y locomoción. Debe etiquetarse `candidate`, nunca `approved`.

---

# 9. Runtime y rendimiento

## 9.1 Perfiles de calidad

### `mobile-low`

- objetivo: 30 FPS;
- resolución dinámica 0.65–0.85;
- sombras solo de personaje y masas principales;
- vegetación reducida;
- texturas 512–1024;
- distancia corta de LOD0.

### `mobile-target`

- objetivo: 30 FPS estable, aspiración 45–60;
- resolución dinámica 0.8–1.0;
- sombras direccionales limitadas;
- texturas 1024, 2048 solo héroe o hito;
- vegetación completa con instancing;
- niebla y agua simplificada.

### `desktop-capture`

- 60 FPS objetivo;
- mayor distancia de detalle;
- sombras y normales de mayor calidad;
- no introduce geometría exclusiva que cambie la composición jugable.

## 9.2 Presupuesto por zona local activa — `mobile-target`

- Pico de triángulos visibles: 550k recomendado, 750k máximo duro.
- Draw calls: 180 recomendado, 260 máximo duro.
- Instancias visibles: 4.000 recomendado, 7.500 máximo.
- Texturas residentes de la zona: 96 MB recomendado, 128 MB máximo.
- Geometría residente: 48 MB recomendado, 72 MB máximo.
- Paquete inicial descargable: 35 MB recomendado, 55 MB máximo.
- Tiempo hasta primera imagen útil en red móvil simulada: < 8 s.
- Memoria JS + WASM + buffers propios: registrar y comparar, sin crecimiento continuo al cambiar de zona.

El compilador debe fallar al superar máximos duros.

## 9.3 LOD y culling

- Frustum culling por sector.
- Occlusion heurística por manzanas, sin lectura de GPU obligatoria.
- LOD por tamaño proyectado, no solo distancia.
- Histeresis para evitar parpadeo.
- Impostores para masas vegetales lejanas.
- HLOD opcional para manzanas urbanas.
- Colliders simplificados y desacoplados de la malla renderizada.

## 9.4 Streaming

Al entrar en una zona:

1. terreno y navegación;
2. masas arquitectónicas LOD bajo;
3. personaje y entorno próximo;
4. materiales de calidad;
5. detalles, vegetación y props;
6. hitos lejanos.

El jugador no debe esperar a que se descargue toda la ciudad.

---

# 10. Migración desde WAFT 0.17.0

## 10.1 Regla de compatibilidad

El estado guardado conserva:

- región;
- zona;
- posición;
- rutas;
- conexiones;
- progreso de viaje.

La presentación visual no se serializa como fuente de verdad. Al abrir una partida antigua, la posición se proyecta sobre la nueva superficie y se busca un punto seguro si queda dentro de un edificio o pendiente inválida.

## 10.2 Despliegue progresivo

- 0.18.0: contratos, clasificador, receta, proxy de render y diagnóstico.
- 0.18.1: terreno/materiales y primer kit arquitectónico en Barcelona.
- 0.18.2: macaco candidato, vegetación y Montseny.
- 0.18.3: Llevant y Alcúdia; puertos, rural y murallas.
- 0.18.4: quinta zona transferida y optimización.
- 0.18.5: sustitución de proxies candidatos por assets aprobados y build pública de referencia.

La numeración puede agruparse, pero no se aprobará la fase sin cumplir todos los gates.

## 10.3 Fallback

Cada paquete visual declara `fallbackRuntime`. Si falla la carga del paquete nuevo, el mundo puede abrir con el runtime 0.17.0 y registrar el error. El fallback es seguridad, no una excusa para publicar paquetes rotos.

---

# 11. Pilotos y criterios de aprobación

## 11.1 Barcelona

Debe demostrar:

- calles y manzanas legibles;
- mezcla de ensanche, casco, puerto y residencial;
- alturas variadas pero controladas;
- planta baja, ventanas, balcones y cubiertas reconocibles;
- espacio urbano transitable;
- ausencia de repetición evidente en el primer minuto.

## 11.2 Montseny

Debe demostrar:

- profundidad atmosférica;
- bosque con siluetas reales;
- roca y suelo húmedo en pendientes;
- edificios adaptados al terreno;
- caminos comprensibles;
- cero grandes masas verdes homogéneas.

## 11.3 Llevant

Debe demostrar:

- transición costa–pueblo–rural;
- paseo o borde costero;
- arquitectura balear y turística sin mezcla caótica;
- pino, matorral, parcelas y piedra seca;
- localidades pequeñas visitables.

## 11.4 Alcúdia

Debe demostrar:

- núcleo histórico compacto;
- muralla o borde reconocible;
- puerta y jerarquía de acceso;
- relación con puerto y tejido moderno;
- escala peatonal legible.

## 11.5 Quinta zona

Se elegirá entre Tarragona, Girona, Eivissa o Maresme. No podrá introducir:

- condiciones por `zoneId` en el render;
- modelos exclusivos obligatorios salvo hitos;
- nuevas familias para resolver un fallo que debió cubrir una familia existente.

Su función es validar transferencia, no competir en cantidad de contenido.

---

# 12. Validación

## 12.1 Validación estructural

- JSON conforme al schema.
- IDs únicos.
- referencias existentes;
- estados y versiones válidos;
- presupuestos completos;
- pilotos con combinaciones resolubles.

## 12.2 Validación semántica

- Toda familia implementada tiene LOD y collider.
- Todo bioma implementado tiene terreno, vegetación, cielo y fallback.
- Todo distrito puede resolver al menos una arquitectura.
- Ninguna regla referencia tags inexistentes.
- Los máximos duros son mayores o iguales que los recomendados.
- Una zona produce exactamente una receta para la misma semilla.

## 12.3 Pruebas visuales automáticas

Para cada piloto:

- captura desde tres posiciones fijas;
- captura con perfil bajo y objetivo;
- métricas de FPS, draw calls, triángulos y memoria;
- comparación de hash de receta;
- detección de assets ausentes;
- prueba de entrada, salida, guardado y restauración;
- registro de colisiones y punto seguro.

Las comparaciones de imagen detectarán regresiones grandes, pero la aprobación artística final seguirá siendo humana.

## 12.4 Gates de publicación

Una build pública 0.18.x necesita:

- validación estructural y semántica a cero errores;
- cuatro pilotos cargables;
- quinta zona transferida;
- macaco al menos `candidate` y sin primitivas visibles;
- cero errores de consola o red;
- guardado y viaje conservados;
- 30 FPS sostenidos en el benchmark móvil;
- revisión visual humana aprobada.

---

# 13. Primer backlog ejecutable

## Bloque A — Contratos

- Crear `visual-system.schema.json`.
- Crear `visual-system-v1.json`.
- Crear validador semántico.
- Añadir CI.

## Bloque B — Resolutor

- Implementar PRNG sembrado.
- Resolver tags y prioridades.
- Emitir recetas y explicación.
- Generar recetas de los cuatro pilotos.

## Bloque C — Render base

- Material de terreno multicapa.
- Nuevo sistema de masa arquitectónica.
- Instancing y LOD.
- Diagnóstico en pantalla con receta y presupuestos.

## Bloque D — Assets candidatos

- Kit `iberian_urban_block`.
- Kit `catalan_mountain`.
- Vegetación mediterránea y montaña.
- Proxy orgánico del macaco.

## Bloque E — Transferencia

- Llevant y Alcúdia.
- Quinta zona automática.
- Optimización y publicación.

---

# 14. Regla de cierre

La fase 0.18.x no se considerará terminada porque “se vea mejor que antes”. Se considerará terminada cuando exista un **sistema reproducible**, con contratos, assets versionados, reglas explicables, pilotos diferenciados y presupuestos verificables que pueda vestir una región nueva sin reconstruir el motor artístico.
