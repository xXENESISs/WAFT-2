import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const builderPath = 'mallorca-mobile/build-waft-0157.mjs';
let source = fs.readFileSync(builderPath, 'utf8');
const oldAnchor = `"else if(player.mount==='cow')base=compose(T(player.x,player.y+1.72,player.z),RY(player.yaw),RX(-.06),S(.70,.70,.70));else if(player.mount==='shark')",\n  "else if(player.mount==='cow')base=compose(T(player.x,player.y+1.72,player.z),RY(player.yaw),RX(-.06),S(.70,.70,.70));else if(player.mount==='pig')base=compose(T(player.x,player.y+1.14,player.z),RY(player.yaw),RX(-.14),S(.66,.66,.66));else if(player.mount==='shark')"`;
const newAnchor = `"else if(player.mount==='cow'){const back=.16;base=compose(T(player.x-Math.sin(player.yaw)*back,player.y+2.60,player.z-Math.cos(player.yaw)*back),RY(player.yaw),RX(-.08),S(.70,.70,.70))}else if(player.mount==='shark')",\n  "else if(player.mount==='cow'){const back=.16;base=compose(T(player.x-Math.sin(player.yaw)*back,player.y+2.60,player.z-Math.cos(player.yaw)*back),RY(player.yaw),RX(-.08),S(.70,.70,.70))}else if(player.mount==='pig'){const back=.12;base=compose(T(player.x-Math.sin(player.yaw)*back,player.y+1.36,player.z-Math.cos(player.yaw)*back),RY(player.yaw),RX(-.14),S(.66,.66,.66))}else if(player.mount==='shark')"`;
if (!source.includes(oldAnchor)) throw new Error('Old penguin mount anchor not found in builder');
source = source.replace(oldAnchor, newAnchor);
const temporary = path.resolve('mallorca-mobile/.build-waft-0157-fixed.mjs');
fs.writeFileSync(temporary, source);
try {
  await import(`${pathToFileURL(temporary).href}?run=${Date.now()}`);
} finally {
  fs.rmSync(temporary, { force: true });
}
