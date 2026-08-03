'use strict';

const fs = require('fs');
const path = 'world-generator/build-waft-0160.js';
const source = fs.readFileSync(path, 'utf8');
const needle = 'output.replace("version: \'011\'",';
const replacement = "output.replace(/version: '(?:011|catalunya-001)'/,";
const count = source.split(needle).length - 1;

if (count === 0 && source.includes(replacement)) {
  console.log('Runtime version generation is already region-aware.');
  process.exit(0);
}
if (count !== 1) {
  throw new Error(`Expected one runtime version replacement, found ${count}`);
}
fs.writeFileSync(path, source.replace(needle, replacement));
console.log('Runtime version generation now supports Baleares and Catalunya source identifiers.');
