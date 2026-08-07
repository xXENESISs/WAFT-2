'use strict';
(async () => {
  const script = document.currentScript;
  const url = new URL('gameplay-plugin.js', script.src);
  url.searchParams.set('v', new URL(script.src).searchParams.get('v') || '0.22.0');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} al cargar el módulo Adventure 0.22.0`);
  const source = await response.text();
  (0, eval)(source + '\n//# sourceURL=waft-adventure-0220-gameplay.js');
})().catch(error => {
  console.error(error);
  window.__WAFT_ADVENTURE_0210_ERROR__ = String(error?.message || error);
  const status = document.getElementById('loadText') || document.getElementById('status');
  if (status) status.textContent = 'Falló Adventure: ' + (error?.message || error);
});
