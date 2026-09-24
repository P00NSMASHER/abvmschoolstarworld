import test from "node:test";
import assert from "node:assert/strict";
import {eventSpan,mergeAnnualCalendarItems,createSchoolModel} from "../pages/js/school-model.js";

test("eventSpan parses single-day and multi-day school dates",()=>{
  const single=eventSpan("Oct. 16 — Picture Day");
  assert.ok(single);
  assert.equal(single.start.getMonth(),9);
  assert.equal(single.start.getDate(),16);
  assert.equal(single.end.getMonth(),9);
  assert.equal(single.end.getDate(),16);

  const range=eventSpan("Dec. 24 - Jan. 2 — Christmas Break");
  assert.ok(range);
  assert.equal(range.start.getMonth(),11);
  assert.equal(range.start.getDate(),24);
  assert.equal(range.end.getMonth(),0);
  assert.equal(range.end.getDate(),2);
  assert.ok(range.end>range.start);
});

test("annual calendar merge does not duplicate equivalent events",()=>{
  const dynamic=[
    {date:"Oct. 12",label:"School Closed — Holiday",kind:"holiday"},
    {date:"Nov. 6",label:"12:00 dismissal; Articulation Meeting",kind:"schedule change"},
  ];
  const annual=[
    {date:"Oct. 12",label:"No School",kind:"holiday"},
    {date:"Nov. 6",label:"Articulation Meeting",kind:"meeting"},
    {date:"Dec. 24 - Jan. 2",label:"Christmas Break",kind:"holiday"},
  ];
  const merged=mergeAnnualCalendarItems(dynamic,annual);
  assert.equal(merged.filter(x=>/Oct\. 12/.test(x.date)).length,1);
  assert.ok(merged.some(x=>/Christmas Break/i.test(x.label)));
});

test("school model reads current pack through a live getter",()=>{
  let pack={
    reminders:["Bring folder."],
    importantDates:[],
    subjects:[{subject:"Reading Routine",topics:["Read for 20 minutes."]}],
    lunchMenu:[],
  };
  const model=createSchoolModel(()=>pack);
  assert.equal(model.readingRoutine(),"Read for 20 minutes.");
  pack={...pack,subjects:[{subject:"Reading Routine",topics:["Read together for 15 minutes."]}]};
  assert.equal(model.readingRoutine(),"Read together for 15 minutes.");
});
