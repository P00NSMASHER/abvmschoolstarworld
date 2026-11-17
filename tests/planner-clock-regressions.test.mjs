import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const appSource=readFileSync(new URL('../pages/app.js',import.meta.url),'utf8');
const viewSource=readFileSync(new URL('../pages/product-view.js',import.meta.url),'utf8');
const homeworkSource=readFileSync(new URL('../pages/homework-feed.js',import.meta.url),'utf8');
const start=appSource.indexOf('window.ABVMProductView.watchSchoolClock(');
const clockController=appSource.slice(start,appSource.indexOf('\nsetInterval(',start));
assert.ok(start>=0&&clockController.includes('render('),'cover the actual app school-clock callback');

function controller({route='week',at='2026-11-16T23:59:50-05:00',gameScreen='menu'}={}){
  let now=Date.parse(at),tick,html='',paints=0;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const window={addEventListener(){}};
  const scope={window,Intl,Date:Clock,document:{visibilityState:'visible',addEventListener(){},querySelector(){return null}},setTimeout:fn=>{tick=fn},pack:{},activeTab:route,gameState:{screen:gameScreen},isStudyRoute:()=>['study','games'].includes(route),rebasePlannerDates(){}};
  vm.runInNewContext(viewSource,scope);
  vm.runInNewContext(homeworkSource,scope);
  const posting={schemaVersion:1,sourceUrl:'https://sites.google.com/view/abvmgr2/homework',sourceDateProvided:false,status:'assignments',checkedAt:'2026-11-16T20:00:00-05:00',firstObservedAt:'2026-11-16T20:00:00-05:00',contentChangedAt:'2026-11-16T20:00:00-05:00',contentHash:'a'.repeat(64),assignments:[{subject:'Math',task:'QA fixture: Monday homework'}]};
  scope.render=()=>{
    paints++;
    const state=window.ABVMHomeworkFeed.forDate(posting,'2026-11-16',new Clock());
    html=window.ABVMProductView.homeworkCard({state,compact:true,items:state.assignments.map((item,index)=>({item,index})),taskHtml:item=>'<button data-homework-check="0">'+item.task+'</button>'});
  };
  scope.render();
  vm.runInNewContext(clockController,scope);
  return{advance(value){now=Date.parse(value);tick()},get html(){return html},get paints(){return paints}};
}

test('Week retires yesterday\'s rendered homework at the Eastern midnight boundary without a source fetch',()=>{
  const app=controller();
  assert.match(app.html,/QA fixture: Monday homework/);
  app.advance('2026-11-17T00:00:00-05:00');
  assert.doesNotMatch(app.html,/data-homework-check|QA fixture: Monday homework/);
  assert.match(app.html,/only today&#39;s verified posting is shown/);
  assert.equal(app.paints,2);
});

test('Calendar refreshes on a new school day but preserves its view at the assessment-only 3 PM boundary',()=>{
  const app=controller({route:'calendar',at:'2026-11-16T14:59:50-05:00'});
  app.advance('2026-11-16T15:00:00-05:00');
  assert.equal(app.paints,1);
  app.advance('2026-11-17T00:00:00-05:00');
  assert.equal(app.paints,2);
});

test('school-clock rollover still leaves an active Study question untouched',()=>{
  const app=controller({route:'study',gameScreen:'play'});
  app.advance('2026-11-17T00:00:00-05:00');
  assert.equal(app.paints,1);
});

function selectedPlanner({route,at,selected,offset}){
  let now=Date.parse(at),tick;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const sink={innerHTML:''};
  const empty=()=>'',rows=()=>[];
  const window={addEventListener(){},ABVMSchoolUpdates:{officialCalendarLink:empty},ABVMWeeklyLearning:{renderWeekOverview:empty}};
  const scope={window,Intl,Date:Clock,document:{visibilityState:'visible',addEventListener(){},querySelector(){return null}},setTimeout:fn=>{tick=fn},
    pack:{},activeTab:route,gameState:{screen:'menu'},isStudyRoute:()=>false,
    SCHOOL_DATE_FORMATTER:new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}),
    MONTHS:['January','February','March','April','May','June','July','August','September','October','November','December'],SCHOOL_LOGO_HTML:'',
    calendarDay:route==='calendar'?new Clock(selected):null,calendarOffset:route==='calendar'?offset:0,
    selectedDay:route==='week'?new Clock(selected):null,weekOffset:route==='week'?offset:0,
    stack:()=>sink,header:empty,freshness:empty,taskHtml:empty,kindClass:item=>item.kind||'family',calendarSegments:empty,
    fmtDate:d=>d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}),fmtShort:d=>d.toLocaleDateString('en-US',{weekday:'short'})+' '+d.getDate(),
    sameDay:(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(),
    eventItemsForDate:rows,datedImportantEvents:rows,specialsRows:rows,lunchForDate:()=>null,isPackWeek:()=>false,
    taskRecordsForSurface:rows,homeworkCardForDate:empty,lunchCardHtml:empty,agendaLunchHtml:empty,reminderForDate:empty,
    compactMonthCardHtml:empty,lunchText:empty,lunchUnavailableText:empty};
  vm.runInNewContext(viewSource,scope);
  const section=(from,to)=>appSource.slice(appSource.indexOf('function '+from+'('),appSource.indexOf('function '+to+'('));
  vm.runInNewContext(section('schoolDateParts','isPackWeek')+section('calendarBase','loadStudyRanks')+section('renderWeek','agendaLunchHtml')+section('renderCalendar','selectCalendarDate'),scope);
  if(appSource.includes('function rebasePlannerDates('))vm.runInNewContext(section('rebasePlannerDates','redrawPlanner'),scope);
  scope.render=()=>route==='calendar'?scope.renderCalendar():scope.renderWeek();
  scope.render();
  vm.runInNewContext(clockController,scope);
  return{advance(value){now=Date.parse(value);tick()},get html(){return sink.innerHTML},get selected(){return route==='calendar'?scope.calendarDay:scope.selectedDay},get offset(){return route==='calendar'?scope.calendarOffset:scope.weekOffset}};
}

test('actual Calendar renderer preserves the selected date when the school month rolls over',()=>{
  const app=selectedPlanner({route:'calendar',at:'2026-11-30T23:59:50-05:00',selected:'2026-12-10T12:00:00',offset:1});
  assert.match(app.html,/<h2>December 10<\/h2>/);
  app.advance('2026-12-01T00:00:00-05:00');
  assert.match(app.html,/<h2>December 10<\/h2>/);
  assert.equal(app.offset,0);
});

test('actual Week renderer preserves a future selected day when Friday becomes the weekend',()=>{
  const app=selectedPlanner({route:'week',at:'2026-11-20T23:59:50-05:00',selected:'2026-11-25T12:00:00',offset:1});
  assert.match(app.html,/<h2>Wednesday, November 25<\/h2>/);
  app.advance('2026-11-21T00:00:00-05:00');
  assert.match(app.html,/<h2>Wednesday, November 25<\/h2>/);
  assert.equal(app.offset,0);
});

test('actual Week renderer retains a past selection across a DST weekend and Monday',()=>{
  const app=selectedPlanner({route:'week',at:'2026-10-30T23:59:50-04:00',selected:'2026-10-28T12:00:00',offset:0});
  app.advance('2026-10-31T00:00:00-04:00');
  assert.match(app.html,/<h2>Wednesday, October 28<\/h2>/);
  assert.equal(app.offset,-1);
  app.advance('2026-11-02T00:00:00-05:00');
  assert.match(app.html,/<h2>Wednesday, October 28<\/h2>/);
  assert.equal(app.offset,-1);
});
