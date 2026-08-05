'use strict';
(() => {
  const BUILD_ID = 'waft-visual-lab-0181-v4';
  const wait = () => new Promise(resolve => {
    const tick = () => window.__WAFT_VISUAL_LAB_0181_POLISHED__ === true ? resolve() : setTimeout(tick, 35);
    tick();
  });

  function applyTextureQuality(scene) {
    let upgraded = 0;
    for (const texture of scene.textures) {
      if (!texture || texture.isCube || texture.video) continue;
      try {
        texture.anisotropicFilteringLevel = 16;
        texture.updateSamplingMode?.(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        upgraded++;
      } catch {}
    }
    return upgraded;
  }

  function applyCrispRender(scene) {
    const engine = scene.getEngine();
    engine.setHardwareScalingLevel(1);
    engine.resize();

    scene.fogStart = 64;
    scene.fogEnd = 128;
    scene.imageProcessingConfiguration.exposure = 1.18;
    scene.imageProcessingConfiguration.contrast = 1.08;

    const manager = scene.postProcessRenderPipelineManager;
    const pipelines = manager?._renderPipelines || {};
    for (const pipeline of Object.values(pipelines)) {
      if (!pipeline) continue;
      if ('fxaaEnabled' in pipeline) pipeline.fxaaEnabled = false;
      if ('sharpenEnabled' in pipeline) {
        pipeline.sharpenEnabled = true;
        if (pipeline.sharpen) {
          pipeline.sharpen.edgeAmount = .32;
          pipeline.sharpen.colorAmount = 1.0;
        }
      }
    }

    const camera = scene.activeCamera;
    const sharpen = new BABYLON.SharpenPostProcess('waftCrispSharpen', 1, camera);
    sharpen.edgeAmount = .24;
    sharpen.colorAmount = .95;

    const profile = document.getElementById('profile');
    if (profile) profile.textContent = 'NÍTIDO';

    return {
      hardwareScaling: engine.getHardwareScalingLevel(),
      renderWidth: engine.getRenderWidth(),
      renderHeight: engine.getRenderHeight()
    };
  }

  function sharpenUi() {
    const style = document.createElement('style');
    style.textContent = `
      #renderCanvas{image-rendering:auto}
      .metric strong{letter-spacing:.02em}
      @media(max-height:520px) and (orientation:landscape){
        #topbar{backdrop-filter:blur(5px)}
        #info{backdrop-filter:blur(5px)}
        #sectionNav{backdrop-filter:blur(5px)}
      }
    `;
    document.head.append(style);
  }

  wait().then(() => {
    const scene = BABYLON.Engine.LastCreatedScene;
    if (!scene) throw new Error('No se encontró la escena para la pasada de nitidez.');
    sharpenUi();
    const textureCount = applyTextureQuality(scene);
    const render = applyCrispRender(scene);
    const oldState = window.WAFTVisualLab0181.getState;
    window.WAFTVisualLab0181 = {
      ...window.WAFTVisualLab0181,
      buildId: BUILD_ID,
      getState: () => ({
        ...oldState(),
        buildId: BUILD_ID,
        crispRender: true,
        textureQualityCount: textureCount,
        crispHardwareScaling: render.hardwareScaling,
        crispRenderWidth: render.renderWidth,
        crispRenderHeight: render.renderHeight
      })
    };
    window.__WAFT_VISUAL_LAB_0181_SHARP__ = true;
  }).catch(error => {
    console.error(error);
    window.__WAFT_VISUAL_LAB_0181_SHARP_ERROR__ = String(error?.message || error);
  });
})();
