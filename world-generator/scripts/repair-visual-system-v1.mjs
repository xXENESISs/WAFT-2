import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'world-generator', 'configs', 'visual-system-v1.json');
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const town = config.settlementTypes.find(item => item.id === 'town');
if (!town) throw new Error('Missing settlement type town');
for (const districtId of ['port', 'rural-edge']) {
  if (!town.allowedDistricts.includes(districtId)) town.allowedDistricts.push(districtId);
}

fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(JSON.stringify({ valid: true, repaired: ['town.allowedDistricts'], values: town.allowedDistricts }, null, 2) + '\n');
