# WAFT World Generator

Este directorio contiene la base del generador mundial de regiones de WAFT Adventure.

La idea central es separar por completo tres cosas:

1. **Configuración autoral**: qué región queremos construir y con qué reglas.
2. **Datos generados**: terreno, objetos, fauna, monumentos y rutas producidos automáticamente.
3. **Correcciones humanas**: excepciones que deben sobrevivir a cualquier regeneración.

La build jugable no debe contener lógica especial para Mallorca, Cataluña o cualquier otra región. El motor cargará paquetes creados con el mismo contrato.

## Archivos principales

```text
world-generator/
  configs/
    baleares.region.json
  schema/
    region.schema.json
  scripts/
    validate-region.mjs
  overrides/
  generated/
```

- `configs/*.region.json`: entradas del generador.
- `schema/region.schema.json`: contrato formal de una región.
- `scripts/validate-region.mjs`: validación estructural sin dependencias externas.
- `overrides/*.overrides.json`: movimientos, escalas, eliminaciones y modelos personalizados.
- `generated/<region-id>/`: resultados desechables que siempre pueden reconstruirse.

## Principios obligatorios

### El mundo existe completo, pero no se carga completo

WAFT utilizará esta jerarquía:

```text
Atlas mundial ligero
  → región activa
    → sectores o teselas próximas al jugador
      → niveles de detalle según distancia
```

El atlas mantiene continentes, rutas y regiones descubiertas. Cada región es un paquete independiente. Dentro de ella, el motor solo mantiene en memoria los sectores necesarios.

### La geografía real es la base, no una cárcel

El generador conserva:

- costas y forma general del territorio;
- orden y dirección relativa de localidades;
- relieve principal;
- posición aproximada de monumentos;
- biomas y fauna plausibles.

Puede aplicar compresión jugable para evitar kilómetros vacíos y separar monumentos gigantes. Toda deformación debe ser determinista y declarada en `geography.scale`.

### Nada importante se coloca al azar sin restricciones

Los edificios y elementos procedimentales deben respetar:

- suelo válido;
- pendiente máxima;
- distancia mínima entre objetos;
- carreteras, costa y huellas urbanas cuando existan;
- radios protegidos alrededor de monumentos;
- presupuesto móvil de la región.

Una parcela inválida se descarta. Nunca se fuerza un edificio dentro del agua o solapado.

### Las correcciones humanas sobreviven

El generador nunca debe editar directamente el archivo de overrides. Una regeneración vuelve a producir `generated/`, y después aplica las correcciones declaradas.

Ejemplos de correcciones:

- mover o escalar Bellver;
- retirar un edificio mal situado;
- reservar una explanada alrededor de un jefe;
- sustituir un castillo genérico por un GLB específico;
- cambiar la densidad local de vegetación.

## Contrato de `region.json`

Cada región contiene nueve bloques conceptuales.

### 1. Identidad

`id`, `name`, `version`, países, continente y estado de desarrollo.

El `id` es permanente. No debe cambiar aunque se renombre la región para el jugador.

### 2. Geografía

- límites WGS84;
- origen local;
- proyección;
- escala horizontal y vertical;
- subregiones reconocibles;
- compresión de zonas vacías.

Las coordenadas geográficas siempre se guardan en longitud y latitud. Las coordenadas locales son un resultado del generador.

### 3. Fuentes

Define qué conjuntos de datos puede utilizar la región y la atribución exigida:

- relieve;
- costas y cartografía;
- cobertura del suelo;
- clima;
- monumentos;
- fauna.

Las claves, tokens y secretos nunca se guardan en `region.json`.

### 4. Generación física

Reglas para terreno, agua, carreteras, asentamientos, edificios, monumentos, vegetación y fauna.

### 5. Viajes

Puntos físicos de entrada y conexiones con otras regiones. Las rutas existentes pertenecen al mundo; las rutas descubiertas pertenecen a la partida guardada y no se escriben aquí.

Las capacidades admitidas inicialmente son deliberadamente pocas:

- `land`;
- `flight`;
- `long_water`.

### 6. Jugabilidad

Zonas reservadas, lugares de aparición, áreas de jefe y densidad mínima de contenido. Esta capa evita que una región geográficamente correcta resulte aburrida.

### 7. Rendimiento

Presupuestos máximos de memoria, triángulos, objetos visibles, colisiones y tamaño descargable. El generador debe fallar si los supera; no debe publicar silenciosamente una región demasiado pesada.

### 8. Salidas

Nombres deterministas de los archivos generados. El paquete final tendrá un manifiesto con versión, hashes y dependencias.

### 9. Overrides

Ruta al archivo de correcciones humanas y política de aplicación.

## Archivos generados previstos

```text
regions/<region-id>/
  manifest.json
  terrain.bin
  landcover.bin
  sectors.json
  settlements.json
  objects.json
  landmarks.json
  fauna.json
  routes.json
```

El manifiesto deberá incluir hashes para detectar paquetes incompletos y permitir caché segura en móvil.

## Orden de implementación

1. Validar el contrato y convertir Baleares en configuración declarativa.
2. Extraer del HTML actual la lógica reutilizable de proyección, terreno y colocación.
3. Generar un paquete de Baleares sin alterar todavía la build jugable estable.
4. Crear una segunda región, `catalunya-litoral`, con el mismo sistema.
5. Solo cuando ambas funcionen, conectar el cargador regional al motor.

Baleares será la región de referencia. Cataluña litoral será la prueba de que el sistema es realmente reutilizable y no una nueva colección de excepciones para Mallorca.
