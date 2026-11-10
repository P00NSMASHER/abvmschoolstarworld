import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudyMaterials} from '../pages/study-materials.mjs';
import {buildRuntimePack} from '../scripts/build-runtime-pack.mjs';
import {renderClassroomStudyGuide} from '../pages/classroom-test-guide.mjs';

const source=JSON.parse(readFileSync(new URL('./fixtures/abvm-source-snapshot-2026-11-09.json',import.meta.url),'utf8'));
const events=[
  {date:'2026-11-12',label:'Grammar (singular & plural nouns)',kind:'test'},
  {date:'2026-11-13',label:'Spelling (3 letter blends) / Handwriting',kind:'test'},
];
const engine=await (async()=>{
  const before=globalThis.window;
  globalThis.window={};
  await import('../pages/study-games.js');
  const value=globalThis.window.ABVMStudyGames;
  globalThis.window=before;
  return value;
})();
function modelFor(data){
  const catalog=engine.buildCatalog(data.pack,{
    sourceKey:engine.sourceKeyFromEnvelope(data.pack,data),
  });
  return createStudyMaterials({
    pack:data.pack,catalog,events,engine,
    now:()=>Date.parse('2026-11-10T15:00:00Z'),
  });
}
test('two consecutive announced worksheets keep six independently checked questions from their own verified skills',()=>{
  for(const data of [source,buildRuntimePack(source)]){
    const model=modelFor(data);
    const tests=model.upcomingTests();
    for(const [index,skill] of [[0,'singular-plural-nouns'],[1,'three-letter-blends']]){
      assert.ok(tests.supported.some(row=>row.index===index&&row.count>=6),skill+' must be available');
      const guide=model.testGuide(index,{upcoming:true});
      assert.equal(guide.key,events[index].date+'|'+events[index].label);
      assert.equal(guide.practice.length,8);
      assert.ok(guide.practice.every(q=>q.skill===skill),'no neighboring teacher topic');
      const html=renderClassroomStudyGuide(guide);
      assert.equal((html.match(/class="problem /g)||[]).length,6);
      assert.match(html,/Parent Answer Key/);
    }
  }
});
test('an actual withdrawn teacher skill cannot be repopulated by an older source snapshot',()=>{
  const data=structuredClone(source);
  data.pack.contentPipeline.questions=data.pack.contentPipeline.questions.filter(row=>row.skill!=='three-letter-blends');
  data.pack.contentPipeline.skills=data.pack.contentPipeline.skills.filter(row=>row.id!=='three-letter-blends');
  const model=modelFor(data);
  const guide=model.testGuide(1,{upcoming:true});
  assert.equal(guide.practice.length,0);
  assert.match(renderClassroomStudyGuide(guide),/No matching original-practice questions are available/);
});
test('preview iframe must be attached before srcdoc and checked test identity is observable',()=>{
  const src=readFileSync(new URL('../pages/study-games-materials-view.mjs',import.meta.url),'utf8');
  assert.ok(src.indexOf('doc.body.append(dialog);')<src.indexOf('frame.srcdoc = printableHtml;'));
  assert.match(src,/dialog.setAttribute\('data-guide-practice-count'/);
  assert.match(src,/dialog.setAttribute\('data-guide-test-key'/);
});
