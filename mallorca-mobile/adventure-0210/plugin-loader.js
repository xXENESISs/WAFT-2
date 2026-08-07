'use strict';
(async () => {
  const script = document.currentScript;
  const version = new URL(script.src).searchParams.get('v') || '0.23.0';
  const gameplayUrl = new URL('gameplay-plugin.js', script.src);
  const playabilityUrl = new URL('playability-0230.js', script.src);
  gameplayUrl.searchParams.set('v', version);
  playabilityUrl.searchParams.set('v', version);
  const [gameplayResponse, playabilityResponse] = await Promise.all([
    fetch(gameplayUrl, { cache: 'no-store' }),
    fetch(playabilityUrl, { cache: 'no-store' })
  ]);
  if (!gameplayResponse.ok) throw new Error(`${gameplayResponse.status} al cargar el módulo Adventure`);
  if (!playabilityResponse.ok) throw new Error(`${playabilityResponse.status} al cargar la capa 0.23 de jugabilidad`);
  let source = await gameplayResponse.text();
  const playabilitySource = await playabilityResponse.text();

  const exposeAnchor = '  const plugin = window.WAFTAdventurePlugin = {';
  const animalAnchor = 'base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){';
  if (!source.includes(exposeAnchor)) throw new Error('No se pudo exponer el estado Adventure para 0.23.');
  if (!source.includes(animalAnchor)) throw new Error('No se pudo conectar el nuevo renderizador de fauna 0.23.');
  source = source.replace(exposeAnchor, `  window.__WAFT_INTERNAL_GAME__ = game;\n${exposeAnchor}`);
  source = source.replace(
    animalAnchor,
    `base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);if(window.WAFTAnimalRenderer0230){return window.WAFTAnimalRenderer0230({r,a,now,mounted,api,display,surface,baseY,bob,base,drawSphere,drawCylinderPart,M});}switch(a.type){`
  );
  source = source.replace("const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.22.0';", "const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.23.0';");

  (0, eval)(source + '\n//# sourceURL=waft-adventure-0230-gameplay.js');
  (0, eval)(playabilitySource + '\n//# sourceURL=waft-adventure-0230-playability.js');
})().catch(error => {
  console.error(error);
  window.__WAFT_ADVENTURE_0210_ERROR__ = String(error?.message || error);
  const status = document.getElementById('loadText') || document.getElementById('status');
  if (status) status.textContent = 'Falló Adventure 0.23: ' + (error?.message || error);
});
