const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'mallorca-mobile');

function extractParts(files, variable) {
  return files.map((file) => {
    const source = fs.readFileSync(path.join(mobile, file), 'utf8');
    const pattern = new RegExp(`window\\.${variable}(?:\\+)?='([^']*)'`);
    const match = source.match(pattern);
    if (!match) throw new Error(`No se pudo leer ${variable} en ${file}`);
    return match[1];
  }).join('');
}

function gunzipBase64(value, label) {
  try {
    return zlib.gunzipSync(Buffer.from(value, 'base64')).toString('utf8');
  } catch (error) {
    throw new Error(`${label} no es un gzip válido: ${error.message}`);
  }
}

const baseFiles = [
  'v13s-0.js', 'v13s-1.js', 'v13s-2.js', 'v13s-3.js',
  'v13s-4.js', 'v13s-5.js', 'v13s-6a.js', 'v13s-6b.js', 'v13s-7.js'
];
const patchFiles = ['v14p-0.js', 'v14p-1.js'];

const basePacked = extractParts(baseFiles, 'WAFT13_HTML');
const patchPacked = extractParts(patchFiles, 'WAFT14_PATCH');
const baseHtml = gunzipBase64(basePacked, 'La base 0.13');
const operations = JSON.parse(gunzipBase64(patchPacked, 'El parche 0.14'));

let html = baseHtml;
for (let index = operations.length - 1; index >= 0; index -= 1) {
  const [start, end, replacement] = operations[index];
  html = html.slice(0, start) + replacement + html.slice(end);
}

if (!html.includes('<title>WAFT Adventure 0.14')) {
  throw new Error('La reconstrucción terminó, pero no produjo WAFT Adventure 0.14.');
}

const output = path.join(mobile, 'source-014.html');
fs.writeFileSync(output, html);

const terms = [
  'CreateGround', 'CreateGroundFromHeightMap', 'terrain', 'coast', 'shore',
  'water', 'seaLevel', 'heightAt', 'groundHeight', 'ArcRotateCamera',
  'UniversalCamera', 'camera', 'cliff', 'sand', 'rock'
];
const report = [];
for (const term of terms) {
  let from = 0;
  let hits = 0;
  while (hits < 12) {
    const at = html.toLowerCase().indexOf(term.toLowerCase(), from);
    if (at < 0) break;
    const start = Math.max(0, at - 420);
    const end = Math.min(html.length, at + term.length + 720);
    report.push(`\n===== ${term} @ ${at} =====\n${html.slice(start, end)}\n`);
    from = at + term.length;
    hits += 1;
  }
}
fs.writeFileSync(path.join(mobile, 'source-014-terrain-report.txt'), report.join('\n'));
console.log(`Reconstruida WAFT 0.14: ${html.length} caracteres, ${operations.length} operaciones de parche.`);
