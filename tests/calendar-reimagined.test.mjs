import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../pages/product-view.js',import.meta.url),'utf8'),sandbox);
const view=sandbox.window.ABVMProductView;
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fixture={year:2026,month:9,now:new Date(2026,9,12,12),selected:new Date(2026,9,14,12),eventItemsForDate:()=>[],kindClass:e=>e.kind,fmtDate:d=>key(d)};

test('calendar civil-date parser round-trips valid days at local noon',()=>{
  assert.equal(typeof view.calendarDate,'function');
  for(const k of ['2026-10-12','2026-11-01','2027-03-14','2028-02-29']){
    const d=view.calendarDate(k);assert.equal(key(d),k);assert.equal(d.getHours(),12);
  }
});
test('calendar civil-date parser rejects ambiguous and impossible dates',()=>{
  assert.equal(typeof view.calendarDate,'function');
  for(const k of ['',null,'2026-02-29','2026-13-01','2026-10-32','2026-10-12T00:00:00Z','10/12/2026','0000-01-01'])assert.equal(view.calendarDate(k),null);
});
test('calendar month stepping clamps month ends without changing a day into March',()=>{
  assert.equal(typeof view.calendarShift,'function');
  assert.equal(key(view.calendarShift(new Date(2027,0,31,12),1)),'2027-02-28');
  assert.equal(key(view.calendarShift(new Date(2028,0,31,12),1)),'2028-02-29');
  assert.equal(key(view.calendarShift(new Date(2026,11,31,12),1)),'2027-01-31');
  assert.equal(key(view.calendarShift(new Date(2027,0,15,12),-1)),'2026-12-15');
});
test('month grid completes full weeks without changing current-month date selectors',()=>{
  assert.equal(typeof view.calendarGrid,'function');
  const html=view.calendarGrid(fixture);
  assert.equal((html.match(/data-cal-day=/g)||[]).length,31);
  assert.equal((html.match(/data-cal-jump=/g)||[]).length,4);
  assert.match(html,/data-cal-day="2026-10-14"/);
  assert.match(html,/aria-current="date"/);
  assert.equal((html.match(/tabindex="0"/g)||[]).length,1);
});
test('six-row months and leap February render every valid date exactly once',()=>{
  assert.equal(typeof view.calendarGrid,'function');
  const august=view.calendarGrid({...fixture,month:7,selected:new Date(2026,7,1,12)});
  assert.equal((august.match(/<button /g)||[]).length,42);
  const feb=view.calendarGrid({...fixture,year:2028,month:1,selected:new Date(2028,1,29,12)});
  assert.equal((feb.match(/data-cal-day=/g)||[]).length,29);
  assert.match(feb,/data-cal-day="2028-02-29"/);
});
test('busy grid dates expose text and overflow without losing any accessible event title',()=>{
  assert.equal(typeof view.calendarGrid,'function');
  const events=[{label:'First verified test',kind:'test'},{label:'Second verified test',kind:'test'},{label:'School meeting',kind:'family'},{label:'Paper due',kind:'due'}];
  const html=view.calendarGrid({...fixture,eventItemsForDate:d=>d.getDate()===14?events:[]});
  for(const e of events)assert.ok(html.includes(e.label));
  assert.match(html,/cal-event-preview/);assert.match(html,/cal-overflow/);assert.match(html,/2 tests/);
});
test('calendar labels and source details escape untrusted school text',()=>{
  assert.equal(typeof view.calendarEvent,'function');
  const html=view.calendarEvent({label:'<img src=x onerror=alert(1)>',kind:'school event',date:'Oct 14',sourceDocument:'<source>',source:'uploaded-notice'},'family');
  assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;source&gt;'));
  assert.match(html,/Time not listed/);assert.match(html,/Reviewed school notice/);
});
test('closure text is explicit and a missing event time is never invented',()=>{
  assert.equal(typeof view.calendarEvent,'function');
  const html=view.calendarEvent({label:'No School',kind:'holiday',date:'Oct 12'},'closed');
  assert.match(html,/No school/);assert.ok(!html.includes('All day'));
});
test('calendar redesign is admitted to unchanged fail-closed source parity',()=>{
  const workflow=fs.readFileSync(new URL('../.github/workflows/preview-source-parity.yml',import.meta.url),'utf8');
  assert.ok(workflow.includes("github.head_ref == 'design/calendar-reimagined-20261012'"));
  assert.ok(workflow.includes('node scripts/assert-release-preview-parity.mjs'));
  assert.ok(workflow.includes('persist-credentials: false'));
});
