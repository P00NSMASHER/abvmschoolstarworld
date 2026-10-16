import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../pages/product-view.js',import.meta.url),'utf8'),sandbox);
const view=sandbox.window.ABVMProductView;

test('month summaries preserve source titles and expose a date jump for each listed day',()=>{
 const rows=[{date:'Tue 13',dayKey:'2026-10-13',labels:['Dress Down Day','Charity DDD']},{date:'Wed 14',dayKey:'2026-10-14',labels:['Mass','Communication Folder']}];
 const html=view.compactMonthCard('October',rows,'current-month-summary');
 assert.equal((html.match(/data-cal-open-date=/g)||[]).length,2);
 assert.match(html,/data-cal-open-date="2026-10-13"/);
 assert.match(html,/data-cal-open-date="2026-10-14"/);
 assert.match(html,/aria-label="View October 13 agenda"/);
 assert.match(html,/Dress Down Day/);
 assert.match(html,/Communication Folder/);
 assert.equal((html.match(/<ul role="list">/g)||[]).length,2);
});

test('next-month jump uses its full civil date, not the current viewed month',()=>{
 const html=view.compactMonthCard('November',[{date:'Tue 3',dayKey:'2026-11-03',labels:['HSA Meeting']}],'next-month-card');
 assert.match(html,/data-cal-open-date="2026-11-03"/);
 assert.match(html,/View November 3 agenda/);
});

test('malformed date keys and unsafe labels are not interpolated into navigation markup',()=>{
 const html=view.compactMonthCard('October',[{date:'Wed 14',dayKey:'2026-10-14" onclick="bad()',labels:['<img src=x onerror=bad()>']}],'current-month-summary');
 assert.doesNotMatch(html,/data-cal-open-date=/);
 assert.doesNotMatch(html,/<img/);
 assert.match(html,/&lt;img/);
});
