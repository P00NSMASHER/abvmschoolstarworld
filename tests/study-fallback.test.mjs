import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.runInNewContext(fs.readFileSync(new URL('../pages/study-games.js',import.meta.url),'utf8'),context);
test('both Math fallback variants have correct place values and comparison explanations',()=>{
 const variants=new Set();
 for(const sourceKey of ['fallback-check-a','fallback-check-b']){
   const c=context.window.ABVMStudyGames.buildCatalog({subjects:[],contentPipeline:{skills:[]}},{sourceKey});variants.add(c.generationVariant);
   const q=c.questions.find(q=>q.id.startsWith('star-math-place'));
   assert.equal(Math.floor(Number(q.prompt.match(/number (\d+)/)[1])/10)%10,6);assert.equal(q.answer,'60');
   const comparison=c.questions.find(q=>q.id.startsWith('star-math-compare'));
   if(c.generationVariant===2)assert.match(comparison.explanation,/ones: 1 is less than 8/);
 }
 assert.equal(variants.size,2);
});
