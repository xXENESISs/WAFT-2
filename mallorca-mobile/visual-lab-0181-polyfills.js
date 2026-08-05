'use strict';
(() => {
  if (!window.BABYLON?.Scene) return;
  if (!BABYLON.Scene.prototype.getShadowGeneratorByLight) {
    BABYLON.Scene.prototype.getShadowGeneratorByLight = function getShadowGeneratorByLight(light) {
      return light?.getShadowGenerator?.() || null;
    };
  }
})();
