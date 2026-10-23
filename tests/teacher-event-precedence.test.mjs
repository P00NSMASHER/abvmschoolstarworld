import assert from 'node:assert/strict';
import test from 'node:test';
import {supersededByReviewedPlanner} from '../scripts/teacher-event-precedence.mjs';

function evidence(){
  const id='melissa-weekly-planner-2026-10-12-user-reviewed';
  return {
    sourcePrecedence:{authoritativeCurrentDocument:id},
    documents:[{id,review:{status:'reviewed',reviewedBy:'user-confirmed-Melissa-planner'}}],
    replacements:[
      {topic:'chick-fil-a-delivery',date:'Thursday, Oct. 22'},
      {topic:'lego-club',date:'Friday, Oct. 23'},
      {topic:'term-progress-reports',date:'Wednesday, Oct. 14'}
    ],
    importantDates:[
      {date:'Thursday, Oct. 22',label:'Chick-fil-A Delivery',sourceDocument:id},
      {date:'Friday, Oct. 23',label:'Lego Club',sourceDocument:id},
      {date:'Wednesday, Oct. 14',label:'Progress Reports Sent Home',sourceDocument:id},
    ],
  };
}

function yearBoundaryEvidence(){
  const id='melissa-weekly-planner-2026-12-28-user-reviewed';
  return {
    sourcePrecedence:{authoritativeCurrentDocument:id},
    documents:[{id,review:{status:'reviewed',reviewedBy:'user-confirmed-Melissa-planner'}}],
    replacements:[{topic:'lego-club',date:'Tuesday, Jan. 5'}],
    importantDates:[{date:'Tuesday, Jan. 5',label:'Lego Club',sourceDocument:id}],
  };
}

test('dated, reviewed Melissa planner supersedes contradictory teacher Home pickup date',()=>{
  assert.equal(supersededByReviewedPlanner({
    date:'Thursday, Oct. 23',label:'Chick-Fil-A pick up',source:'teacher-home'
  },evidence()),true);
  assert.equal(supersededByReviewedPlanner({
    date:'Thursday, Oct. 22',label:'Chick-fil-A delivery',source:'teacher-home'
  },evidence()),false);
});
test('old Lego and progress dates lose only to exact newer reviewed corrections',()=>{
  assert.equal(supersededByReviewedPlanner({
    date:'Monday, Oct. 19',label:'Lego Club',source:'teacher-home'
  },evidence()),true);
  assert.equal(supersededByReviewedPlanner({
    date:'Thursday, Oct. 8',label:'Progress Reports Sent Home',source:'teacher-home'
  },evidence()),true);
});
test('reviewed corrections remain authoritative across December to January',()=>{
  assert.equal(supersededByReviewedPlanner({
    date:'Thursday, Dec. 31',label:'Lego Club',source:'teacher-home'
  },yearBoundaryEvidence()),true);
  assert.equal(supersededByReviewedPlanner({
    date:'Friday, Nov. 20',label:'Lego Club',source:'teacher-home'
  },yearBoundaryEvidence()),false);
});
test('never erase sales, order deadlines, unrelated dates or independently authored notices',()=>{
  for(const row of [
    {date:'Friday, Oct. 9',label:'Chick-fil-A orders and money due',source:'teacher-home'},
    {date:'Wednesday, Sept. 30',label:'Chick-fil-A sale starts',source:'teacher-home'},
    {date:'Friday, Nov. 20',label:'Chick-fil-A delivery',source:'teacher-home'},
    {date:'Thursday, Oct. 23',label:'Chick-Fil-A pick up',source:'uploaded-notice'},
    {date:'Thursday, Oct. 23',label:'Chick-Fil-A pick up',source:'teacher-tests'},
    {date:'Thursday, Oct. 23',label:'No school',source:'teacher-home'},
  ])assert.equal(supersededByReviewedPlanner(row,evidence()),false,row.label);
});
test('cannot suppress events without an actual reviewed matching authority and replacement',()=>{
  const event={date:'Thursday, Oct. 23',label:'Chick-fil-A pick up',source:'teacher-home'};
  for(const mutate of [
    d=>d.documents[0].review.status='HOLD',
    d=>d.sourcePrecedence.authoritativeCurrentDocument='unknown',
    d=>d.replacements=[],
    d=>d.importantDates=[],
    d=>d.replacements[0].date='Friday, Oct. 24',
    d=>d.importantDates[0].date='Friday, Oct. 24',
  ]){
    const d=evidence();mutate(d);
    assert.equal(supersededByReviewedPlanner(event,d),false);
  }
});
