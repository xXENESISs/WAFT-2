'use strict';
(() => {
  const PHONE_LANDSCAPE = '(orientation: landscape) and (max-height: 650px)';

  function installStyles() {
    if (document.getElementById('waftMobilePolish0231Style')) return;
    const style = document.createElement('style');
    style.id = 'waftMobilePolish0231Style';
    style.textContent = `
      #waftMobileMenuButton{display:none;position:fixed;z-index:41;right:max(7px,env(safe-area-inset-right));top:max(6px,env(safe-area-inset-top));width:42px;height:34px;padding:0;border:1px solid #ffffff38;border-radius:10px;background:rgba(5,18,24,.94);color:#fff;font-size:19px;font-weight:900;box-shadow:0 5px 18px #0008;touch-action:none}
      @media ${PHONE_LANDSCAPE}{
        #hud{left:max(6px,env(safe-area-inset-left))!important;top:max(5px,env(safe-area-inset-top))!important;padding:4px 7px!important;border-radius:9px!important;max-width:28vw!important;box-shadow:0 4px 14px #0006!important}
        #hudTitle{font-size:8px!important;line-height:1.1!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #hudStats,#nearest{display:none!important}

        #waftAdventureHud{left:max(6px,env(safe-area-inset-left))!important;top:max(31px,calc(env(safe-area-inset-top) + 31px))!important;width:min(210px,32vw)!important;min-height:0!important;padding:5px 29px 5px 7px!important;border-radius:10px!important;box-shadow:0 5px 16px #0007!important}
        #waftAdventureHud b,#waftProgress{display:none!important}
        #waftObjective{margin:0!important;font-size:8.5px!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #waftCollapse{right:4px!important;top:4px!important;width:21px!important;height:21px!important;font-size:11px!important}
        #waftAdventureHud.collapsed{width:29px!important;height:29px!important;top:max(31px,calc(env(safe-area-inset-top) + 31px))!important}
        #waftAdventureHud.collapsed #waftCollapse{right:4px!important;top:4px!important}

        #waftGeoHud{top:max(4px,env(safe-area-inset-top))!important;left:50%!important;width:auto!important;min-width:0!important;max-width:42vw!important;padding:4px 8px!important;border-radius:9px!important;box-shadow:0 4px 14px #0006!important}
        #waftGeoLine{font-size:7.7px!important;letter-spacing:0!important;overflow:hidden;text-overflow:ellipsis}
        #waftGeoSub{display:none!important}
        #waftPortNav{top:max(29px,calc(env(safe-area-inset-top) + 29px))!important;max-width:43vw!important;padding:4px 8px!important;border-radius:9px!important;font-size:7.4px!important;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 13px #0006!important}

        #waftMobileMenuButton{display:block}
        #waftTopActions{display:none!important;top:max(43px,calc(env(safe-area-inset-top) + 43px))!important;right:max(6px,env(safe-area-inset-right))!important;left:auto!important;width:108px!important;max-width:none!important;padding:5px!important;gap:4px!important;border-radius:11px;background:rgba(5,18,24,.96);box-shadow:0 8px 24px #000a}
        body.waft-mobile-menu-open #waftTopActions{display:grid!important;grid-template-columns:1fr!important}
        #waftTopActions button{display:block!important;width:100%!important;min-height:31px!important;height:31px!important;padding:0 6px!important;border-radius:8px!important;font-size:8px!important;box-shadow:none!important}
        #waftDestinations{display:block!important}

        #joystick{left:max(10px,env(safe-area-inset-left))!important;bottom:max(10px,env(safe-area-inset-bottom))!important;width:84px!important;height:84px!important;border-width:1.5px!important;box-shadow:inset 0 0 18px rgba(0,0,0,.22)!important}
        #stick{width:34px!important;height:34px!important;left:23px!important;top:23px!important;border-width:1.5px!important}
        #waftJump{right:max(9px,env(safe-area-inset-right))!important;bottom:max(9px,env(safe-area-inset-bottom))!important;width:60px!important;height:60px!important;font-size:8.5px!important;box-shadow:0 5px 16px #0007!important}
        #waftUtility{left:max(101px,calc(env(safe-area-inset-left) + 101px))!important;right:auto!important;bottom:max(10px,env(safe-area-inset-bottom))!important;gap:4px!important}
        #waftUtility button{height:34px!important;min-width:0!important;padding:0 8px!important;border-radius:9px!important;font-size:8px!important;box-shadow:0 4px 13px #0007!important}
        #waftRespawn{display:none!important}

        #waftAdventureAction,#waftObserveAction{left:auto!important;transform:none!important;min-width:0!important;max-width:148px!important;padding:0 10px!important;border-radius:10px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 5px 16px #0008!important}
        #waftAdventureAction{right:max(76px,calc(env(safe-area-inset-right) + 76px))!important;bottom:max(9px,env(safe-area-inset-bottom))!important;height:40px!important;font-size:9px!important}
        #waftObserveAction{right:max(76px,calc(env(safe-area-inset-right) + 76px))!important;bottom:max(53px,calc(env(safe-area-inset-bottom) + 53px))!important;height:31px!important;font-size:7.5px!important}
        #waftMountBadge{display:none!important}
        #waftTravelAction{left:50%!important;right:auto!important;top:max(51px,calc(env(safe-area-inset-top) + 51px))!important;bottom:auto!important;transform:translateX(-50%)!important;min-width:0!important;width:auto!important;max-width:36vw!important;padding:5px 10px!important;border-width:1px!important;border-radius:9px!important;font-size:7.8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;animation:none!important;box-shadow:0 4px 14px #0007!important}

        body.waft-destinations-open #presets{display:flex!important;left:50%!important;bottom:max(78px,calc(env(safe-area-inset-bottom) + 78px))!important;max-width:72vw!important;padding:4px!important;gap:4px!important;border-radius:9px!important}
        #presets button{min-height:30px!important;height:30px!important;padding:0 7px!important;font-size:7.5px!important;border-radius:7px!important}
        #waftPlayToast,#waftToast{font-size:8px!important;padding:5px 8px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function installMenu() {
    if (document.getElementById('waftMobileMenuButton')) return;
    const button = document.createElement('button');
    button.id = 'waftMobileMenuButton';
    button.type = 'button';
    button.setAttribute('aria-label', 'Abrir menú');
    button.textContent = '☰';
    document.body.appendChild(button);
    button.addEventListener('click', () => {
      const open = document.body.classList.toggle('waft-mobile-menu-open');
      button.textContent = open ? '×' : '☰';
      button.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    document.addEventListener('pointerdown', event => {
      if (!document.body.classList.contains('waft-mobile-menu-open')) return;
      if (event.target.closest('#waftTopActions,#waftMobileMenuButton')) return;
      document.body.classList.remove('waft-mobile-menu-open');
      button.textContent = '☰';
    }, true);
    const destinations = document.getElementById('waftDestinations');
    if (destinations) destinations.textContent = 'MAPA';
  }

  function installSharkRenderer() {
    const previous = window.WAFTAnimalRenderer0230;
    if (typeof previous !== 'function' || previous.__waft0231) return;
    const upgraded = function(ctx) {
      if (ctx.a.type !== 'shark') return previous(ctx);
      const { r, a, now, mounted, api, display, base, drawSphere, M } = ctx;
      const state = api.getState?.();
      const pd = state?.displayPosition;
      const dist = pd ? Math.hypot(display.x - pd.x, display.z - pd.z) : 0;
      if (!mounted && dist > 155) return;
      const detail = mounted || dist < 48;
      const blue = [.12,.30,.43], dark = [.075,.20,.31], mid = [.16,.37,.50], belly = [.58,.66,.67], black = [.008,.012,.014];
      const tailSwing = Math.sin(now * .010 + a.phase) * .18;
      const tailRot = M.ry(tailSwing);

      // Blue shark / tintorera: long pointed body, long pectorals and a vertical caudal fin.
      drawSphere(r,base,0,.03,-.02,.42,.27,1.60,blue);
      drawSphere(r,base,0,.025,1.28,.35,.235,.62,mid);
      drawSphere(r,base,0,.015,1.72,.235,.155,.43,mid);
      drawSphere(r,base,0,-.145,.15,.33,.085,1.17,belly);
      drawSphere(r,base,-.54,-.025,.22,.69,.040,.43,dark,M.ry(-.34));
      drawSphere(r,base,.54,-.025,.22,.69,.040,.43,dark,M.ry(.34));
      drawSphere(r,base,0,.37,-.22,.055,.39,.30,dark,M.rx(-.18));
      drawSphere(r,base,0,.035,-1.54,.145,.12,.48,blue,tailRot);
      drawSphere(r,base,0,.31,-1.88,.055,.42,.39,dark,M.compose(tailRot,M.rx(-.12)));
      drawSphere(r,base,0,-.22,-1.90,.050,.28,.31,dark,M.compose(tailRot,M.rx(.12)));

      if (detail) {
        drawSphere(r,base,-.205,.105,1.56,.030,.025,.020,black);
        drawSphere(r,base,.205,.105,1.56,.030,.025,.020,black);
        drawSphere(r,base,0,-.115,1.91,.19,.022,.035,[.06,.08,.085]);
        for (const side of [-1,1]) {
          for (let i=0;i<4;i++) {
            drawSphere(r,base,side*.29,.005,1.02-i*.105,.014,.075,.020,[.055,.12,.16]);
          }
        }
      }
    };
    upgraded.__waft0231 = true;
    window.WAFTAnimalRenderer0230 = upgraded;
  }

  function cleanMobileLabels() {
    const destinations = document.getElementById('waftDestinations');
    if (destinations) destinations.textContent = 'MAPA';
    const run = document.getElementById('waftRun');
    if (run && matchMedia(PHONE_LANDSCAPE).matches && run.textContent === 'CORRIENDO') run.textContent = 'RUN';
  }

  async function init() {
    installStyles();
    for (let i=0;i<400;i++) {
      if (window.__WAFT_PLAYABILITY_0230_READY__ && window.WAFTAnimalRenderer0230) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    installMenu();
    installSharkRenderer();
    cleanMobileLabels();
    window.__WAFT_MOBILE_POLISH_0231_READY__ = true;
  }

  init().catch(error => console.error('WAFT 0.23.1 mobile polish failed', error));
})();
