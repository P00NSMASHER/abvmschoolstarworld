import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../pages/lunch-art.js',import.meta.url),'utf8');
const current=JSON.parse(readFileSync(new URL('../pages/data/lunch-art-current.json',import.meta.url),'utf8'));
const [key,art]=Object.entries(current.approved)[0], [sourceId,items]=JSON.parse(key),meal={sourceId,items};
function harness(initial={schemaVersion:1,approved:{}}){
 let now=Date.now(),calls=0,response=initial,fail=false;
 class Clock extends Date{static now(){return now}}
 const host={fetch:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>response}},AbortController,Date:Clock,setTimeout,clearTimeout};
 vm.runInNewContext(code.replace(/\ninstallLunchArtwork\([^\n]+\);/, '\ninstallLunchArtwork({},globalThis);'),host);
 return {api:host.ABVMLunchArt,set:value=>response=value,fail:value=>fail=value,advance:()=>now+=300001,calls:()=>calls};
}
test('new approved menu imagery appears without replacing the app or losing exact source matching',async()=>{
 const h=harness();assert.equal(h.api.html(meal),'');
 await h.api.refresh();h.set(current);h.advance();let changed=0;
 assert.equal(await h.api.refresh(()=>changed++),true);
 assert.match(h.api.html(meal),/lunch-art-tray/);assert.equal(changed,1);
 assert.equal(h.api.html({...meal,sourceId:'unverified-source'}),'');
 assert.equal(h.api.html({...meal,items:[...items,'Unverified drink']}),'');
});
test('art refresh coalesces requests, bounds repeat checks and retains reviewed offline content',async()=>{
 const h=harness(current);await Promise.all([h.api.refresh(),h.api.refresh(),h.api.refresh()]);assert.equal(h.calls(),1);
 await h.api.refresh();assert.equal(h.calls(),1);
 h.fail(true);h.advance();assert.equal(await h.api.refresh(),false);
 assert.match(h.api.html(meal),/lunch-art-tray/);await h.api.refresh();assert.equal(h.calls(),2);
});
test('malformed, external, undersized and undisclosed artwork updates cannot replace a good map',async()=>{
 const h=harness(current);await h.api.refresh();const before=h.api.html(meal);
 for(const patch of [{src:'https://untrusted.example/private.png'},{width:768},{omissionNote:''},{styleId:'unreviewed'}]){
  h.advance();h.set({schemaVersion:1,approved:{[key]:{...art,...patch}}});
  assert.equal(await h.api.refresh(),false);assert.equal(h.api.html(meal),before);
 }
});
