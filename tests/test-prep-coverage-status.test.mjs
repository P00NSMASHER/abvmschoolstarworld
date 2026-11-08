import test from 'node:test';
import assert from 'node:assert/strict';
import {createMaterialsView} from '../pages/study-games-materials-view.mjs';

const events=[
 {date:'2026-11-11',label:'Reading',kind:'test'},
 {date:'2026-11-12',label:'Grammar (singular & plural nouns)',kind:'test'},
 {date:'2026-11-13',label:'Spelling (3 letter blends) / Handwriting',kind:'test'},
];

const modelFor=(topicCounts=[8,8,8],{teacherTopic=true,readingGames=12,events:listed=events}={})=>({
 upcomingTests(){return {
  tests:listed,supported:listed.map((row,index)=>({...row,index,key:row.date+'|'+row.label,count:topicCounts[index]||0})).filter(row=>row.count),
  missing:listed.map((row,index)=>({...row,index,key:row.date+'|'+row.label,count:topicCounts[index]||0})).filter(row=>!row.count),
  fallback:[],completed:[],
 };},
 testPreview(index){return {total:topicCounts[index]||0,teacherTopicOnly:teacherTopic&&index===0,
  practice:{label:'Original reviewed practice'},topics:[],retryCount:0};},
 forMode(mode){return {count:mode==='reading'?readingGames:0};},
});
const htmlFor=model=>{
 const view=createMaterialsView({win:{location:{hash:'#study?prep=1'}}});
 view.setModel(model);return view.priorityHtml({loading:false});
};

test('topic-aligned Reading is counted and labeled without claiming exact assessment coverage',()=>{
 const html=htmlFor(modelFor());
 assert.match(html,/data-test-coverage[^>]*>8 teacher-topic questions</);
 assert.match(html,/data-test-topic-aligned/);
 assert.match(html,/Reading[^<]*<\/strong><small>[^<]*8 teacher-topic questions/s);
 assert.match(html,/Grammar[^<]*<\/strong><small>[^<]*8 matching questions/s);
 assert.match(html,/Spelling[^<]*<\/strong><small>[^<]*8 matching questions/s);
 assert.doesNotMatch(html,/data-test-missing/);
 assert.doesNotMatch(html,/data-general-reading-link/);
});

test('unscoped generic Reading shows zero matching items and a safe navigation back to existing Reading games',()=>{
 const html=htmlFor(modelFor([0,8,8],{teacherTopic:false}));
 assert.match(html,/data-test-coverage[^>]*>0 matching questions</);
 assert.match(html,/data-test-missing/);
 assert.match(html,/data-general-reading-link/);
 assert.match(html,/not confirmed test questions/i);
 assert.match(html,/data-test-single="0"[^>]*disabled/);
 assert.match(html,/data-close-prep/);
});

test('do not suggest nonexistent general Reading games or generic games for named text-set assessments',()=>{
 const noGames=htmlFor(modelFor([0,8,8],{teacherTopic:false,readingGames:0}));
 assert.doesNotMatch(noGames,/data-general-reading-link/);
 const named=htmlFor(modelFor([0],{teacherTopic:false,events:[{date:'2026-11-11',label:'Reading (Unit 3 Text Set 2)',kind:'test'}]}));
 assert.doesNotMatch(named,/data-general-reading-link/);
 assert.match(named,/0 matching questions/);
});
