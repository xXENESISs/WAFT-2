# WAFT Adventure — Visual Bible v1

**Estado:** fuente de verdad artística inicial  
**Versión del documento:** 1.0  
**Fase de producto asociada:** WAFT Adventure 0.18.x — Global Visual Rework  
**Ámbito:** mundo abierto, personajes, arquitectura, biomas, iluminación, interfaz y técnica artística  

---

## 0. Propósito y autoridad

Este documento define el lenguaje visual que debe utilizar WAFT Adventure en cualquier parte del mundo. La versión 0.17.0 demuestra viaje regional, carga de zonas locales, persistencia y generación de asentamientos, pero sus gráficos son una base técnica provisional y no representan el aspecto final del juego.

A partir de esta Biblia, una nueva región no debe diseñarse como una excepción aislada. El sistema debe interpretar su geografía, clima, cultura, relieve, costa, vegetación y tipo de asentamiento, seleccionar las familias visuales apropiadas y construir una escena coherente mediante reglas reutilizables.

Cuando una implementación contradiga este documento, debe tratarse como deuda técnica o como una propuesta de modificación explícita de la Biblia, nunca como un cambio silencioso.

---

# 1. Visión visual

## 1.1 Objetivo

WAFT Adventure debe parecer un videojuego 3D con identidad propia, atractivo en móvil, legible en movimiento y capaz de representar todo el planeta sin necesitar un equipo que modele manualmente cada edificio.

La dirección elegida es:

## **Naturalismo estilizado**

Una estética que conserva anatomía, materiales, escala, clima y arquitectura reconocibles, pero simplifica los detalles que no aportan lectura, rendimiento o personalidad.

La proporción orientativa es:

- **65 % naturalismo:** especies reconocibles, materiales creíbles, terreno lógico, arquitectura regional, iluminación física comprensible.
- **35 % estilización:** formas limpias, siluetas reforzadas, paletas controladas, detalles agrupados, exageración moderada de elementos importantes.

## 1.2 Lo que WAFT sí debe ser

- Visualmente limpio y serio.
- Reconocible a primera vista en una pantalla pequeña.
- Rico en siluetas y variedad, no en ruido microscópico.
- Coherente entre regiones muy diferentes.
- Capaz de alternar naturaleza, pueblos y grandes ciudades.
- Modular, procedural y ampliable.
- Optimizado para móvil sin parecer una demo técnica.
- Suficientemente naturalista para que los animales sigan siendo animales.

## 1.3 Lo que WAFT no debe ser

- Hiperrealismo fotográfico aplicado al mundo abierto.
- Low poly basado en esferas, cilindros y prismas visibles como piezas separadas.
- Una estética infantil de juguete.
- Una ciudad formada por cajas repetidas con ventanas pintadas al azar.
- Un generador que utiliza el mismo edificio, árbol y suelo en todo el planeta.
- Un mapa geográfico correcto pero visualmente ilegible.
- Un sistema que obliga a rehacer manualmente cada región nueva.

## 1.4 Regla principal

> **La simplificación solo es válida cuando mejora la lectura o el rendimiento. Nunca debe revelar la primitiva geométrica utilizada para construir el objeto.**

Una pata puede tener pocos polígonos; no puede parecer un palo. Una cabeza puede estar estilizada; no puede parecer una esfera pegada al torso. Un edificio puede compartir módulos; no puede parecer una caja sin arquitectura.

---

# 2. Pilares artísticos

## 2.1 Silueta antes que detalle

Todo elemento importante debe poder reconocerse por su silueta:

- El macaco debe leerse como macaco de Berbería incluso en sombra.
- Un pino mediterráneo no debe confundirse con un abeto alpino.
- Una casa rural balear no debe parecer un bloque del Eixample.
- Una aldea de montaña no debe parecer una urbanización costera colocada sobre una pendiente.

## 2.2 Volúmenes continuos

Los personajes, edificios y props deben construirse como formas continuas y diseñadas. Se permiten módulos, pero las uniones deben integrarse mediante:

- transiciones de volumen;
- solapes naturales;
- bevels o chaflanes;
- cambios de material lógicos;
- sombras de contacto;
- proporciones coherentes.

## 2.3 Detalle agrupado

El detalle debe concentrarse en puntos de lectura:

- cara, manos, pies y hombros en animales;
- entrada, cubierta, balcones y esquina en edificios;
- tronco, copa y raíces visibles en árboles;
- cruces, bordes y plazas en calles.

El resto puede simplificarse. Se evita llenar superficies con líneas pequeñas que desaparecen o producen parpadeo en móvil.

## 2.4 Paleta controlada

Cada escena utiliza una paleta base de terreno, vegetación y arquitectura. La variedad se obtiene mediante matices limitados, suciedad, exposición, edad y materiales, no mediante colores aleatorios sin relación.

## 2.5 Identidad local dentro de un sistema global

La coherencia mundial no significa uniformidad. Todas las regiones comparten:

- iluminación compatible;
- escalas y materiales consistentes;
- tratamiento de bordes;
- calidad de modelado;
- reglas de lectura;
- niveles de detalle.

La identidad local procede de:

- clima;
- cultura arquitectónica;
- materiales disponibles;
- vegetación;
- relieve;
- distribución urbana;
- edad y función del asentamiento.

---

# 3. Jerarquía del generador visual

El generador artístico debe resolver una zona en este orden:

1. **Geografía física** — costa, altitud, pendiente, agua, orientación, suelo.
2. **Bioma visual base** — clima y ecosistema dominante.
3. **Modificadores ambientales** — humedad, nieve, aridez, viento, estacionalidad, volcanismo.
4. **Familia cultural** — lenguaje arquitectónico y materiales regionales.
5. **Tipo de asentamiento** — caserío, aldea, pueblo, ciudad, metrópolis, puerto, rural disperso.
6. **Distrito o función local** — casco histórico, ensanche, paseo marítimo, puerto, industrial, residencial, agrícola.
7. **Hitos y excepciones** — monumentos, murallas, castillos, estaciones, puentes, puertos específicos.
8. **Semilla de variación** — variaciones reproducibles sin destruir la identidad.
9. **Perfil de calidad** — móvil bajo, móvil objetivo, escritorio/captura.
10. **Receta final** — terreno, vegetación, edificios, props, iluminación, atmósfera y LOD.

La geografía nunca debe seleccionar directamente un único modelo. Debe producir una receta. Por ejemplo:

`mediterranean_coastal + iberian_east + town + seafront_tourism`

produce un resultado distinto de:

`mediterranean_coastal + iberian_east + historic_walled_town`

incluso si ambas zonas comparten clima.

---

# 4. Separación entre bioma de combate y bioma visual

Los biomas de combate de WAFT son categorías jugables y deben mantenerse compactos: arctic, desert, jungle, forest, marine y mountain.

El mundo abierto necesita una taxonomía visual más precisa. Ambos sistemas se relacionan mediante un mapeo, pero no son idénticos.

Ejemplo:

- `mediterranean_coastal` puede mapear a `marine`, `forest` o `mountain` según el punto de combate.
- `temperate_mountain_forest` puede mapear a `forest` o `mountain`.
- `hot_rock_desert` y `sandy_desert` pueden mapear ambos a `desert`, aunque visualmente sean muy distintos.

Esta separación evita introducir decenas de biomas en las reglas de combate y, al mismo tiempo, evita que todo el mundo abierto parezca una de seis plantillas.

---

# 5. Taxonomía visual mundial v1

## 5.1 Biomas base

La primera versión del sistema debe soportar estas familias:

1. `mediterranean_coastal`
2. `mediterranean_inland`
3. `temperate_forest`
4. `temperate_mountain`
5. `alpine_snow`
6. `hot_sandy_desert`
7. `hot_rock_desert`
8. `steppe_grassland`
9. `savanna`
10. `tropical_rainforest`
11. `tropical_dry_forest`
12. `wetland_river_delta`
13. `boreal_forest`
14. `tundra_polar`
15. `volcanic_island`
16. `marine_coast`

No todos deben implementarse en 0.18.0. La taxonomía establece el contrato global; los pilotos iniciales utilizan mediterráneo costero, mediterráneo interior y montaña templada.

## 5.2 Modificadores ambientales

Los modificadores se aplican sin multiplicar biomas completos:

- `humid`
- `dry`
- `wind_exposed`
- `snow_seasonal`
- `snow_permanent`
- `rocky`
- `sandy`
- `agricultural`
- `urban_heat`
- `coastal_salt`
- `river_influenced`
- `volcanic`

Ejemplo: Montseny puede utilizar `temperate_mountain + humid + rocky`; Llevant puede utilizar `mediterranean_coastal + dry + agricultural + coastal_salt`.

## 5.3 Salida visual mínima de un bioma

Cada perfil debe declarar:

- paleta del cielo y niebla;
- materiales de suelo;
- reglas de mezcla por pendiente y humedad;
- especies o arquetipos de vegetación;
- densidad vegetal;
- familias de roca;
- tratamiento del agua;
- partículas ambientales permitidas;
- rango de exposición y saturación;
- props naturales compatibles;
- variantes estacionales.

---

# 6. Sistema de terreno

## 6.1 Principio

El terreno debe explicar dónde está el jugador antes de leer el HUD. El color verde uniforme queda prohibido como solución universal.

## 6.2 Materiales globales base

El sistema parte de materiales reutilizables con variantes regionales:

- grass_short
- grass_wild
- dry_grass
- bare_soil
- compact_dirt
- mud
- sand_fine
- sand_coarse
- rock_light
- rock_dark
- gravel
- urban_stone
- asphalt
- snow_soft
- snow_compacted
- ice
- leaf_litter
- farmland_rows

## 6.3 Mezcla procedural

La mezcla depende de:

- pendiente;
- altitud;
- curvatura del terreno;
- cercanía al agua;
- humedad;
- uso de suelo;
- cercanía a carretera o edificio;
- exposición al viento;
- bioma;
- estación.

Reglas de ejemplo:

- pendientes fuertes revelan roca en lugar de estirar hierba;
- bordes de carretera reciben grava y tierra compactada;
- zonas urbanas generan base de pavimento continua;
- depresiones húmedas oscurecen el suelo y admiten vegetación de ribera;
- montaña boscosa combina hojarasca, roca y claros de hierba;
- costa mediterránea alterna tierra clara, roca calcárea y vegetación seca.

## 6.4 Geometría y lectura

- Las pendientes deben suavizarse cuando el mapa de altura produzca picos artificiales.
- Las plataformas urbanas deben adaptarse al terreno sin dejar edificios flotando ni enterrados.
- Los caminos deben cortar o abrazar la pendiente de forma comprensible.
- Los bordes del agua deben tener transición visual, no una línea dura entre verde y azul.

---

# 7. Vegetación

## 7.1 Gramática vegetal

La vegetación se selecciona por bioma, altitud, humedad y uso del suelo. Nunca se reparte de forma puramente aleatoria.

Capas:

1. árboles de dosel;
2. árboles secundarios;
3. arbustos;
4. matorral y hierba;
5. cultivos;
6. vegetación de ribera;
7. elementos muertos: troncos, ramas, hojas, roca pequeña.

## 7.2 Arquetipos iniciales 0.18.0

- pino mediterráneo;
- encina/roble mediterráneo;
- olivo;
- almendro;
- ciprés puntual;
- plátano urbano o árbol de calle genérico mediterráneo;
- arbusto seco;
- matorral húmedo de montaña;
- pino de montaña;
- árbol caducifolio templado;
- cultivo en hileras;
- vegetación de ribera.

## 7.3 Reglas visuales

- Las copas deben tener una silueta reconocible, no ser esferas verdes.
- Los troncos deben entrar en el terreno y proyectar sombra de contacto.
- La escala debe variar dentro de rangos creíbles.
- Las alineaciones agrícolas y urbanas siguen patrones; los bosques usan distribución orgánica.
- Los árboles cercanos al jugador utilizan volumen real; los lejanos pueden simplificarse mediante LOD o impostores.

---

# 8. Sistema arquitectónico global

## 8.1 Fórmula

`edificio = familia cultural + adaptación climática + función + escala del asentamiento + edad + estado + semilla`

Ejemplo:

`iberian_mediterranean + coastal + residential_mixed + city + 20th_century + maintained`

## 8.2 Componentes modulares

Cada familia arquitectónica debe proporcionar:

- huellas y masas base;
- plantas intermedias;
- coronaciones y cubiertas;
- esquinas;
- entradas;
- ventanas;
- balcones;
- contraventanas y persianas;
- cornisas;
- patios y anexos;
- escaleras exteriores;
- muros y vallas;
- props de cubierta;
- materiales y paletas;
- niveles de envejecimiento.

Los módulos se combinan, pero el edificio final debe leerse como una pieza continua.

## 8.3 Familias iniciales

### A. `balearic_rural`

- piedra local y revoco claro;
- teja terracota;
- una o dos plantas;
- volúmenes rectangulares conectados;
- patios, muros de piedra seca, porches y pequeños anexos;
- huecos contenidos y persianas.

### B. `mediterranean_village`

- una a tres plantas;
- fachadas estrechas;
- calles compactas;
- tejado inclinado o azotea según subregión;
- balcones pequeños;
- plazas y esquinas con más detalle.

### C. `iberian_urban_block`

- tres a siete plantas;
- planta baja diferenciada;
- balcones y ventanas en ritmo;
- esquinas más fuertes;
- patios interiores sugeridos;
- cubiertas, azoteas y maquinaria integradas.

### D. `catalan_mountain`

- piedra más oscura;
- madera controlada;
- cubiertas inclinadas;
- adaptación escalonada a la pendiente;
- muros de contención;
- menor altura y mayor peso visual.

### E. `mediterranean_port`

- almacenes, edificios marítimos, vivienda costera y comercio;
- muelles, defensas, rampas y paseo;
- espacios abiertos legibles;
- mezcla de cubiertas planas e inclinadas.

### F. `modern_mediterranean_residential`

- hoteles, apartamentos y urbanizaciones;
- terrazas profundas;
- toldos, barandillas y piscinas puntuales;
- uso moderado: no debe dominar pueblos históricos ni áreas rurales.

## 8.4 Variación válida

La variación puede modificar:

- número de plantas;
- anchura;
- profundidad;
- ritmo de huecos;
- cubierta;
- color dentro de paleta;
- balcones;
- anexos;
- desgaste;
- función de planta baja.

La variación no puede:

- mezclar cubiertas incompatibles sin lógica;
- producir ventanas flotantes o fuera de escala;
- cambiar la identidad cultural;
- invadir carreteras;
- generar accesos imposibles;
- crear edificios tan grandes que borren la calle.

---

# 9. Gramática de asentamientos

## 9.1 Clases

- `hamlet`: 5–25 edificios principales, rural, una ruta dominante.
- `village`: 25–120, núcleo reconocible, plaza o cruce central.
- `town`: 120–600, varios barrios, jerarquía de calles.
- `city`: 600–3.000 visibles por zona, distritos diferenciados.
- `metropolis`: streaming por distritos, skyline controlado y grandes infraestructuras.
- `rural_scattered`: fincas dispersas y red de caminos.
- `port_settlement`: borde marítimo funcional y conexión tierra–agua.
- `mountain_settlement`: crecimiento lineal o escalonado según valle y pendiente.

Los valores son objetivos visuales, no una obligación de dibujar todos los edificios simultáneamente.

## 9.2 Jerarquía viaria

Toda zona debe diferenciar:

- ruta regional;
- calle principal;
- calle secundaria;
- calle residencial;
- camino rural;
- senda peatonal;
- plaza;
- paseo marítimo o muelle.

La anchura, material, mobiliario y relación con edificios cambian según la clase. Una carretera no puede parecer una cinta gris idéntica a una calle peatonal.

## 9.3 Distritos

Las ciudades se construyen mediante distritos, no mediante una distribución homogénea:

- historic_core
- urban_grid
- residential_dense
- residential_low
- seafront
- port
- light_industrial
- civic_center
- tourism
- agricultural_edge
- mountain_village

Cada distrito define densidad, altura, familia de edificio, anchura de calle, vegetación, props y frecuencia de plazas.

## 9.4 Entrada y salida

La transición entre región y zona local debe ser espacialmente comprensible:

- carretera que continúa;
- puerto o estación visible;
- cambio progresivo de densidad;
- señalización discreta;
- punto de entrada seguro;
- cámara orientada hacia el destino;
- ausencia de teletransporte visual confuso.

---

# 10. Hitos y edificios únicos

El generador modular crea tejido urbano, no sustituye los lugares icónicos.

Un hito puede ser:

- único modelado;
- arquetipo regional muy reconocible;
- composición especial de módulos;
- silueta de referencia a distancia.

Prioridad inicial:

- Barcelona: una referencia de puerto y una silueta urbana inequívoca; no es necesario reproducir toda la ciudad de forma exacta.
- Alcúdia: muralla, puertas y casco compacto.
- Montseny: perfil forestal y asentamiento integrado en pendiente.
- Llevant: paseo costero, hotelería controlada, pueblo y transición rural.

Los hitos no deben ocultar la baja calidad del tejido general. Primero debe funcionar la gramática urbana; después se añaden excepciones.

---

# 11. Agua, costa y puertos

## 11.1 Agua

El agua necesita:

- color dependiente de profundidad y bioma;
- reflejo simplificado;
- normal u ondulación ligera;
- espuma o transición en costa cuando proceda;
- lectura clara de zona nadable;
- coherencia con el cielo.

## 11.2 Costa

Tipos iniciales:

- playa arenosa;
- costa rocosa mediterránea;
- puerto artificial;
- ribera fluvial;
- acantilado.

## 11.3 Puerto

Un puerto debe incluir como mínimo:

- línea de muelle;
- explanada o paseo;
- rampas o amarres sugeridos;
- edificios portuarios compatibles;
- separación visual entre agua abierta y zona funcional;
- acceso terrestre inequívoco.

El botón de viaje puede existir, pero debe apoyarse en un lugar que visualmente parezca una salida marítima.

---

# 12. Iluminación y atmósfera

## 12.1 Objetivo

La iluminación debe dar volumen y profundidad sin depender de efectos caros.

## 12.2 Modelo base

- luz direccional principal;
- relleno ambiental dependiente del cielo;
- sombras de contacto;
- niebla atmosférica por distancia;
- oclusión aproximada en uniones importantes;
- exposición controlada por bioma y hora.

## 12.3 Reglas

- Evitar negros cerrados en móvil.
- Evitar saturación verde extrema.
- Separar personaje y fondo mediante valor, temperatura o rim light moderado.
- La montaña debe mostrar capas de profundidad.
- La ciudad debe conservar contraste entre calle, fachada y cubierta.
- Los interiores no se implementan todavía; puertas y accesos deben parecer reales aunque permanezcan cerrados.

## 12.4 Climas iniciales

0.18.0 debe validar:

- día mediterráneo claro;
- tarde cálida costera;
- montaña húmeda parcialmente nublada.

La noche y el ciclo completo pueden llegar después de fijar la calidad diurna.

---

# 13. Macaco de Berbería protagonista

## 13.1 Objetivo

El protagonista debe ser un macaco de Berbería joven reconocible, atractivo y animable. No necesita pelaje fotorrealista, pero sí anatomía continua, cara expresiva y proporciones coherentes.

## 13.2 Rasgos obligatorios

- cola ausente o reducida a un muñón muy discreto;
- torso compacto;
- brazos largos y funcionales;
- manos y pies prensiles legibles;
- cabeza redondeada integrada con cuello y hombros;
- hocico corto claramente modelado;
- orejas pequeñas y correctamente insertadas;
- cejas, ojos y párpados capaces de expresar atención;
- pelaje más voluminoso alrededor de mejillas, cuello y cuerpo;
- rostro y extremidades con material distinto al pelaje;
- postura juvenil, ágil y curiosa, sin aspecto humano disfrazado.

## 13.3 Forma y topología

- Una sola malla orgánica principal o piezas perfectamente integradas.
- Prohibido construir la silueta final con esferas y cilindros visibles.
- Manos y pies simplificados, pero con palma y dedos agrupados reconocibles.
- Articulaciones con suficiente geometría para no colapsar al correr, saltar o trepar.
- Cara con loops o estructura suficiente para ojos, boca, hocico y mejillas.

## 13.4 Presupuesto orientativo

Perfil móvil objetivo:

- LOD0: 14.000–22.000 triángulos.
- LOD1: 7.000–11.000.
- LOD2: 2.500–4.500.
- Sombra lejana: malla muy simplificada o cápsula visual.
- Esqueleto: 45–60 huesos incluyendo cara sencilla, manos, pies y columna.
- Textura: atlas 1024–2048 según perfil; compresión KTX2/Basis cuando se incorpore el pipeline de assets.

Estos valores son límites de trabajo, no objetivos que deban agotarse.

## 13.5 Material del pelaje

No se utilizará pelo por hebras en el mundo abierto móvil. El volumen se consigue mediante:

- silueta modelada;
- normales y roughness;
- variación suave de color;
- mechones geométricos solo en zonas de lectura;
- borde de pelaje en mejillas, hombros y espalda;
- iluminación que preserve el volumen.

## 13.6 Animaciones mínimas

- idle respirando;
- mirar y escuchar;
- caminar;
- correr;
- frenar y girar;
- salto y caída;
- nado;
- recoger objeto;
- reacción breve;
- transición pendiente arriba/abajo;
- futura locomoción contextual para trepar.

Los pies deben apoyar el suelo y los brazos no deben oscilar como barras rígidas.

## 13.7 Cámara

- El personaje debe ocupar una fracción estable de pantalla.
- La cámara no puede ocultarlo continuamente con edificios.
- Debe existir resolución de colisiones y reducción de distancia.
- La orientación del personaje debe responder al movimiento, no copiar de forma rígida el yaw de cámara.

---

# 14. Props y detalle urbano

El detalle se distribuye por kits y densidad, no objeto por objeto sin control.

Kits iniciales:

- mobiliario urbano mediterráneo;
- puerto;
- rural balear;
- montaña;
- carretera y señalización;
- plaza y paseo;
- agricultura.

Props prioritarios:

- farolas;
- bancos;
- papeleras;
- señales;
- barandillas;
- macetas;
- toldos;
- muros de piedra;
- vallas;
- postes;
- cajas y elementos portuarios;
- árboles de alineación;
- pequeños cultivos;
- rocas y matorral.

Los props deben ayudar a entender función y escala. No deben convertirse en ruido o en cientos de draw calls independientes.

---

# 15. Interfaz y lectura en móvil

## 15.1 Principio

El mundo debe ocupar la mayor parte de la pantalla. La interfaz de depuración de 0.17.0 es útil para desarrollo, pero no es la interfaz final.

## 15.2 Reglas

- Paneles compactos y plegables.
- Controles separados de información.
- Botones principales con al menos 44 px de altura táctil.
- Textos secundarios que no atraviesen el centro de la escena.
- La lista de destinos debe poder abrirse y cerrarse.
- El estado “regional/local” debe expresarse con una transición y una etiqueta breve, no con varias líneas técnicas.
- FPS, conteos y builds pertenecen a un modo debug.
- La señalización del mundo tiene prioridad sobre instrucciones permanentes superpuestas.

## 15.3 Orientación

La experiencia objetivo inicial es horizontal. El modo vertical puede mostrar un aviso o una interfaz adaptada, pero no debe bloquear el desarrollo visual del modo principal.

---

# 16. Pipeline técnico artístico

## 16.1 Contrato de assets

El sistema debe aceptar assets autorados y procedurales mediante un contrato común:

- identificador;
- familia;
- biomas compatibles;
- culturas compatibles;
- función;
- dimensiones reales;
- puntos de anclaje;
- materiales;
- LOD;
- collider simplificado;
- coste estimado;
- variantes permitidas.

## 16.2 Formato recomendado

La Biblia no obliga a cambiar de motor, pero fija como formato de intercambio preferido:

- glTF 2.0 / GLB para mallas y esqueletos;
- Meshopt o Draco para geometría cuando el cargador lo soporte;
- KTX2/Basis para texturas;
- atlases de materiales por familia;
- instancing para elementos repetidos;
- colliders separados y simples.

## 16.3 Materiales

Objetivo inicial: PBR simplificado o material físicamente comprensible con:

- base color;
- normal opcional;
- roughness;
- metallic solo cuando corresponda;
- AO empaquetado o aproximado;
- variación por instancia limitada.

No se debe usar una textura única enorme por edificio. Las familias comparten atlases, trim sheets y materiales repetibles.

## 16.4 LOD y streaming

Cada categoría debe declarar distancias y estrategia:

- personaje protagonista: LOD por distancia y perfil;
- edificios: LOD de fachada, masa simplificada y silueta;
- vegetación: malla cercana, malla reducida, impostor o desaparición controlada;
- props: agrupación por celdas y culling;
- terreno: chunks y resolución variable;
- hitos: prioridad de silueta a larga distancia.

## 16.5 Rendimiento objetivo móvil

Dispositivo objetivo inicial: gama media Android en horizontal.

Metas:

- 30 FPS como mínimo estable; 45–60 FPS en dispositivos capaces.
- Evitar picos largos al entrar en una zona.
- Streaming progresivo y cache de recursos compartidos.
- Draw calls limitados mediante instancing, batching por material y atlases.
- Culling por frustum, distancia y celdas.
- Sombras dinámicas reservadas a elementos principales y rango cercano.
- Colliders mucho más simples que las mallas visuales.

La mejora visual no puede depender de multiplicar geometría sin control. La calidad debe proceder de mejor diseño, materiales, iluminación, variación estructurada y LOD.

---

# 17. Sistema de recetas visuales

## 17.1 Estructura conceptual

```json
{
  "region": "baleares",
  "zone": "llevant",
  "physicalBiome": "mediterranean_coastal",
  "modifiers": ["dry", "agricultural", "coastal_salt"],
  "culture": "balearic_mediterranean",
  "settlementClass": "town",
  "districts": ["historic_core", "tourism", "seafront", "agricultural_edge"],
  "architecturePacks": [
    "mediterranean_village",
    "modern_mediterranean_residential",
    "balearic_rural"
  ],
  "vegetationPack": "balearic_coastal_dry",
  "terrainPalette": "limestone_coast_v1",
  "atmosphere": "mediterranean_clear",
  "qualityProfile": "mobile_target"
}
```

## 17.2 Regla de selección

El sistema debe seleccionar packs mediante compatibilidad y pesos. Los pesos dependen del distrito, no solo de la región completa.

Ejemplo Llevant:

- casco/pueblo: 55 % mediterranean_village;
- borde turístico: 35 % modern_mediterranean_residential;
- periferia rural: 70 % balearic_rural;
- paseo: props y pavimentos seafront.

## 17.3 Semilla reproducible

La semilla debe mantener una zona estable entre sesiones y builds compatibles. Un cambio de paleta o asset no debe mover toda la ciudad innecesariamente. Se recomienda separar semillas por capas:

- layoutSeed;
- buildingSeed;
- vegetationSeed;
- propSeed;
- materialSeed.

---

# 18. Pilotos oficiales de 0.18.x

## 18.1 Barcelona — ciudad mediterránea densa

Debe validar:

- bloque urbano convincente;
- calles legibles;
- planta baja diferenciada;
- variación de alturas controlada;
- puerto o borde marítimo comprensible;
- skyline sin repetición evidente;
- rendimiento con densidad alta.

Criterio de éxito: una captura sin HUD debe leerse como ciudad mediterránea grande, no como un conjunto de cajas.

## 18.2 Montseny — montaña templada húmeda

Debe validar:

- relieve con roca y suelo mezclados;
- bosque con profundidad;
- caminos adaptados a pendiente;
- asentamiento pequeño integrado;
- niebla atmosférica ligera;
- ausencia de grandes masas verdes lisas.

Criterio de éxito: debe leerse como montaña boscosa incluso sin edificios.

## 18.3 Llevant — costa, pueblo y rural balear

Debe validar:

- transición pueblo–paseo–costa;
- hotelería contenida;
- casas bajas y tejido mediterráneo;
- campo, muros y caminos rurales;
- vegetación seca y litoral.

Criterio de éxito: el jugador debe distinguir costa turística, núcleo urbano y periferia rural.

## 18.4 Alcúdia — casco histórico y puerto

Debe validar:

- muralla o borde histórico;
- calles compactas;
- plaza o centro reconocible;
- contraste con puerto y expansión moderna;
- puertas y accesos visualmente claros.

Criterio de éxito: la zona debe tener una identidad propia que no pueda confundirse con Llevant.

---

# 19. Fases de producción

## Fase A — Fundamentos visuales

- pipeline de assets;
- material base;
- iluminación y niebla;
- sistema de paletas;
- contrato de recetas;
- perfil móvil objetivo;
- escena de benchmark.

## Fase B — Macaco v2

- modelo orgánico;
- materiales;
- rig;
- locomoción;
- integración con terreno y cámara.

## Fase C — Kit mediterráneo v1

- urbano;
- pueblo;
- rural balear;
- montaña catalana;
- puerto;
- props y vegetación iniciales.

## Fase D — Pilotos

- Barcelona;
- Montseny;
- Llevant;
- Alcúdia.

## Fase E — Generalización

- perfiles visuales en JSON;
- selección procedural por geografía y cultura;
- LOD y streaming;
- documentación para crear una región nueva;
- validación de una quinta zona generada sin código específico.

---

# 20. Criterios de aceptación visual

Una zona no se considera terminada solo porque carga y mantiene FPS.

Debe superar estas preguntas:

1. ¿Se reconoce el bioma sin leer texto?
2. ¿Se reconoce la clase de asentamiento?
3. ¿Las calles, edificios y entradas se entienden?
4. ¿Existe variedad sin perder identidad?
5. ¿Las primitivas geométricas dejan de ser evidentes?
6. ¿El personaje parece un macaco de Berbería y no un muñeco ensamblado?
7. ¿La escena tiene profundidad, contacto y escala?
8. ¿La interfaz permite ver el mundo?
9. ¿La zona conserva rendimiento móvil objetivo?
10. ¿La misma receta puede aplicarse a otra región sin copiar código específico?

## 20.1 Pruebas obligatorias

- Captura horizontal 844 × 390 sin paneles debug.
- Captura cercana del personaje.
- Captura urbana a altura de jugador.
- Captura elevada para comprobar layout.
- Prueba de entrada regional → local.
- Recorrido de 60 segundos con FPS y errores.
- Comparativa LOD cercano/medio/lejano.
- Comprobación de colisiones y cámara.
- Repetición con al menos dos semillas aprobadas.

---

# 21. Decisiones fijadas en v1

1. El estilo oficial es **naturalismo estilizado**, no hiperrealismo ni low poly primitivo.
2. La 0.17.0 es una base técnica, no una referencia artística.
3. El mundo se construye mediante recetas que combinan geografía, bioma, cultura, asentamiento y distrito.
4. Los biomas visuales quedan separados de los biomas de combate.
5. Los edificios utilizarán familias modulares con forma, fachada, cubierta, función y envejecimiento.
6. Los asentamientos se organizarán por distritos y jerarquía viaria.
7. El protagonista será rehecho como malla orgánica con LOD, rig y materiales propios.
8. El rendimiento móvil es una restricción de diseño desde el primer asset.
9. Barcelona, Montseny, Llevant y Alcúdia son los cuatro pilotos oficiales.
10. No se ampliará el mundo de forma prioritaria hasta demostrar que una quinta zona puede heredar el sistema visual con calidad.

---

# 22. Próximo entregable

La Biblia debe convertirse en una **Specification 0.18.0 ejecutable**, con:

- estructura de carpetas y formatos;
- esquema JSON de perfiles visuales;
- lista exacta de assets del primer kit;
- presupuestos por categoría;
- orden de implementación;
- pruebas automáticas;
- primera escena benchmark;
- plan de reemplazo progresivo de los gráficos 0.17.0 sin romper viajes ni guardados.

Ese documento será la guía técnica para comenzar la implementación.
