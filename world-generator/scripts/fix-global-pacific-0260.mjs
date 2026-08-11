import fs from 'node:fs';
const file='mallorca-mobile/adventure-0210/global-atlas-0260.js';
let s=fs.readFileSync(file,'utf8');
const wrong="if(pos&&px>WORLD_EAST_X-420){gl.uniform1f(tDetailEnabled,0);gl.uniform1f(tOffsetX,-WORLD_WIDTH);gl.drawElements(gl.TRIANGLES,state.mesh.count,gl.UNSIGNED_INT,0);state.pacificCopies++;}else if(pos&&px<WORLD_WEST_X+420){gl.uniform1f(tDetailEnabled,0);gl.uniform1f(tOffsetX,WORLD_WIDTH);gl.drawElements(gl.TRIANGLES,state.mesh.count,gl.UNSIGNED_INT,0);state.pacificCopies++;}";
const right="if(pos&&px>WORLD_EAST_X-420){/*WAFT_GLOBAL_PACIFIC_VISUAL_FIX_0260*/gl.uniform1f(tDetailEnabled,0);gl.uniform1f(tOffsetX,WORLD_WIDTH);gl.drawElements(gl.TRIANGLES,state.mesh.count,gl.UNSIGNED_INT,0);state.pacificCopies++;}else if(pos&&px<WORLD_WEST_X+420){gl.uniform1f(tDetailEnabled,0);gl.uniform1f(tOffsetX,-WORLD_WIDTH);gl.drawElements(gl.TRIANGLES,state.mesh.count,gl.UNSIGNED_INT,0);state.pacificCopies++;}";
if(s.includes(wrong))s=s.replace(wrong,right);
else if(!s.includes('WAFT_GLOBAL_PACIFIC_VISUAL_FIX_0260'))throw new Error('Pacific visual draw anchor missing');
fs.writeFileSync(file,s);
console.log(JSON.stringify({valid:true,version:'0.26.0',eastCopy:'+WORLD_WIDTH',westCopy:'-WORLD_WIDTH'},null,2));
