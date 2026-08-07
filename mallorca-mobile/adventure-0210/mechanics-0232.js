'use strict';
(() => {
  const BUILD = '0.23.2';

  function installStyles() {
    if (document.getElementById('waftMechanics0232Style')) return;
    const style = document.createElement('style');
    style.id = 'waftMechanics0232Style';
    style.textContent = `
      #waftJump{transition:transform .08s,filter .12s,box-shadow .12s!important}
      #waftJump.charging{filter:brightness(1.18)!important;transform:scale(calc(.98 + min(var(--charge),1)*.08))!important}
      #waftJump.maxed{animation:waftJumpPulse0232 .55s infinite alternate!important}
      #waftJump.mega{
        filter:brightness(1.34)!important;
        animation:waftMegaPulse0232 .34s infinite alternate!important;
        background:radial-gradient(circle at 50% 50%,#6d3d86 0 57%,transparent 59%),conic-gradient(#fff0a3 calc(min(var(--charge),1)*1turn),#ffffff28 0)!important
      }
      @keyframes waftJumpPulse0232{from{box-shadow:0 0 0 3px #f2c76635,0 5px 20px #0007}to{box-shadow:0 0 0 10px #f2c76610,0 5px 20px #0007}}
      @keyframes waftMegaPulse0232{from{box-shadow:0 0 0 5px #df8cff66,0 0 18px #f2c76655,0 5px 20px #0007}to{box-shadow:0 0 0 13px #df8cff18,0 0 30px #f2c76699,0 5px 20px #0007}}
    `;
    document.head.appendChild(style);
  }

  function normalizeMounts() {
    const game = window.__WAFT_INTERNAL_GAME__;
    if (!game?.animals) return;
    for (const animal of game.animals) {
      if (animal.type === 'shark' || animal.type === 'vulture') animal.mountable = true;
    }
  }

  function keepMountsNormalized() {
    normalizeMounts();
    const timer = setInterval(() => {
      if (!window.__WAFT_INTERNAL_GAME__) return;
      normalizeMounts();
    }, 800);
    addEventListener('pagehide', () => clearInterval(timer), { once: true });
  }

  function exposeDiagnostics() {
    window.WAFTMechanics0232 = {
      version: BUILD,
      normalizeMounts,
      get mountables() {
        const animals = window.__WAFT_INTERNAL_GAME__?.animals || [];
        return animals.filter(a => a.mountable).map(a => ({ id:a.id, type:a.type, name:a.name, landed:a.landed, ready:a.flightMountReady }));
      }
    };
  }

  async function init() {
    installStyles();
    for (let i = 0; i < 500; i++) {
      if (window.__WAFT_INTERNAL_GAME__ && window.WAFTRegionRuntime) break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    normalizeMounts();
    keepMountsNormalized();
    exposeDiagnostics();
    window.__WAFT_MECHANICS_0232_READY__ = true;
  }

  init().catch(error => console.error('WAFT 0.23.2 mechanics patch failed', error));
})();
