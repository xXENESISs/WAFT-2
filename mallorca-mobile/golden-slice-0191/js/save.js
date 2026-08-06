import{BUILD}from"./config.js";
export function loadSave(){try{const value=JSON.parse(localStorage.getItem(BUILD.saveKey));return value?.version===BUILD.version?value:null}catch{return null}}
export function writeSave(snapshot){localStorage.setItem(BUILD.saveKey,JSON.stringify({version:BUILD.version,savedAt:Date.now(),...snapshot}))}
