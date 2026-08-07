'use strict';
(() => {
  const BUILD='0.23.3';
  const visibilityCache=new Map();

  function normalizeMounts(){
    const game=window.__WAFT_INTERNAL_GAME__;
    if(!game?.animals)return;
    for(const animal of game.animals){
      // Mundo 1: cabras, tintoreras y buitres eran monturas. Las vacas eran fauna observable.
      if(animal.type==='goat'||animal.type==='shark'||animal.type==='vulture')animal.mountable=true;
    }
  }

  function visible(ctx){
    if(ctx.mounted)return true;
    const {a,api,baseY}=ctx;
    if(typeof api.isAdventureVisible!=='function')return true;
    const state=api.getState?.();
    const pd=state?.position;
    if(pd&&Math.hypot(a.x-pd.x,a.z-pd.z)<7)return true;
    const now=performance.now(),cached=visibilityCache.get(a.id);
    if(cached&&now-cached.at<180)return cached.visible;
    const height=a.type==='vulture'?1.0:a.type==='cow'?1.1:a.type==='goat'?.85:.55;
    const value=api.isAdventureVisible(a.x,(baseY??a.y??0)+height,a.z);
    visibilityCache.set(a.id,{at:now,visible:value});
    return value;
  }

  function drawAnimatedGoat(ctx){
    const {r,a,now,mounted,drawSphere,drawCylinderPart,M}=ctx;
    const game=window.__WAFT_INTERNAL_GAME__;
    const speed=mounted?Math.min(1.8,(game?.playerSpeed||0)/8):Math.min(.65,Math.max(.15,a.speed||.2)*1.8);
    const phase=now*(mounted?.014:.0065)+a.phase;
    const stride=Math.sin(phase)*Math.min(.58,.18+speed*.34);
    const bounce=Math.abs(Math.sin(phase*2))*(mounted?.055:.025)*Math.min(1,speed+.2);
    const base=M.compose(ctx.base,M.t(0,bounce,0),mounted?M.rx(Math.max(-.22,Math.min(.22,ctx.api.getState?.().terrainPitch||0))):M.identity());
    const fur=[.55,.43,.29],fur2=[.65,.51,.35],dark=[.16,.12,.08],horn=[.74,.68,.54];
    drawSphere(r,base,0,.78,0,.79,.45,1.03,fur);
    drawSphere(r,base,0,.93,.96,.31,.29,.39,fur2);
    drawSphere(r,base,0,.84,1.28,.22,.17,.25,[.58,.44,.31]);
    const legs=[[-.45,-.50,1], [.45,-.50,-1],[-.45,.48,-1],[.45,.48,1]];
    for(const [x,z,sign] of legs){
      const swing=stride*sign;
      drawCylinderPart(r,base,x,.34,z+swing*.16,.075,.62,.075,fur,M.rx(swing));
      drawSphere(r,base,x,.055,z+swing*.29,.10,.075,.17,dark);
    }
    drawCylinderPart(r,base,-.18,1.25,.91,.045,.38,.045,horn,M.rz(-.42));
    drawCylinderPart(r,base,.18,1.25,.91,.045,.38,.045,horn,M.rz(.42));
    drawSphere(r,base,0,.66,1.19,.08,.18,.07,[.30,.24,.19]);
  }

  function drawAnimatedCow(ctx){
    const {r,a,now,drawSphere,drawCylinderPart,M}=ctx;
    const phase=now*.0042+a.phase,stride=Math.sin(phase)*.22,bounce=Math.abs(Math.sin(phase*2))*.018;
    const base=M.compose(ctx.base,M.t(0,bounce,0));
    // Más baja y ancha: elimina la silueta de "muñeco gigante" que se veía en la captura.
    const hide=[.52,.22,.12],dark=[.17,.10,.07],cream=[.73,.61,.45],horn=[.74,.69,.57];
    drawSphere(r,base,0,.72,-.05,1.05,.56,1.28,hide);
    drawSphere(r,base,0,1.08,1.08,.43,.37,.43,hide);
    drawSphere(r,base,0,.98,1.48,.34,.24,.30,cream);
    const legs=[[-.62,-.43,1],[.62,-.43,-1],[-.62,.42,-1],[.62,.42,1]];
    for(const [x,z,sign] of legs){const swing=stride*sign;drawCylinderPart(r,base,x,.29,z+swing*.12,.10,.55,.10,hide,M.rx(swing));drawSphere(r,base,x,.035,z+swing*.20,.14,.07,.20,dark);}
    drawCylinderPart(r,base,-.25,1.37,1.20,.035,.25,.035,horn,M.rz(-.55));
    drawCylinderPart(r,base,.25,1.37,1.20,.035,.25,.035,horn,M.rz(.55));
  }

  function installRenderer(){
    const previous=window.WAFTAnimalRenderer0230;
    if(typeof previous!=='function'||previous.__waft0233)return false;
    const upgraded=function(ctx){
      if(!visible(ctx))return;
      const state=ctx.api.getState?.();
      if(ctx.a.type==='goat'){drawAnimatedGoat(ctx);return;}
      if(ctx.a.type==='cow'){drawAnimatedCow(ctx);return;}
      if(ctx.mounted&&ctx.a.type==='vulture'){
        const pitch=state?.terrainPitch||0,roll=state?.terrainRoll||0;
        return previous({...ctx,a:{...ctx.a,landed:false,flying:true},base:ctx.M.compose(ctx.base,ctx.M.rx(pitch),ctx.M.rz(roll))});
      }
      if(ctx.mounted&&ctx.a.type==='shark'){
        const pitch=state?.terrainPitch||0;
        return previous({...ctx,base:ctx.M.compose(ctx.base,ctx.M.rx(pitch))});
      }
      return previous(ctx);
    };
    upgraded.__waft0233=true;
    window.WAFTAnimalRenderer0230=upgraded;
    return true;
  }

  async function init(){
    for(let i=0;i<500;i++){
      if(window.__WAFT_INTERNAL_GAME__&&window.WAFTRegionRuntime&&window.WAFTAnimalRenderer0230)break;
      await new Promise(resolve=>setTimeout(resolve,20));
    }
    normalizeMounts();
    installRenderer();
    const timer=setInterval(()=>{normalizeMounts();installRenderer();},900);
    addEventListener('pagehide',()=>clearInterval(timer),{once:true});
    window.WAFTParity0233={version:BUILD,normalizeMounts,installRenderer};
    window.__WAFT_PARITY_0233_READY__=true;
  }

  init().catch(error=>console.error('WAFT 0.23.3 parity failed',error));
})();
