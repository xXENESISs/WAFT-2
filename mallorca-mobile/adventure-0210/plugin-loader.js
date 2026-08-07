'use strict';
(async () => {
  const script = document.currentScript;
  const version = new URL(script.src).searchParams.get('v') || '0.23.1';
  const gameplayUrl = new URL('gameplay-plugin.js', script.src);
  const playabilityUrl = new URL('playability-0230.js', script.src);
  const mobileUrl = new URL('mobile-polish-0231.js', script.src);
  gameplayUrl.searchParams.set('v', version);
  playabilityUrl.searchParams.set('v', version);
  mobileUrl.searchParams.set('v', version);
  const [gameplayResponse, playabilityResponse, mobileResponse] = await Promise.all([
    fetch(gameplayUrl, { cache: 'no-store' }),
    fetch(playabilityUrl, { cache: 'no-store' }),
    fetch(mobileUrl, { cache: 'no-store' })
  ]);
  if (!gameplayResponse.ok) throw new Error(`${gameplayResponse.status} al cargar el módulo Adventure`);
  if (!playabilityResponse.ok) throw new Error(`${playabilityResponse.status} al cargar la capa 0.23 de jugabilidad`);
  if (!mobileResponse.ok) throw new Error(`${mobileResponse.status} al cargar la capa móvil 0.23.1`);
  let source = await gameplayResponse.text();
  const playabilitySource = await playabilityResponse.text();
  const mobileSource = await mobileResponse.text();

  const exposeAnchor = '  const plugin = window.WAFTAdventurePlugin = {';
  const animalAnchor = 'base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){';
  const sharkMountGuard = "    if (animal.type === 'shark' && !state.swimming) { showToast('La tintorera solo puede montarse en el agua'); return; }";
  const sharkCanMount = "        && (animal.type !== 'shark' || playerState.swimming);";
  const portRange = "    const visible = playerState.worldMode === 'regional' && distance < 18;";
  const portLabel = "    button.textContent = 'NAVEGAR A ' + REGION_NAMES[port.target].toUpperCase();";
  for (const [anchor, error] of [
    [exposeAnchor, 'No se pudo exponer el estado Adventure para 0.23.1.'],
    [animalAnchor, 'No se pudo conectar el renderizador de fauna.'],
    [sharkMountGuard, 'No se encontró la regla antigua de monta de la tintorera.'],
    [sharkCanMount, 'No se encontró la regla antigua de interacción de la tintorera.'],
    [portRange, 'No se encontró el radio antiguo del botón de navegación.'],
    [portLabel, 'No se encontró la etiqueta antigua de navegación.']
  ]) if (!source.includes(anchor)) throw new Error(error);

  source = source.replace(exposeAnchor, `  window.__WAFT_INTERNAL_GAME__ = game;\n${exposeAnchor}`);
  source = source.replace(
    animalAnchor,
    `base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);if(window.WAFTAnimalRenderer0230){return window.WAFTAnimalRenderer0230({r,a,now,mounted,api,display,surface,baseY,bob,base,drawSphere,drawCylinderPart,M});}switch(a.type){`
  );
  source = source.replace(
    sharkMountGuard,
    "    if (animal.type === 'shark' && !api.sampleSurface(animal.x, animal.z)?.water) { showToast('La tintorera debe estar en el agua'); return; }"
  );
  source = source.replace(
    sharkCanMount,
    "        && (animal.type !== 'shark' || api.sampleSurface(animal.x, animal.z)?.water);"
  );
  source = source.replace(portRange, "    const visible = playerState.worldMode === 'regional' && distance < 1.6;");
  source = source.replace(portLabel, "    button.textContent = '⚓ ' + REGION_NAMES[port.target].toUpperCase();");
  source = source.replace("const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.22.0';", "const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.23.1';");

  (0, eval)(source + '\n//# sourceURL=waft-adventure-0231-gameplay.js');
  (0, eval)(playabilitySource + '\n//# sourceURL=waft-adventure-0230-playability.js');
  (0, eval)(mobileSource + '\n//# sourceURL=waft-adventure-0231-mobile.js');

  const destinations = document.getElementById('waftDestinations');
  if (destinations) {
    destinations.classList.remove('waft-hide-narrow');
    if (innerWidth < 900) destinations.textContent = 'MAPA';
  }
})().catch(error => {
  console.error(error);
  window.__WAFT_ADVENTURE_0210_ERROR__ = String(error?.message || error);
  const status = document.getElementById('loadText') || document.getElementById('status');
  if (status) status.textContent = 'Falló Adventure 0.23.1: ' + (error?.message || error);
});
