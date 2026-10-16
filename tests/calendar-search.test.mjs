import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(readFileSync(new URL('../pages/product-view.js',import.meta.url),'utf8'),{window,console,Intl,Date});
const view=window.ABVMProductView;
const rows=[
  {date:new Date(2026,10,21,12),range:[new Date(2026,10,21,12),new Date(2026,10,21,12)],item:{label:'Reading Royals Family Night',kind:'School event',date:'Nov. 21'}},
  {date:new Date(2026,9,22,12),range:[new Date(2026,9,22,12),new Date(2026,9,22,12)],item:{label:'Chick-fil-A Delivery',kind:'School event',date:'Oct. 22'}},
  {date:new Date(2026,9,19,12),range:[new Date(2026,9,19,12),new Date(2026,9,20,12)],item:{label:'Parent / Teacher Conferences',kind:'School event',date:'Oct. 19–20'}},
];
test('calendar search matches all dates, all query words and punctuation variants',()=>{
  assert.equal(typeof view.searchCalendarEvents,'function');
  assert.equal(view.searchCalendarEvents(rows,'ROYALS family')[0].item.label,'Reading Royals Family Night');
  assert.equal(view.searchCalendarEvents(rows,'chickfila')[0].item.label,'Chick-fil-A Delivery');
  assert.equal(view.searchCalendarEvents(rows,'Oct 20')[0].item.label,'Parent / Teacher Conferences');
  assert.equal(view.searchCalendarEvents(rows,'2026-11-21')[0].item.label,'Reading Royals Family Night');
  assert.equal(view.searchCalendarEvents(rows,'royals october').length,0);
  assert.equal(view.searchCalendarEvents(rows,'   ').length,0);
});
test('search results are chronological, deduplicated and never mutate canonical events',()=>{
  const before=JSON.stringify(rows);
  const results=view.searchCalendarEvents([...rows,rows[0]],'school');
  assert.deepEqual(Array.from(results,row=>row.item.label),['Parent / Teacher Conferences','Chick-fil-A Delivery','Reading Royals Family Night']);
  assert.equal(JSON.stringify(rows),before);
  assert.equal(view.searchCalendarEvents([{date:new Date('invalid'),item:{label:'Royals'}},...rows],'royals').length,1);
});
test('calendar search markup safely escapes queries and event labels',()=>{
  const html=view.calendarSearch('Royals',rows);
  assert.match(html,/type="search"/);
  assert.match(html,/aria-label="Search calendar events"/);
  assert.match(html,/role="status"/);
  assert.match(html,/data-cal-search-date="2026-11-21"/);
  assert.match(view.calendarSearch('zzzz',rows),/No matching events/);
  assert.doesNotMatch(view.calendarSearch('<img src=x onerror=alert(1)>',rows),/<img src=x/);
  assert.match(view.calendarSearch('x',[{date:new Date(2026,0,1,12),item:{label:'<script>x</script>'}}]),/&lt;script&gt;/);
});

test('a new source snapshot updates search results without reusing the old index',()=>{
  const first=[rows[0]];
  assert.equal(view.searchCalendarEvents(first,'lego').length,0);
  const refreshed=[...first,{date:new Date(2026,9,23,12),item:{label:'Lego Club',kind:'Club'}}];
  assert.equal(view.searchCalendarEvents(refreshed,'lego').length,1);
  assert.equal(view.searchCalendarEvents(first,'lego').length,0);
});
