import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

const repo = path.resolve(process.cwd());
const mobile = path.join(repo, 'mallorca-mobile');
const outDir = path.join(mobile, 'adventure-0210', 'reference');
fs.mkdirSync(outDir, { recursive: true });

const context = { window: {} };
context.globalThis = context.window;
vm.createContext(context);

const chunkFiles = [
  'v13s-0.js','v13s-1.js','v13s-2.js','v13s-3.js','v13s-4.js','v13s-5.js','v13s-6a.js','v13s-6b.js','v13s-7.js',
  'v14p-0.js','v14p-1.js','v15lp-0.js','v15lp-1.js'
];
for (const file of chunkFiles) {
  const full = path.join(mobile, file);
  if (!fs.existsSync(full)) throw new Error(`Missing World 1 chunk ${file}`);
  vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file });
}

const gunzipBase64 = value => zlib.gunzipSync(Buffer.from(value, 'base64')).toString('utf8');
let html = gunzipBase64(context.window.WAFT13_HTML || '');
const patch14 = JSON.parse(gunzipBase64(context.window.WAFT14_PATCH || ''));
for (let i = patch14.length - 1; i >= 0; i--) {
  const [a,b,text] = patch14[i];
  html = html.slice(0,a) + text + html.slice(b);
}
const patch15 = JSON.parse(gunzipBase64(context.window.WAFT15_PATCH || ''));
let lines = html.match(/[^\n]*\n|[^\n]+$/g) || [];
for (let i = patch15.length - 1; i >= 0; i--) {
  const [a,b,repl] = patch15[i];
  lines.splice(a, b-a, ...repl);
}
html = lines.join('');
if (!html.includes('<title>WAFT Adventure 0.15')) throw new Error('World 1 reconstruction did not reach 0.15');

const sourcePath = path.join(outDir, 'world1-015-source.html');
fs.writeFileSync(sourcePath, html);

const lower = html.toLowerCase();
const terms = [
  'penguin','pingüino','pinguino','mount','montar','montura','buitre','vulture','shark','tibur','myotragus','gineta','lagartija','cabra','vaca','cerdo','curruca',
  'mission','misión','mision','dialog','observar','observ','checkpoint','autoguard','autosave','save','guardar','jump','salto','charged','cargado','run','correr',
  'swim','nadar','vuelo','volar','flight','fly','route','ruta','boat','barco','ferry','puerto','activity','actividad','minigame','minijuego','race','carrera','photo','foto','collect','recolect','object','objeto'
];
const hits = Object.fromEntries(terms.map(term => [term, (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g')) || []).length]).filter(([,count]) => count));

const quoted = [...html.matchAll(/['"`]([^'"`\n]{3,90})['"`]/g)].map(m => m[1]);
const interesting = quoted.filter(text => /ping|buit|tibur|myot|ginet|lagart|cabr|vaca|cerd|curruc|mont|mis|misi|observ|guard|salto|correr|nadar|vuelo|volar|ruta|puerto|barco|actividad|carrera|foto|recolect|objeto/i.test(text));

const functionNames = [...new Set([
  ...[...html.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]),
  ...[...html.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)].map(m => m[1])
])].filter(name => /mount|animal|fauna|mission|quest|jump|swim|fly|flight|route|travel|checkpoint|save|interact|observe|activity|collect|penguin|player/i.test(name));

const ids = [...new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]))];
const buttons = [...new Set([...html.matchAll(/<button[^>]*>([^<]+)<\/button>/gi)].map(m => m[1].trim()))];

const inventory = {
  reconstructedTitle: (html.match(/<title>([^<]+)<\/title>/i)||[])[1] || null,
  bytes: Buffer.byteLength(html),
  lines: html.split('\n').length,
  hits,
  interestingStrings: [...new Set(interesting)].slice(0,400),
  functionNames,
  elementIds: ids,
  buttons,
  generatedAt: new Date().toISOString()
};
fs.writeFileSync(path.join(outDir, 'world1-015-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
console.log(JSON.stringify(inventory, null, 2));
