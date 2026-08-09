import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const regionId=process.argv[2];
if(regionId!=='canarias'){
  console.error('Usage: node world-generator/scripts/build-archipelago-region-0244.mjs canarias');
  process.exit(2);
}
const sourcePath=path.join(here,'build-region-v2.mjs');
const tempPath=path.join(here,'.tmp-build-region-archipelago-0244.mjs');
const needle="assert(landCells > dem.cellCount * .2, `Region contains too little land: ${landCells}/${dem.cellCount}`);";
const replacement="assert(landCells > dem.cellCount * .04, `Archipelago contains too little land: ${landCells}/${dem.cellCount}`);";
const source=fs.readFileSync(sourcePath,'utf8');
const count=source.split(needle).length-1;
if(count!==1)throw new Error(`Expected one continental land-ratio guard, found ${count}`);
fs.writeFileSync(tempPath,source.replace(needle,replacement));
try{
  const result=spawnSync(process.execPath,[tempPath,regionId],{cwd:path.resolve(here,'../..'),stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}finally{
  try{fs.unlinkSync(tempPath);}catch{}
}
