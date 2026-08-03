'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const write = (relative, content) => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
};
const sha256 = content => crypto.createHash('sha256').update(content).digest('hex');

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`No se encontró el bloque requerido: ${label}`);
  return source.replace(search, replacement);
}

function replaceRegexRequired(source, expression, replacement, label) {
  if (!expression.test(source)) throw new Error(`No se encontró el patrón requerido: ${label}`);
  expression.lastIndex = 0;
  return source.replace(expression, replacement);
}

const BUILDING_GEOMETRY = `  function createCubeGeometry(gl, instances) {
    const vertices = [], normals = [], indices = [];
    const pushVertex = (point, normal) => { vertices.push(...point); normals.push(...normal); };
    const quad = (a, b, c, d, normal) => {
      const start = vertices.length / 3;
      pushVertex(a, normal); pushVertex(b, normal); pushVertex(c, normal); pushVertex(d, normal);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    const triangle = (a, b, c, normal) => {
      const start = vertices.length / 3;
      pushVertex(a, normal); pushVertex(b, normal); pushVertex(c, normal);
      indices.push(start, start + 1, start + 2);
    };
    quad([-.5,0,-.5],[.5,0,-.5],[.5,1,-.5],[-.5,1,-.5],[0,0,-1]);
    quad([.5,0,.5],[-.5,0,.5],[-.5,1,.5],[.5,1,.5],[0,0,1]);
    quad([-.5,0,.5],[-.5,0,-.5],[-.5,1,-.5],[-.5,1,.5],[-1,0,0]);
    quad([.5,0,-.5],[.5,0,.5],[.5,1,.5],[.5,1,-.5],[1,0,0]);
    quad([-.5,0,.5],[.5,0,.5],[.5,0,-.5],[-.5,0,-.5],[0,-1,0]);
    quad([-.56,1,-.56],[0,1.18,-.56],[0,1.18,.56],[-.56,1,.56],[-.31,.95,0]);
    quad([0,1.18,-.56],[.56,1,-.56],[.56,1,.56],[0,1.18,.56],[.31,.95,0]);
    triangle([-.5,1,-.501],[.5,1,-.501],[0,1.18,-.501],[0,0,-1]);
    triangle([.5,1,.501],[-.5,1,.501],[0,1.18,.501],[0,0,1]);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    buffer(gl, gl.ARRAY_BUFFER, new Float32Array(vertices)); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    buffer(gl, gl.ARRAY_BUFFER, new Float32Array(normals)); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
    const instanceBuffer = buffer(gl, gl.ARRAY_BUFFER, instances);
    const stride = 8 * 4;
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,3,gl.FLOAT,false,stride,0); gl.vertexAttribDivisor(2,1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,3,gl.FLOAT,false,stride,12); gl.vertexAttribDivisor(3,1);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,1,gl.FLOAT,false,stride,24); gl.vertexAttribDivisor(4,1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5,1,gl.FLOAT,false,stride,28); gl.vertexAttribDivisor(5,1);
    const indexBuffer = buffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices));
    gl.bindVertexArray(null);
    return { vao, instanceBuffer, indexBuffer, indexCount: indices.length, instanceCount: instances.length / 8 };
  }

  function createRoadGeometry`;

const CHARACTER_PARTS = `      drawPart(0, .69, -.02, .32, .48, .27, .255, .195, .145);
      drawPart(0, 1.02, .01, .43, .46, .31, .31, .235, .17);
      drawPart(0, 1.23, .00, .47, .25, .34, .335, .255, .185);
      drawPart(0, 1.45, .03, .37, .35, .33, .29, .215, .155);
      drawPart(0, 1.54, .16, .35, .18, .27, .245, .175, .125);
      drawPart(0, 1.39, .31, .25, .17, .18, .64, .46, .34);
      drawPart(0, 1.49, .31, .30, .085, .15, .255, .18, .13);
      drawPart(-.13, 1.49, .405, .055, .045, .035, .035, .028, .022);
      drawPart(.13, 1.49, .405, .055, .045, .035, .035, .028, .022);
      drawPart(-.34, 1.44, .035, .12, .17, .085, .38, .285, .205);
      drawPart(.34, 1.44, .035, .12, .17, .085, .38, .285, .205);
      drawPart(-.43, .99, armStroke, .145, .47, .145, .265, .20, .145);
      drawPart(.43, .99, -armStroke, .145, .47, .145, .265, .20, .145);
      drawPart(-.47, .57, armStroke * 1.12, .135, .38, .13, .235, .18, .13);
      drawPart(.47, .57, -armStroke * 1.12, .135, .38, .13, .235, .18, .13);
      drawPart(-.47, .31, .11 + armStroke * 1.2, .18, .12, .21, .17, .13, .095);
      drawPart(.47, .31, .11 - armStroke * 1.2, .18, .12, .21, .17, .13, .095);
      drawPart(-.22, .43, -legStroke, .18, .37, .18, .285, .215, .155);
      drawPart(.22, .43, legStroke, .18, .37, .18, .285, .215, .155);
      drawPart(-.22, .17, .03 - legStroke, .15, .25, .14, .235, .18, .13);
      drawPart(.22, .17, .03 + legStroke, .15, .25, .14, .235, .18, .13);
      drawPart(-.22, .035, .20 - legStroke, .20, .085, .31, .155, .12, .09);
      drawPart(.22, .035, .20 + legStroke, .20, .085, .31, .155, .12, .09);
      drawPart(0, .64, -.29, .17, .15, .18, .285, .215, .155);
      drawPart(0, .67, -.46, .12, .11, .16, .285, .215, .155);
`;

function enhanceRuntime(source, options) {
  let output = source;
  output = replaceRequired(output, options.titleOld, options.titleNew, 'título del runtime');
  output = replaceRequired(output, options.hudOld, options.hudNew, 'etiqueta del runtime');
  output = replaceRequired(output, "graphicsProfile: 'enhanced-mobile-v2'", "graphicsProfile: 'enhanced-mobile-v3'", 'perfil gráfico');
  output = replaceRequired(output,
    "#scaleMode.active{background:#315f51;color:#f7fff9;border-color:#8bd1b5}",
    "#scaleMode.active{background:#315f51;color:#f7fff9;border-color:#8bd1b5}\n#scaleMode.ready{height:48px;background:#2f6d58;color:#fff;border-color:#a8efd2;box-shadow:0 0 0 3px rgba(115,225,184,.18),0 8px 26px rgba(0,0,0,.36);animation:zoneReady 1.35s ease-in-out infinite}\n@keyframes zoneReady{50%{transform:translateY(-2px);box-shadow:0 0 0 7px rgba(115,225,184,.08),0 10px 30px rgba(0,0,0,.42)}}",
    'estilo de acceso local');
  output = replaceRequired(output,
    "    const entryRadiusFor = zone => Math.max(6, Math.min(10, Number(zone.regionalRadius) * .32));\n    const discoveryRadiusFor = zone => entryRadiusFor(zone) * 2.25;",
    "    const entryRadiusFor = zone => Math.max(16, Math.min(32, Number(zone.regionalRadius) * .82));\n    const discoveryRadiusFor = zone => entryRadiusFor(zone) * 1.75;",
    'radios de acceso local');
  output = replaceRequired(output,
    "    const updateScaleButton = () => {\n",
    "    const updateScaleButton = () => {\n      scaleModeButton.classList.toggle('ready', state.worldMode === 'regional' && state.localProximityStatus === 'available');\n",
    'estado visual de acceso');
  output = replaceRegexRequired(output,
    /  function createCubeGeometry\(gl, instances\) \{[\s\S]*?\n  function createRoadGeometry/,
    BUILDING_GEOMETRY,
    'geometría de edificios');
  output = replaceRequired(output,
    "      layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal; layout(location=2) in vec3 aCenter; layout(location=3) in vec3 aSize; layout(location=4) in float aAngle; layout(location=5) in float aKind;\n      uniform mat4 uPV; uniform float uTerrainScale; uniform float uBuildingScale; uniform float uHorizontalExaggeration; uniform vec2 uWorldCenter; uniform float uWorldScale; uniform float uFootprintScale; out vec3 vNormal; flat out int vKind; out vec3 vWorld;\n      void main(){float c=cos(aAngle),s=sin(aAngle);vec2 local=aPosition.xz*aSize.xz*uHorizontalExaggeration*uFootprintScale;vec2 rotated=vec2(local.x*c-local.y*s,local.x*s+local.y*c);vec2 centerXZ=uWorldCenter+(aCenter.xz-uWorldCenter)*uWorldScale;vWorld=vec3(centerXZ.x+rotated.x,aCenter.y*uTerrainScale+aPosition.y*aSize.y*uBuildingScale+.06,centerXZ.y+rotated.y);vNormal=normalize(vec3(aNormal.x*c-aNormal.z*s,aNormal.y,aNormal.x*s+aNormal.z*c));vKind=int(aKind+.5);gl_Position=uPV*vec4(vWorld,1.0);}`,
    "      layout(location=0) in vec3 aPosition; layout(location=1) in vec3 aNormal; layout(location=2) in vec3 aCenter; layout(location=3) in vec3 aSize; layout(location=4) in float aAngle; layout(location=5) in float aKind;\n      uniform mat4 uPV; uniform float uTerrainScale; uniform float uBuildingScale; uniform float uHorizontalExaggeration; uniform vec2 uWorldCenter; uniform float uWorldScale; uniform float uFootprintScale; out vec3 vNormal; flat out int vKind; out vec3 vWorld; out vec3 vLocal;\n      void main(){float c=cos(aAngle),s=sin(aAngle);vec2 local=aPosition.xz*aSize.xz*uHorizontalExaggeration*uFootprintScale;vec2 rotated=vec2(local.x*c-local.y*s,local.x*s+local.y*c);vec2 centerXZ=uWorldCenter+(aCenter.xz-uWorldCenter)*uWorldScale;vWorld=vec3(centerXZ.x+rotated.x,aCenter.y*uTerrainScale+aPosition.y*aSize.y*uBuildingScale+.06,centerXZ.y+rotated.y);vNormal=normalize(vec3(aNormal.x*c-aNormal.z*s,aNormal.y,aNormal.x*s+aNormal.z*c));vKind=int(aKind+.5);vLocal=aPosition;gl_Position=uPV*vec4(vWorld,1.0);}`,
    'vertex shader de edificios');
  output = replaceRequired(output,
    "      precision highp float; in vec3 vNormal; in vec3 vWorld; flat in int vKind; uniform vec3 uCamera; uniform bool uShowHotels; out vec4 outColor;\n      vec3 colorFor(int kind){if(kind==1)return vec3(.91,.86,.72);if(kind==2)return vec3(.74,.56,.34);if(kind==3)return vec3(.50,.35,.24);if(kind==4)return vec3(.45,.59,.64);if(kind==5)return vec3(.72,.43,.28);return vec3(.66,.59,.49);}",
    "      precision highp float; in vec3 vNormal; in vec3 vWorld; in vec3 vLocal; flat in int vKind; uniform vec3 uCamera; uniform bool uShowHotels; out vec4 outColor;\n      vec3 colorFor(int kind){if(kind==1)return vec3(.93,.88,.74);if(kind==2)return vec3(.76,.58,.36);if(kind==3)return vec3(.57,.43,.31);if(kind==4)return vec3(.53,.66,.69);if(kind==5)return vec3(.78,.48,.31);if(kind==6)return vec3(.82,.78,.66);return vec3(.70,.63,.52);}\n      vec3 roofFor(int kind){if(kind==4)return vec3(.28,.33,.35);if(kind==5)return vec3(.48,.19,.12);return vec3(.48,.27,.17);}",
    'fragment shader de edificios');
  output = replaceRequired(output,
    "        float roof=smoothstep(.72,.96,normal.y);\n        float materialVariation=.96+.045*sin(vWorld.x*.31+vWorld.z*.27+float(vKind)*1.7);\n        float floorBand=.94+.06*step(.58,fract(vWorld.y*.34));\n        vec3 base=colorFor(vKind)*materialVariation*mix(floorBand,1.08,roof);\n        vec3 lit=base*(.46+sun*.53+roof*.12);\n        float rim=pow(1.0-max(dot(normal,viewDirection),0.0),2.0)*.045;\n        float fog=smoothstep(285.0,800.0,distance(vWorld.xz,uCamera.xz));\n        outColor=vec4(mix(lit+rim,vec3(.39,.555,.655),fog),1.0);",
    "        float roof=smoothstep(.42,.88,normal.y)*step(1.01,vLocal.y);\n        float vertical=1.0-smoothstep(.22,.58,abs(normal.y));\n        float materialVariation=.94+.06*sin(vWorld.x*.31+vWorld.z*.27+float(vKind)*1.7);\n        float floorBand=.93+.07*step(.56,fract(vLocal.y*5.2));\n        vec3 base=colorFor(vKind)*materialVariation*floorBand;\n        float row=step(.56,fract(vLocal.y*5.2))*step(fract(vLocal.y*5.2),.86);\n        float column=step(.20,fract((vWorld.x+vWorld.z)*.42))*step(fract((vWorld.x+vWorld.z)*.42),.70);\n        float windows=vertical*row*column*(1.0-roof);\n        float door=vertical*(1.0-step(.28,vLocal.y))*step(.38,fract((vWorld.x-vWorld.z)*.16))*step(fract((vWorld.x-vWorld.z)*.16),.62);\n        base=mix(base,vec3(.075,.12,.135),windows*.82);\n        base=mix(base,vec3(.19,.105,.055),door*.78);\n        base=mix(base,roofFor(vKind),roof);\n        vec3 lit=base*(.45+sun*.54+roof*.15);\n        float rim=pow(1.0-max(dot(normal,viewDirection),0.0),2.0)*.05;\n        float fog=smoothstep(285.0,800.0,distance(vWorld.xz,uCamera.xz));\n        outColor=vec4(mix(lit+rim,vec3(.39,.555,.655),fog),1.0);",
    'material visual de edificios');
  output = replaceRequired(output,
    "      [.028,.165,.285],[.78,.665,.405],[.39,.405,.39],[.265,.445,.175],[.052,.275,.115],\n      [.46,.49,.19],[.405,.415,.405],[.145,.37,.275],[.45,.405,.355],[.35,.535,.205]",
    "      [.026,.17,.30],[.73,.61,.35],[.42,.43,.41],[.31,.47,.19],[.055,.29,.12],\n      [.50,.53,.20],[.45,.44,.40],[.16,.39,.28],[.49,.40,.29],[.38,.56,.20]",
    'paleta rural');
  output = replaceRequired(output,
    "        base=mix(base,waterColor,waterMask);\n        vec3 lit=base*(hemisphere+sun*.54)*slopeShade;",
    "        base=mix(base,waterColor,waterMask);\n        float fieldRows=.955+.045*sin(vWorld.x*.46+vWorld.z*.08);\n        float parcel=.965+.035*step(.50,fract((vWorld.x-vWorld.z)*.075));\n        float ruralDetail=mix(fieldRows*parcel,1.0,waterMask);\n        base*=ruralDetail;\n        vec3 lit=base*(hemisphere+sun*.54)*slopeShade;",
    'detalle de terreno rural');
  output = replaceRequired(output, '    const characterMesh = createSphereGeometry(gl);', '    const characterMesh = createSphereGeometry(gl, 16, 11);', 'malla del macaco');
  output = replaceRegexRequired(output,
    /      drawPart\(0, \.78,[\s\S]*?      drawPart\(0, 1\.08, -1\.00[^\n]*\n/,
    CHARACTER_PARTS,
    'sprite del macaco');
  output = replaceRequired(output,
    "      availableZones: localRegistry.zones.map(zone => ({ id: zone.id, presetId: zone.presetId, name: zone.name, buildId: zone.buildId, center: { ...zone.center }, entryRadius: Math.max(6, Math.min(10, Number(zone.regionalRadius) * .32)), discoveryRadius: Math.max(6, Math.min(10, Number(zone.regionalRadius) * .32)) * 2.25 })),",
    "      availableZones: localRegistry.zones.map(zone => ({ id: zone.id, presetId: zone.presetId, name: zone.name, buildId: zone.buildId, center: { ...zone.center }, entryRadius: Math.max(16, Math.min(32, Number(zone.regionalRadius) * .82)), discoveryRadius: Math.max(16, Math.min(32, Number(zone.regionalRadius) * .82)) * 1.75 })),",
    'API de radios locales');
  output = output.replace("version: '011'", `version: '${options.apiVersion}'`);
  return output;
}

function enhanceAdventure(source) {
  let output = source;
  output = replaceRequired(output, '<title>WAFT Adventure 0.15.9 · Dos regiones reales</title>', '<title>WAFT Adventure 0.16.0 · Accesos y mundo visual</title>', 'título de aventura');
  output = replaceRequired(output, '<b>WAFT 0.15.9</b>', '<b>WAFT 0.16.0</b>', 'pantalla de carga');
  output = replaceRequired(output, 'const BUILD_ID = "waft-adventure-0159-ac6ed7b3aca1";', 'const BUILD_ID = "waft-adventure-0160-visual-access-v1";', 'build id');
  output = output.replace('region-runtime-baleares-011.html', 'region-runtime-baleares-012.html');
  output = output.replace('region-runtime-catalunya-litoral-001.html', 'region-runtime-catalunya-litoral-002.html');
  output = replaceRequired(output,
    '#travelButton{display:none;border:1px solid #9fe3cc88;background:#255e51;color:#f3fffa;border-radius:10px;padding:8px 11px;font-weight:950;font-size:10px;white-space:nowrap}\n#travelButton.visible{display:block}',
    '#travelButton{display:none;position:fixed;z-index:95;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);border:2px solid #a8efd2;background:linear-gradient(180deg,#347966,#205347);color:#f6fffb;border-radius:16px;padding:14px 20px;font-weight:1000;font-size:13px;letter-spacing:.035em;white-space:nowrap;box-shadow:0 10px 34px #000a,0 0 0 5px rgba(112,224,184,.10)}\n#travelButton.visible{display:block;animation:travelReady 1.35s ease-in-out infinite}\n@keyframes travelReady{50%{transform:translateX(-50%) translateY(-3px);box-shadow:0 13px 38px #000b,0 0 0 9px rgba(112,224,184,.05)}}',
    'botón de viaje ampliado');
  output = output.replace('@media(max-width:700px){#world{top:6px;padding:5px 7px;gap:5px}#world small{display:none}#world strong{font-size:9px}#travelButton{padding:6px 8px;font-size:9px}#toast{top:49px}}', '@media(max-width:700px){#world{top:6px;padding:5px 7px;gap:5px}#world small{display:none}#world strong{font-size:9px}#travelButton{padding:13px 17px;font-size:11px;max-width:calc(100vw - 24px)}#toast{top:49px}}');
  output = replaceRequired(output,
    "    state.travelEligible = state.movementSinceLoad >= 1.2 && state.exitDistance <= 14 && CAPABILITIES.has(ROUTE.capability) && runtimeState.worldMode === 'regional';",
    "    state.travelEligible = state.movementSinceLoad >= .35 && state.exitDistance <= 32 && CAPABILITIES.has(ROUTE.capability) && runtimeState.worldMode === 'regional';",
    'radio del viaje regional');
  output = output.replaceAll('__WAFT_ADVENTURE_0159_', '__WAFT_ADVENTURE_0160_');
  output = output.replace('window.WAFTAdventure0159 =', 'window.WAFTAdventure0160 =');
  output = output.replace("No se pudo abrir WAFT Adventure 0.15.9.", "No se pudo abrir WAFT Adventure 0.16.0.");
  output = replaceRequired(output,
    "      travelEligible: state.travelEligible,\n      capabilities: [...CAPABILITIES],",
    "      travelEligible: state.travelEligible,\n      travelActivationRadius: 32,\n      localAccessProfile: 'wide-area-v1',\n      capabilities: [...CAPABILITIES],",
    'telemetría de acceso');
  output = replaceRequired(output,
    "    getState() { return { ...snapshot(), runtimeReady: state.runtimeReady, runtimeBuildId: state.runtimeBuildId, runtimeBinarySha256: state.runtimeBinarySha256, movementSinceLoad: state.movementSinceLoad, exitDistance: state.exitDistance, travelEligible: state.travelEligible, capabilities: [...CAPABILITIES], pageErrors: [...state.pageErrors] }; },",
    "    getState() { return { ...snapshot(), runtimeReady: state.runtimeReady, runtimeBuildId: state.runtimeBuildId, runtimeBinarySha256: state.runtimeBinarySha256, movementSinceLoad: state.movementSinceLoad, exitDistance: state.exitDistance, travelEligible: state.travelEligible, travelActivationRadius: 32, localAccessProfile: 'wide-area-v1', capabilities: [...CAPABILITIES], pageErrors: [...state.pageErrors] }; },",
    'API de aventura');
  return output;
}

const balearesSourcePath = 'mallorca-mobile/region-runtime-baleares-011.html';
const catalunyaSourcePath = 'mallorca-mobile/region-runtime-catalunya-litoral-001.html';
const adventureSourcePath = 'mallorca-mobile/waft-0159.html';

const baleares = enhanceRuntime(read(balearesSourcePath), {
  titleOld: '<title>WAFT · Runtime regional de Baleares 011</title>',
  titleNew: '<title>WAFT · Runtime regional de Baleares 012</title>',
  hudOld: '<div id="hud"><div id="hudTitle">RUNTIME REGIONAL 011</div>',
  hudNew: '<div id="hud"><div id="hudTitle">RUNTIME REGIONAL 012 · MUNDO VIVO</div>',
  apiVersion: '012'
});
const catalunya = enhanceRuntime(read(catalunyaSourcePath), {
  titleOld: '<title>WAFT · Runtime regional de Catalunya litoral 001</title>',
  titleNew: '<title>WAFT · Runtime regional de Catalunya litoral 002</title>',
  hudOld: '<div id="hud"><div id="hudTitle">RUNTIME CATALUNYA 001</div>',
  hudNew: '<div id="hud"><div id="hudTitle">RUNTIME CATALUNYA 002 · MUNDO VIVO</div>',
  apiVersion: '002'
});
const adventure = enhanceAdventure(read(adventureSourcePath));

const outputs = {
  'mallorca-mobile/region-runtime-baleares-012.html': baleares,
  'mallorca-mobile/region-runtime-catalunya-litoral-002.html': catalunya,
  'mallorca-mobile/waft-0160.html': adventure
};
for (const [relative, content] of Object.entries(outputs)) write(relative, content);

const status = {
  version: '0.16.0',
  buildId: 'waft-adventure-0160-visual-access-v1',
  generatedAt: new Date().toISOString(),
  access: { localEntryRadiusMin: 16, localEntryRadiusMax: 32, travelActivationRadius: 32, movementRequired: 0.35 },
  visuals: { monkey: 'barbary-macaque-v3-short-tail', buildings: 'pitched-roof-procedural-facades-v1', ruralTerrain: 'parcel-detail-v1' },
  protectedSources: [balearesSourcePath, catalunyaSourcePath, adventureSourcePath],
  outputs: Object.fromEntries(Object.entries(outputs).map(([relative, content]) => [relative, { bytes: Buffer.byteLength(content), sha256: sha256(content) }]))
};
write('world-generator/waft-0160-build-status.json', JSON.stringify(status, null, 2) + '\n');
console.log(JSON.stringify(status, null, 2));
