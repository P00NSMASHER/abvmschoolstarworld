import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('phase 4 offline versions match page, bootloader, CSS and cache identity',()=>{
 const html=read('pages/index.html'),sw=read('pages/sw.js'),app=read('pages/app.js');
 assert.match(html,/abvm-sw-reloaded-v209/);
 assert.match(sw,/abvm-grade2-parent-companion-v209-phase4-iphone-learning/);
 for(const name of ['study-games-materials.css?v=23','app.js?v=173']){
   assert.ok(html.includes(name),name+' in HTML');
   assert.ok(sw.includes(name),name+' in service worker');
 }
 for(const name of ['study-games.js?v=107','study-games-view.js?v=16']){
   assert.ok(sw.includes(name),name+' offline precache');
   assert.ok(app.includes(name),name+' loaded by application');
 }
});
test('phase 4 counter stays optional and has no scoring path',()=>{
 const app=read('pages/app.js'),view=read('pages/study-games-view.js');
 assert.match(app,/if\(target\.matches\("\[data-game-counter\]"\)\)\{changeStudyScratchCounter/);
 assert.match(app,/function changeStudyScratchCounter\(value\)/);
 const step=app.split('function changeStudyScratchCounter(value)')[1].split('function answerStudyGame(index)')[0];
 assert.doesNotMatch(step,/recordLearning|recordAttempt|commitStudyStar|score\+\+|noteRoundLearning|answerStudyGame/);
 assert.match(view,/question\?\.subject!=="Math"\|\|question\?\.skill!=="math-subtraction"/);
 assert.match(view,/aria-label="Add one counter"/);
 assert.match(view,/aria-live="polite"/);
});
test('phase 4 local learning writer verifies bytes, keeps a volatile copy, and exposes explicit retry',()=>{
 const code=read('pages/study-games.js');
 assert.match(code,/localStorage\.getItem\(LEARNING_STORAGE_KEY\)!==serialized/);
 assert.match(code,/lastLearningSnapshot=JSON\.parse\(serialized\)/);
 assert.match(code,/learningStorageStateValue="not-saved"/);
 assert.match(code,/function retrySaveLearning\(\)/);
 assert.match(read('pages/app.js'),/data-game-save-retry/);
});
