import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=file=>readFileSync(new URL('../pages/'+file,import.meta.url),'utf8');

test('installed shell and lazy Study modules precache the exact active versioned assets',()=>{
 const index=page('index.html'),sw=page('sw.js');
 const shell=JSON.parse(sw.match(/const STATIC_SHELL\s*=\s*(\[[\s\S]*?\]);/)[1]);
 const optional=JSON.parse(sw.match(/const OPTIONAL_DATA\s*=\s*(\[[\s\S]*?\]);/)[1]);
 const all=new Set([...shell,...optional]);
 const styles=[...index.matchAll(/href="(\.\/[^"]+\.css\?v=[^"]+)"/g)].map(row=>row[1]);
 assert.ok(styles.length>0);
 for(const url of styles)assert.ok(shell.includes(url),'Render-critical stylesheet is missing from the exact offline shell: '+url);
 const scripts=[...index.matchAll(/src="(\.\/[^"]+\.js\?v=[^"]+)"/g)].map(row=>row[1]);
 for(const url of scripts)assert.ok(all.has(url),'Active script is missing from the offline assets: '+url);
 for(const file of ['app.js','study-games-materials-view.mjs']){
  const imports=[...page(file).matchAll(/["'](\.\/[^"']+\.(?:js|mjs)\?v=\d+)["']/g)].map(row=>row[1]);
  for(const url of imports)assert.ok(all.has(url),'Lazy Study import is missing from offline assets: '+url);
 }
 assert.equal(sw.match(/abvm-grade2-parent-companion-v(\d+)-/)?.[1],index.match(/abvm-sw-reloaded-v(\d+)/)?.[1],'Installed cache and one-time reload must advance together');
});
