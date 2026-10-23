import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function buildCardArtManifest({strict=true}={}) {
  const known=JSON.parse(fs.readFileSync(path.join(desktop,'../src/tcg/data/cardCombatPower.json'),'utf8'));
  const manifest={};
  const originals=[...Object.keys(known).map(id=>({id,folder:'cards'})),
    {id:'coop-tetra',folder:'bosses'},{id:'luxury-bag',folder:'relics'}];
  for(const {id,folder} of originals){
    const extension=['webp','png'].find(ext=>fs.existsSync(path.join(desktop,'public/assets',folder,`${id}.${ext}`)));
    if(!extension){if(strict)throw new Error(`Missing card artwork: ${id}`);continue;}
    const assetPath=`${folder}/${id}.${extension}`;
    const buffer=fs.readFileSync(path.join(desktop,'public/assets',assetPath));
    manifest[id]={path:assetPath,sha256:createHash('sha256').update(buffer).digest('hex'),bytes:buffer.length};
  }
  const json=JSON.stringify(manifest,null,2);
  fs.writeFileSync(path.join(desktop,'src/data/cardArtManifest.js'),`// Generated from the original assets. Do not edit hashes manually.\nexport const CARD_ART_MANIFEST = Object.freeze(${json});\n`);
  fs.writeFileSync(path.join(desktop,'../src/tcg/data/cardArtManifest.json'),`${json}\n`);
  return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manifest=buildCardArtManifest({strict:!process.argv.includes('--allow-pending')});
  console.log(`Card artwork manifest: ${Object.keys(manifest).length} assets`);
}
