import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const loaderPath = 'mallorca-mobile/build-waft-0156.mjs';
const loader = fs.readFileSync(loaderPath, 'utf8');
const match = loader.match(/const packed = '([A-Za-z0-9+/=]+)'/);
if (!match) throw new Error('Packed WAFT 0.15.6 builder payload not found');
let source = gunzipSync(Buffer.from(match[1], 'base64')).toString('utf8');
source = source.replace("String.raw`function actorShapes()", "`function actorShapes()");
const temporary = path.resolve('mallorca-mobile/.build-waft-0156-fixed.mjs');
fs.writeFileSync(temporary, source);
try {
  await import(`${pathToFileURL(temporary).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporary, { force: true });
}
