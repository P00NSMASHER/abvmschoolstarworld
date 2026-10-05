import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context={window:{},localStorage:{getItem:()=>null,setItem:()=>{}}};
for(const name of ['study-practice','study-games'])vm.runInNewContext(fs.readFileSync(new URL('../pages/'+name+'.js',import.meta.url),'utf8'),context);
test('empty and malformed notes are omitted; teacher text is preserved',()=>{
 const api=context.window.ABVMStudyPractice;
 assert.equal(api.notes({topics:[' ',null],studyNotes:['']}).length,0);
 assert.equal(api.notes({topics:[' Teacher lesson ']}).join(''),'Teacher lesson');
 assert.equal(api.notes({topics:'not-an-array',studyNotes:null}).length,0);
 for(const key of ['math','reading','spelling','sight','vocabulary','religion']){
   assert.match(api.html(key),/Try it together/);assert.match(api.html(key),/Show answer &amp; explanation|Show answer & explanation/);
 }
});
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
