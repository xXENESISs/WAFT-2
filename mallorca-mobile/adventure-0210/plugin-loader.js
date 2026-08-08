'use strict';
(async () => {
  const script=document.currentScript;
  const version=new URL(script.src).searchParams.get('v')||'0.23.7';
  const urls=['gameplay-plugin.js','playability-0230.js','mobile-polish-0231.js','mechanics-0232.js','world1-parity-0233.js','navigation-0234.js','multimodal-crossing-0236.js','bidirectional-crossing-0237.js'].map(name=>{const url=new URL(name,script.src);url.searchParams.set('v',version);return url;});
  const responses=await Promise.all(urls.map(url=>fetch(url,{cache:'no-store'})));
  const labels=['Adventure','jugabilidad','capa móvil','mecánicas 0.23.2','paridad Mundo 1 0.23.3','navegación 0.23.4','cruce multimodal 0.23.6','retorno bidireccional 0.23.7'];
  responses.forEach((response,i)=>{if(!response.ok)throw new Error(`${response.status} al cargar ${labels[i]}`);});
  let source=await responses[0].text();
  const [playabilitySource,mobileSource,mechanicsSource,paritySource,navigationSource,multimodalSource,bidirectionalSource]=await Promise.all(responses.slice(1).map(r=>r.text()));
  const replaceOne=(pattern,replacement,label)=>{const before=source;source=source.replace(pattern,replacement);if(source===before)throw new Error('No se pudo restaurar '+label);};

  replaceOne('  const plugin = window.WAFTAdventurePlugin = {','  window.__WAFT_INTERNAL_GAME__ = game;\n  const plugin = window.WAFTAdventurePlugin = {','estado Adventure');
  replaceOne("    if (animal.type === 'shark' && !state.swimming) { showToast('La tintorera solo puede montarse en el agua'); return; }","    if (animal.type === 'shark' && !api.sampleSurface(animal.x, animal.z)?.water) { showToast('La tintorera debe estar en el agua'); return; }",'monta de tintorera');
  replaceOne("        && (animal.type !== 'shark' || playerState.swimming);","        && (animal.type !== 'shark' || api.sampleSurface(animal.x, animal.z)?.water);",'interacción de tintorera');
  replaceOne("    const visible = playerState.worldMode === 'regional' && distance < 18;","    const visible = playerState.worldMode === 'regional' && distance < 1.6;",'radio de puerto');
  replaceOne("    button.textContent = 'NAVEGAR A ' + REGION_NAMES[port.target].toUpperCase();","    button.textContent = '⚓ ' + REGION_NAMES[port.target].toUpperCase();",'etiqueta de puerto');
  replaceOne("const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.22.0';","const BUILD_ID = window.__WAFT_ADVENTURE_BUILD__ || '0.23.3';",'build id');

  replaceOne('      const charge = Math.min(1, held / 1250);',"      const charge = Math.max(0, Math.min(2, (held / 1000 - .10) / .88));",'carga de salto');
  replaceOne("      jump.classList.remove('charging');","      jump.classList.remove('charging','maxed','mega');",'feedback de salto');
  replaceOne('        api.setAdventureModifiers({ flightFlap: 3.8 + charge * 6.4 });','        api.setAdventureModifiers({ flightFlap: 3.8 + Math.min(1, charge) * 6.4 });','aleteo');
  replaceOne(
    `      api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity + charge * 7.2 });
      api.jump();
      setTimeout(() => api.setAdventureModifiers({ jumpVelocity: BASE_SPEEDS.jumpVelocity }), 220);`,
    `      const state=api.getState?.();
      const fromWater=Boolean(state?.swimming||mounted?.type==='shark');
      const mountBoost=mounted?.type==='goat'?1.08:mounted?.type==='shark'?1.26:1;
      const normalMax=(fromWater?12.15:13.05)*mountBoost,megaMax=(fromWater?21.30:23.55)*mountBoost,minImpulse=(fromWater?5.45:7.25)*mountBoost;
      const impulse=charge<=1?minImpulse+(normalMax-minImpulse)*Math.pow(charge,.72):normalMax+(megaMax-normalMax)*Math.pow(charge-1,.76);
      const special=mounted?.type==='shark'?1.55:mounted?.type==='goat'?1.10:1;
      const horizontalBoost=((fromWater ? 1.18 : 1)+(fromWater ? 0.42 : 0.17)*Math.min(1,charge)+(fromWater ? 0.38 : 0.27)*Math.max(0,charge-1))*special;
      if(api.queueAdventureJump)api.queueAdventureJump(impulse,{horizontalBoost});else{api.setAdventureModifiers({jumpVelocity:impulse});api.jump();setTimeout(()=>api.setAdventureModifiers({jumpVelocity:BASE_SPEEDS.jumpVelocity}),350);}`,
    'curva de salto del Mundo 1'
  );
  replaceOne(
    `      const charge = Math.min(1, Math.max(0, (performance.now() - game.jumpChargeStartedAt) / 1250));
      jumpButton?.style.setProperty('--charge', charge);
      if (jumpButton && mounted?.type === 'vulture') jumpButton.textContent = 'ALETEO';
    } else if (jumpButton) jumpButton.textContent = mounted?.type === 'vulture' ? 'ALETEAR' : 'SALTAR';`,
    `      const isFlight=mounted?.type==='vulture';
      const charge=Math.max(0,Math.min(isFlight?1:2,((performance.now()-game.jumpChargeStartedAt)/1000-.10)/.88));
      jumpButton?.style.setProperty('--charge',Math.min(1,charge));
      if(jumpButton){jumpButton.classList.toggle('maxed',!isFlight&&charge>=.995&&charge<1.72);jumpButton.classList.toggle('mega',!isFlight&&charge>=1.72);jumpButton.textContent=isFlight?'ALETEO':charge>=1.72?'¡MEGA!':charge>=.995?'¡MAX!':mounted?.type==='shark'?'IMPULSO':'CARGA';}
    }else if(jumpButton){jumpButton.classList.remove('maxed','mega');jumpButton.textContent=mounted?.type==='vulture'?'ALETEAR':mounted?.type==='shark'?'IMPULSO':'SALTAR';}`,
    'feedback MAX/MEGA'
  );

  replaceOne(/    if \(animal\.type === 'vulture'\) \{[\s\S]*?    \} else \{\n      api\.setAdventureModifiers\(\{ runSpeed: 10\.4, swimSpeed: BASE_SPEEDS\.swimSpeed, boost: true, flight: false \}\);\n    \}/,
    `    if(animal.type==='vulture')api.setAdventureModifiers({mountType:'vulture',runSpeed:12.4,swimSpeed:BASE_SPEEDS.swimSpeed,boost:false,flight:true});
    else if(animal.type==='shark')api.setAdventureModifiers({mountType:'shark',runSpeed:BASE_SPEEDS.runSpeed,swimSpeed:18,boost:false,flight:false});
    else if(animal.type==='goat')api.setAdventureModifiers({mountType:'goat',runSpeed:4.0,swimSpeed:BASE_SPEEDS.swimSpeed,boost:false,flight:false});
    else api.setAdventureModifiers({mountType:null,runSpeed:BASE_SPEEDS.runSpeed,swimSpeed:BASE_SPEEDS.swimSpeed,boost:false,flight:false});`,
    'velocidades de montura');

  replaceOne(/  function dismountAnimal\(\) \{[\s\S]*?\n  \}\n\n  function updateAnimals/,
    `  function dismountAnimal(reason='') {
    const animal=mountedAnimal(),api=runtime(),state=api?.getState?.();
    if(animal&&state){
      animal.hidden=false;
      if(animal.type==='shark'&&Number.isFinite(state.adventureLastWaterX)&&Number.isFinite(state.adventureLastWaterZ)){
        animal.x=state.adventureLastWaterX;animal.z=state.adventureLastWaterZ;const water=api.sampleSurface(animal.x,animal.z);animal.y=(water?.waterHeight??0)-.68;
      }else{animal.x=state.position.x;animal.z=state.position.z;animal.y=state.position.y;}
      animal.originX=animal.x;animal.originZ=animal.z;animal.flightMountReady=false;animal.phase=Math.random();
    }
    game.mountedAnimalId=null;
    api?.setAdventureModifiers?.({...BASE_SPEEDS,mountType:null,boost:false,flight:false,clearMountEject:true});
    updateMountUi();showToast(reason==='shark-land'?'La tintorera vuelve al mar':'Has desmontado');
  }

  function updateAnimals`,
    'desmontaje de monturas');
  replaceOne(
    `    const state = api?.getState?.();
    if (!state) return;
    const dt = Math.min(.05, Math.max(0, (now - game.lastFrameAt) / 1000));`,
    `    const state=api?.getState?.();
    if(!state)return;
    if(state.adventureMountEject==='shark-land'&&mountedAnimal()?.type==='shark'){dismountAnimal('shark-land');return;}
    const dt=Math.min(.05,Math.max(0,(now-game.lastFrameAt)/1000));`,
    'expulsión de tintorera en tierra'
  );

  replaceOne("function drawAnimal(r,a,now,mounted=false){const api=runtime(),display=api.regionalToDisplay(a.x,a.z),surface=api.sampleSurface(a.x,a.z),baseY=a.flying?a.y:(surface?.height??a.y),bob=mounted?Math.abs(Math.sin(now*.012))*.04:Math.sin(now*.002+a.phase)*.018,base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){",
    "function drawAnimal(r,a,now,mounted=false){const api=runtime(),display=api.regionalToDisplay(a.x,a.z),surface=api.sampleSurface(a.x,a.z),baseY=mounted?a.y:(a.flying?a.y:(surface?.height??a.y)),bob=mounted?Math.abs(Math.sin(now*.012))*.04:Math.sin(now*.002+a.phase)*.018,base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){",'transformada de montura');
  replaceOne('base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);switch(a.type){','base=worldBase(display.x,baseY+bob,display.z,a.yaw,1);if(window.WAFTAnimalRenderer0230){return window.WAFTAnimalRenderer0230({r,a,now,mounted,api,display,surface,baseY,bob,base,drawSphere,drawCylinderPart,M});}switch(a.type){','renderizador de fauna');

  replaceOne('  function drawPenguin(r, state, now, mountedOffset=0) {\n    const display=state.displayPosition;\n    const baseY=state.position.y-(state.swimming?.46:.82)+mountedOffset;\n    const speed=Math.min(1,game.playerSpeed/4.5),phase=now*.011,step=Math.sin(phase)*speed,swim=state.swimming;',
    `  function drawPenguin(r,state,now,mountedOffset=0,mountType=null){
    const display=state.displayPosition,eyeOffset=mountType==='shark'?0.46:(state.swimming?0.46:0.82);
    const baseY=state.position.y-eyeOffset+mountedOffset;
    const speed=Math.min(1,game.playerSpeed/4.5),phase=now*.011,step=Math.sin(phase)*speed,swim=state.swimming&&!mountType;`, 'jinete sobre montura');
  replaceOne(
    `        const visual = { ...mounted, x: player.position.x, z: player.position.z, y: player.position.y - (player.swimming ? .46 : .82), yaw: player.playerFacing };
        drawAnimal(this, visual, now, true);
        drawPenguin(this, player, now, mounted.type === 'shark' ? .85 : 1.05);`,
    `        const mountedEye=mounted.type==='shark'?0.46:0.82;
        const visual={...mounted,x:player.position.x,z:player.position.z,y:player.position.y-mountedEye,yaw:player.playerFacing,landed:false,flying:mounted.type==='vulture'};
        drawAnimal(this,visual,now,true);
        drawPenguin(this,player,now,mounted.type==='shark'?0.52:(mounted.type==='goat'?0.78:0.82),mounted.type);`,
    'render conjunto de montura'
  );

  (0,eval)(source+'\n//# sourceURL=waft-adventure-0233-gameplay.js');
  (0,eval)(playabilitySource+'\n//# sourceURL=waft-adventure-0230-playability.js');
  (0,eval)(mobileSource+'\n//# sourceURL=waft-adventure-0231-mobile.js');
  (0,eval)(mechanicsSource+'\n//# sourceURL=waft-adventure-0232-mechanics.js');
  (0,eval)(paritySource+'\n//# sourceURL=waft-adventure-0233-parity.js');
  (0,eval)(navigationSource+'\n//# sourceURL=waft-adventure-0234-navigation.js');
  (0,eval)(multimodalSource+'\n//# sourceURL=waft-adventure-0236-multimodal-crossing.js');
  (0,eval)(bidirectionalSource+'\n//# sourceURL=waft-adventure-0237-bidirectional-crossing.js');
  const destinations=document.getElementById('waftDestinations');if(destinations){destinations.classList.remove('waft-hide-narrow');if(innerWidth<900)destinations.textContent='MAPA';}
})().catch(error=>{console.error(error);window.__WAFT_ADVENTURE_0210_ERROR__=String(error?.message||error);const status=document.getElementById('loadText')||document.getElementById('status');if(status)status.textContent='Falló Adventure 0.23.7: '+(error?.message||error);});
