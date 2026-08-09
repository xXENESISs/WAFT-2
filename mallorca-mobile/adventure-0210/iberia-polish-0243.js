'use strict';
(() => {
  if (window.__WAFT_ADVENTURE_REGION__ !== 'iberia') return;
  const VERSION='0.24.3';
  const BIRD_ID='iberia-bearded-vulture';
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let lastFollowAt=performance.now();

  function injectStyle(){
    const style=document.createElement('style');
    style.textContent=`
      #help,#waftFlightTelemetry{display:none!important}
      #joystick,#joystick *,#vertical,#vertical *,#presets,#presets *,#waftJump,#waftAdventureAction,#waftObserveAction,#waftTravelAction,#waftTopActions,#waftTopActions *,#waftIberiaPlaces,#waftIberiaPlaces *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
      #waftIberiaCoords{margin-top:4px;padding-top:4px;border-top:1px solid #ffffff16;color:#a9c3bf;font-size:9px;line-height:1.2;font-weight:750;letter-spacing:.015em;white-space:nowrap}
      @media(max-width:700px){#waftIberiaCoords{font-size:8px;margin-top:3px;padding-top:3px}}
    `;
    document.head.appendChild(style);
  }

  function blockSelection(){
    const selector='#joystick,#vertical,#presets,#waftJump,#waftAdventureAction,#waftObserveAction,#waftTravelAction,#waftTopActions,#waftIberiaPlaces';
    const block=event=>{if(event.target?.closest?.(selector))event.preventDefault();};
    document.addEventListener('contextmenu',block,{capture:true});
    document.addEventListener('selectstart',block,{capture:true});
    document.addEventListener('dragstart',block,{capture:true});
  }

  function installCoords(){
    const hud=document.getElementById('hud');
    if(!hud||document.getElementById('waftIberiaCoords'))return;
    const el=document.createElement('div');
    el.id='waftIberiaCoords';
    el.textContent='ALT — · LAT — · LON —';
    hud.appendChild(el);
  }

  function geoFromState(api,state){
    const projection=api.metadata?.projection;
    if(!projection||!state?.position)return null;
    const units=Number(projection.unitsPerKm)||1;
    const lat=projection.origin.lat-state.position.z/((Number(projection.kmPerDegreeLat)||111.132)*units);
    const lon=projection.origin.lon+state.position.x/((Number(projection.kmPerDegreeLon)||85.56)*units);
    return{lat,lon};
  }

  function updateCoords(){
    const api=window.WAFTRegionRuntime,state=api?.getState?.(),el=document.getElementById('waftIberiaCoords');
    if(!api||!state||!el)return;
    const geo=geoFromState(api,state);if(!geo)return;
    const surface=api.sampleSurface?.(state.position.x,state.position.z);
    const verticalScale=Number(api.metadata?.terrain?.verticalScale)||0.013594;
    const terrainY=Number(surface?.height);
    const altitude=Number.isFinite(terrainY)&&verticalScale>0?Math.max(0,Math.round(terrainY/verticalScale)):0;
    el.textContent=`ALT ${altitude.toLocaleString('es-ES')} m · LAT ${geo.lat.toFixed(4)} · LON ${geo.lon.toFixed(4)}`;
  }

  function followBird(now){
    const api=window.WAFTRegionRuntime,game=window.__WAFT_INTERNAL_GAME__;
    if(!api||!game)return requestAnimationFrame(followBird);
    const bird=game.animals?.find?.(item=>item.id===BIRD_ID);
    const state=api.getState?.();
    const dt=Math.max(0,Math.min(.05,(now-lastFollowAt)/1000));lastFollowAt=now;
    if(bird&&state&&game.mountedAnimalId!==BIRD_ID&&!bird.hidden){
      bird.flightMountReady=true;
      bird.mountable=true;
      bird.speed=0;
      // Keep the companion visibly airborne without letting the old circling AI take control.
      bird.flying=false;bird.landed=false;
      const facing=Number(state.playerFacing)||0;
      const fx=Math.sin(facing),fz=Math.cos(facing),rx=Math.cos(facing),rz=-Math.sin(facing);
      const targetX=state.position.x+rx*3.4-fx*.9;
      const targetZ=state.position.z+rz*3.4-fz*.9;
      const dx=targetX-bird.x,dz=targetZ-bird.z,dist=Math.hypot(dx,dz);
      if(dist>.04){
        const speed=dist>16?22:dist>8?15:8.5;
        const step=Math.min(dist,speed*dt);
        bird.x+=dx/dist*step;bird.z+=dz/dist*step;
        bird.yaw=Math.atan2(dx,dz);
      }
      const surface=api.sampleSurface?.(bird.x,bird.z);
      const baseY=surface?.land?surface.height:(surface?.waterHeight??surface?.height??0);
      const targetY=Math.max(baseY+2.1,state.position.y+.35);
      bird.y+=(targetY-bird.y)*(1-Math.exp(-dt*4.8));
      bird.originX=bird.x;bird.originZ=bird.z;
    }
    requestAnimationFrame(followBird);
  }

  function removeFlightPill(){
    document.getElementById('waftFlightTelemetry')?.remove();
  }

  async function init(){
    injectStyle();blockSelection();
    for(let i=0;i<600;i++){
      if(window.__WAFT_IBERIA_EXPLORER_0242_READY__&&window.WAFTRegionRuntime&&window.__WAFT_INTERNAL_GAME__)break;
      await wait(100);
    }
    if(!window.WAFTRegionRuntime||!window.__WAFT_INTERNAL_GAME__)throw new Error('Iberia Polish: runtime unavailable');
    installCoords();removeFlightPill();updateCoords();
    setInterval(updateCoords,250);
    requestAnimationFrame(followBird);
    window.WAFTIberiaPolish={version:VERSION,updateCoords};
    window.__WAFT_IBERIA_POLISH_0243_READY__=true;
  }

  init().catch(error=>{
    console.error('WAFT Iberia Polish 0.24.3 failed',error);
    window.__WAFT_IBERIA_POLISH_0243_ERROR__=String(error?.message||error);
  });
})();
