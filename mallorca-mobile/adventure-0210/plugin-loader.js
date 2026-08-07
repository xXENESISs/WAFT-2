'use strict';
(async () => {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const names = [0,1,2,3].map(index => `gameplay-plugin.part0${index}.txt`);
  const responses = await Promise.all(names.map(name => fetch(new URL(name, base), { cache: 'no-store' })));
  const failed = responses.find(response => !response.ok);
  if (failed) throw new Error(`${failed.status} al cargar el módulo Adventure`);
  const source = (await Promise.all(responses.map(response => response.text()))).join('');
  (0, eval)(source + '\n//# sourceURL=waft-adventure-0210-gameplay.js');
})().catch(error => {
  console.error(error);
  window.__WAFT_ADVENTURE_0210_ERROR__ = String(error?.message || error);
  const status = document.getElementById('loadText') || document.getElementById('status');
  if (status) status.textContent = 'Falló Adventure: ' + (error?.message || error);
});
