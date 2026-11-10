import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('phase 4 offline versions match page, bootloader, CSS and cache identity',()=>{
 const html=read('pages/index.html'),sw=read('pages/sw.js'),app=read('pages/app.js');
 const htmlVersion=html.match(/abvm-sw-reloaded-v(\d+)/)?.[1];
 const cacheVersion=sw.match(/abvm-grade2-parent-companion-v(\d+)-/)?.[1];
 assert(htmlVersion,'the installed app must expose a reload version');
 assert(cacheVersion,'the service worker must expose an offline cache version');
 assert(Number(htmlVersion)>=209,'retain the phase 4 minimum offline release version');
 assert.equal(htmlVersion,cacheVersion,'bootloader and worker must advance together');
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
 assert.match(app,/target\.matches\("\[data-game-counter\],\[data-game-counter-reset\]"\)/);
 const step=app.split('if(target.matches("[data-game-counter],[data-game-counter-reset]"))')[1].split('if(target.matches("[data-game-save-retry]"))')[0];
 assert.match(step,/updateScratchCounter\(g\.counterValue,delta\)/);
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
