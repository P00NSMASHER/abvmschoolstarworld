import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderNotesLibrary} from '../pages/study-notes-library.mjs';

test('similar class explanations are visually consolidated without losing either source wording',()=>{
 const source={notes:[{subject:'Religion',kind:'topic',text:'Chapter 3: Jesus Lives in His Church'}],
   explanations:[
    {subject:'Religion',topic:'Chapter 3: Jesus Lives in His Church',label:'Class notes',paragraphs:['Faith is a gift from God that helps us believe.','The Church lives as Jesus taught.']},
    {subject:'Religion',topic:'Chapter 3: Jesus Lives in His Church',label:'Class review',paragraphs:['Faith: gift from God that helps us believe.','Church leaders act in Jesus name and guide the Church.']}
   ]};
 const original=structuredClone(source);
 const html=renderNotesLibrary(source,{subject:'Religion'});
 assert.match(html,/Alternative original wording \(1\)/);
 assert.match(html,/Faith is a gift from God that helps us believe/);
 assert.match(html,/Faith: gift from God that helps us believe/);
 assert.match(html,/Church leaders act in Jesus name and guide the Church/);
 assert.deepEqual(source,original);
 // Searching must reveal exact matching source wording, not hide it in an alternative.
 const filtered=renderNotesLibrary(source,{subject:'Religion',query:'Faith'});
 assert.ok(!filtered.includes('Alternative original wording'));
 assert.match(filtered,/Class review/);
});

test('different source chapters remain independently readable even when notes overlap',()=>{
 const notes=[{subject:'Religion',kind:'topic',text:'Chapter 2'},{subject:'Religion',kind:'topic',text:'Chapter 3'}];
 const paragraph='Church members learn to help and care for people each day.';
 const html=renderNotesLibrary({notes,explanations:[
  {subject:'Religion',topic:'Chapter 2',label:'Class notes',paragraphs:[paragraph]},
  {subject:'Religion',topic:'Chapter 3',label:'Class notes',paragraphs:[paragraph]}
 ]},{subject:'Religion'});
 assert.equal((html.match(/Church members learn to help and care/g)||[]).length,2,'no cross-chapter hiding');
});

test('only Today, Study and Progress receive the new presentation rules',()=>{
 const css=readFileSync(new URL('../pages/design-polish.css',import.meta.url),'utf8');
 const marker='/* 2026-10-17: learning-first refinements.';
 const appendix=css.slice(css.indexOf(marker));
 assert.ok(appendix.startsWith(marker));
 assert.match(appendix,/\.today-screen/);
 assert.match(appendix,/\.progress-screen/);
 assert.match(appendix,/\.games-screen/);
 assert.doesNotMatch(appendix,/\.calendar-(?:screen|studio)|\.week-screen/);
});

test('offline shell versions align after UI changes',()=>{
 const page=filename=>readFileSync(new URL('../pages/'+filename,import.meta.url),'utf8');
 const html=page('index.html'),worker=page('sw.js'),app=page('app.js'),materials=page('study-games-materials-view.mjs');
 for(const route of ['./design-polish.css?v=19','./app.js?v=164','./product-view.js?v=22']){
  assert.ok(html.includes(route));
  assert.ok(worker.includes(route));
 }
 assert.match(app,/study-games-materials-view\.mjs\?v=16/);
 assert.match(materials,/study-notes-library\.mjs\?v=4/);
 assert.match(worker,/study-games-materials-view\.mjs\?v=16/);
 assert.match(worker,/study-notes-library\.mjs\?v=4/);
 assert.match(worker,/parent-companion-v194-/);
 assert.match(html,/abvm-sw-reloaded-v194/);
});
