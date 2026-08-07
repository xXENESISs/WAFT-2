'use strict';
(async () => {
  const script = document.currentScript;
  const version = new URL(script.src).searchParams.get('v') || '0.23.2';
  const gameplayUrl = new URL('gameplay-plugin.js', script.src);
  const playabilityUrl = new URL('playability-0230.js', script.src);
  const mobileUrl = new URL('mobile-polish-0231.js', script.src);
  const mechanicsUrl = new URL('mechanics-0232.js', script.src);
  for (const url of [gameplayUrl, playabilityUrl, mobileUrl, mechanicsUrl]) url.searchParams.set('v', version);

  const [gameplayResponse, playabilityResponse, mobileResponse, mechanicsResponse] = await Promise.all([
    fetch(gameplayUrl, { cache: 'no-store' }),
    fetch(playabilityUrl, { cache: 'no-store' }),
    fetch(mobileUrl, { cache: 'no-store' }),
    fetch(mechanicsUrl, { cache: 'no-store' })
  ]);
  if (!gameplayResponse.ok) throw new Error(`${gameplayResponse.status} al cargar el módulo Adventure`);
  if (!playabilityResponse.ok) throw new Error(`${playabilityResponse.status} al cargar la capa 0.23 de jugabilidad`);
  if (!mobileResponse.ok) throw new Error(`${mobileResponse.status} al cargar la capa móvil 0.23.1`);
  if (!mechanicsResponse.ok) throw new Error(`${mechanicsResponse.status} al cargar la restauración mecánica 0.23.2`);

  let source = await gameplayResponse.text();
  const playabilitySource = await playabilityResponse.text();
  const mobileSource = await mobileResponse.text();
  const mechanicsSource = await mechanicsResponse.text();

  const exposeAnchor = '  const plugin = window.WAFTAdventurePlugin = {';
  const animalAnchor = 'base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){';
  const sharkMountGuard = "    if (animal.type === 'shark' && !state.swimming) { showToast('La tintorera solo puede montarse en el agua'); return; }";
  const sharkCanMount = "        && (animal.type !== 'shark' || playerState.swimming);";
  const portRange = "    const visible = playerState.worldMode === 'regional' && distance < 18;";
  const portLabel = "    button.textContent = 'NAVEGAR A ' + REGION_NAMES[port.target].toUpperCase();";
  const oldCharge = '      const charge = Math.min(1, held / 1250);';
  const oldReleaseClass = "      jump.classList.remove('charging');";
  const oldGroundJump = `      api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity + charge * 7.2 });\n      api.jump();\n      setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 220);`;
  const oldFrameCharge = `      const charge = Math.min(1, Math.max(0, (performance.now() - game.jumpChargeStartedAt) / 1250));\n      jumpButton?.style.setProperty('--charge', charge);\n      if (jumpButton && mounted?.type === 'vulture') jumpButton.textContent = 'ALETEO';\n    } else if (jumpButton) jumpButton.textContent = mounted?.type === 'vulture' ? 'ALETEAR' : 'SALTAR';`;
  const oldMountOffset = "        drawPenguin(this, player, now, mounted.type === 'shark' ? .85 : 1.05);";

  for (const [anchor, error] of [
    [exposeAnchor, 'No se pudo exponer el estado Adventure para 0.23.2.'],
    [animalAnchor, 'No se pudo conectar el renderizador de fauna.'],
    [sharkMountGuard, 'No se encontró la regla antigua de monta de la tintorera.'],
    [sharkCanMount, 'No se encontró la regla antigua de interacción de la tintorera.'],
    [portRange, 'No se encontró el radio antiguo del botón de navegación.'],
    [portLabel, 'No se encontró la etiqueta antigua de navegación.'],
    [oldCharge, 'No se encontró la carga simplificada que debe sustituirse.'],
    [oldReleaseClass, 'No se encontró la limpieza de carga antigua.'],
    [oldGroundJump, 'No se encontró el salto simplificado que debe sustituirse.'],
    [oldFrameCharge, 'No se encontró el feedback simplificado de salto.'],
    [oldMountOffset, 'No se encontró la altura antigua del jinete sobre la tintorera.']
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
  source = source.replace("const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.22.0';", "const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.23.2';");

  // Restore the two-stage World 1 charged jump: normal/MAX and purple MEGA.
  source = source.replace(oldCharge, "      const charge = Math.max(0, Math.min(2, (held / 1000 - .10) / .88));");
  source = source.replace(oldReleaseClass, "      jump.classList.remove('charging','maxed','mega');");
  source = source.replace("        api.setAdventureModifiers({ flightFlap: 3.8 + charge * 6.4 });", "        api.setAdventureModifiers({ flightFlap: 3.8 + Math.min(1, charge) * 6.4 });");
  source = source.replace(
    oldGroundJump,
    `      const state = api.getState?.();
      const fromWater = Boolean(state?.swimming);
      const mountBoost = mounted?.type === 'goat' ? 1.08 : mounted?.type === 'shark' ? 1.26 : 1;
      const normalMax = (fromWater ? 12.15 : 13.05) * mountBoost;
      const megaMax = (fromWater ? 21.30 : 23.55) * mountBoost;
      const minImpulse = (fromWater ? 5.45 : 7.25) * mountBoost;
      const impulse = charge <= 1
        ? minImpulse + (normalMax - minImpulse) * Math.pow(charge, .72)
        : normalMax + (megaMax - normalMax) * Math.pow(charge - 1, .76);
      if (api.queueAdventureJump) api.queueAdventureJump(impulse);
      else {
        api.setAdventureModifiers({ jumpVelocity: impulse });
        api.jump();
        setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 350);
      }`
  );
  source = source.replace(
    oldFrameCharge,
    `      const isFlight = mounted?.type === 'vulture';
      const charge = Math.max(0, Math.min(isFlight ? 1 : 2, ((performance.now() - game.jumpChargeStartedAt) / 1000 - .10) / .88));
      jumpButton?.style.setProperty('--charge', Math.min(1, charge));
      if (jumpButton) {
        jumpButton.classList.toggle('maxed', !isFlight && charge >= .995 && charge < 1.72);
        jumpButton.classList.toggle('mega', !isFlight && charge >= 1.72);
        jumpButton.textContent = isFlight ? 'ALETEO' : charge >= 1.72 ? '¡MEGA!' : charge >= .995 ? '¡MAX!' : 'CARGA';
      }
    } else if (jumpButton) {
      jumpButton.classList.remove('maxed','mega');
      jumpButton.textContent = mounted?.type === 'vulture' ? 'ALETEAR' : 'SALTAR';
    }`
  );

  // Sit the penguin on the shark instead of visually floating a metre above it.
  source = source.replace(oldMountOffset, "        drawPenguin(this, player, now, mounted.type === 'shark' ? .24 : mounted.type === 'goat' ? .72 : .82);");

  (0, eval)(source + '\n//# sourceURL=waft-adventure-0232-gameplay.js');
  (0, eval)(playabilitySource + '\n//# sourceURL=waft-adventure-0230-playability.js');
  (0, eval)(mobileSource + '\n//# sourceURL=waft-adventure-0231-mobile.js');
  (0, eval)(mechanicsSource + '\n//# sourceURL=waft-adventure-0232-mechanics.js');

  const destinations = document.getElementById('waftDestinations');
  if (destinations) {
    destinations.classList.remove('waft-hide-narrow');
    if (innerWidth < 900) destinations.textContent = 'MAPA';
  }
})().catch(error => {
  console.error(error);
  window.__WAFT_ADVENTURE_0210_ERROR__ = String(error?.message || error);
  const status = document.getElementById('loadText') || document.getElementById('status');
  if (status) status.textContent = 'Falló Adventure 0.23.2: ' + (error?.message || error);
});
