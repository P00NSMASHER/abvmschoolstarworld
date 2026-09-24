import test from "node:test";
import assert from "node:assert/strict";
import {
  kindClass,calendarLabel,calendarCellLabel,primaryCalendarEvent,calendarScheduleEvent,
  scheduleSecondaryEvents,calendarContentEvents,sameCalendarDetail
} from "../pages/js/events.js";

test("event classification handles schedule exceptions and common school events",()=>{
  assert.equal(kindClass({label:"School Closed — Holiday",kind:"holiday"}),"closed");
  assert.equal(kindClass({label:"12:00 dismissal",kind:"schedule change"}),"halfday");
  assert.equal(kindClass({label:"Picture Day"}),"picture");
  assert.equal(kindClass({label:"Dress Down Day"}),"dress");
  assert.equal(kindClass({label:"STAR Testing",kind:"assessment"}),"test");
  assert.equal(kindClass({label:"Lego Club"}),"club");
});

test("primary event priority is deterministic",()=>{
  const events=[
    {label:"Lego Club"},
    {label:"STAR Testing",kind:"assessment"},
    {label:"Picture Day"},
  ];
  assert.equal(primaryCalendarEvent(events).label,"Picture Day");
});

test("schedule event and secondary items stay separately representable",()=>{
  const half={label:"12:00 dismissal; Articulation Meeting",kind:"schedule change"};
  assert.equal(calendarScheduleEvent([half]).label,half.label);
  assert.deepEqual(scheduleSecondaryEvents(half).map(x=>x.label),["Articulation Meeting"]);
  assert.deepEqual(calendarContentEvents([half]).map(x=>x.label),["Articulation Meeting"]);
});

test("calendar labels stay concise",()=>{
  assert.equal(calendarLabel({label:"STAR Testing",kind:"assessment"}),"STAR Testing");
  assert.equal(calendarCellLabel({label:"STAR Testing",kind:"assessment"},""),"STAR");
  assert.equal(calendarCellLabel(null,"Computer"),"Comp.");
});

test("calendar duplicate matching recognizes a special already represented by an event",()=>{
  assert.equal(sameCalendarDetail("Gym class","Gym"),true);
  assert.equal(sameCalendarDetail("Articulation Meeting","Gym"),false);
});


test("calendar labels stay bounded for unusually long event names",()=>{
  const item={label:"Extremely Long Parent Community Celebration and School Gathering",kind:"school"};
  const compact=calendarLabel(item);
  assert.ok(compact.length<=18);
  assert.match(compact,/…$/);
  assert.ok(calendarCellLabel(item,"").split(/\s+/).length<=2);
});

test("closed and half-day events outrank ordinary content deterministically",()=>{
  const events=[
    {label:"Lego Club"},
    {label:"12:00 dismissal",kind:"schedule change"},
    {label:"School Closed — Holiday",kind:"holiday"},
  ];
  assert.equal(primaryCalendarEvent(events).label,"School Closed — Holiday");
  assert.equal(calendarScheduleEvent(events).label,"School Closed — Holiday");
});
