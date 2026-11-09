import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTestWorksheet} from '../pages/test-study-pair.mjs';

const question=(id,answer,choices=['Other idea',answer,'Another idea'])=>({
  id:'original-'+id,skill:'reviewed-lesson',prompt:'What matches original idea '+id+'?',
  answer,choices,explanation:'Checked original reason '+id+'.',
});
const guide=(label,practice,extra={})=>({
  label,subject:'Religion',date:'2026-11-09',practice,
  sourceLabel:'Reviewed class topic — original home practice',warnings:[],...extra
});
const split=html=>html.split('<section class="sheet adult-key">');

test('observed Chapter 1 word-bank format prints checked original questions with shuffled bank, writing lines and separate parent key',()=>{
  const items=[question(1,'Baptism'),question(2,'Grace'),question(3,'Holy Spirit')];
  const [student,key]=split(renderTestWorksheet(guide('Religion Chapter 1',items)));
  assert.match(student,/class="teacher-word-bank"/);
  assert.match(student,/class="word-bank-words"/);
  assert.match(student,/class="paper-problems word-bank-problems /);
  assert.equal((student.match(/class="problem word-bank-item"/g)||[]).length,3);
  assert.equal((student.match(/aria-label="Write an answer from the word bank"/g)||[]).length,3);
  for(const answer of items.map(item=>item.answer))assert.match(student,new RegExp('<li>'+answer+'</li>'));
  assert.match(student,/next test format is not guaranteed/);
  assert.doesNotMatch(student,/Other idea|Another idea|Checked original reason|school-issued assessment: yes/i);
  assert.match(key,/1\.<\/b> Baptism/);
  assert.match(key,/3\.<\/b> Holy Spirit/);
  assert.match(key,/Checked original reason 3/);
  const words=[...student.matchAll(/class="word-bank-words">([\s\S]*?)<\/ul>/g)][0][1];
  assert.ok(words.indexOf('Baptism')>words.indexOf('Grace'),'word bank order must not give away answer sequence');
});

test('unverified, duplicated, leaked and unsuitable answer banks keep the original checked response options',()=>{
  const items=[question(1,'Baptism'),question(2,'Grace')];
  for(const value of [
    guide('Religion Chapter 7',items),
    guide('Religion Chapter 1',[items[0],question(2,'Baptism')]),
    guide('Religion Chapter 1',[{...items[0],prompt:'Who explained Baptism? '},items[1]]),
    guide('Religion Chapter 1',[items[0],question(2,'Because God loves us so much, he helps us.')]),
  ]){
    const [student]=split(renderTestWorksheet(value));
    assert.doesNotMatch(student,/class="teacher-word-bank"/);
    assert.match(student,/class="problem pick-problem"/);
  }
});

test('math worksheets show only relevant blank diagrams, without answers or extraneous answer format changes',()=>{
  const place=guide('Math (place value / expanded form)',[
    {skill:'math-place-value',prompt:'Write the expanded form of 347.',answer:'300 + 40 + 7',choices:[],
      explanation:'347 has three hundreds, four tens, seven ones.'},
  ],{subject:'Math'});
  const [student,key]=split(renderTestWorksheet(place));
  assert.match(student,/Empty place-value chart/);
  for(const label of ['Hundreds','Tens','Ones'])assert.match(student,new RegExp(label));
  assert.doesNotMatch(student,/347 has three hundreds/);
  assert.match(key,/347 has three hundreds/);
  const subtraction=guide('Math (subtraction)',[
    {skill:'math-subtraction',prompt:'Solve 15 - 6.',answer:'9',choices:[],explanation:'Count back six.'},
  ],{subject:'Math'});
  assert.match(split(renderTestWorksheet(subtraction))[0],/Number line from zero to twenty/);
  assert.doesNotMatch(split(renderTestWorksheet({...subtraction,practice:[
    {...subtraction.practice[0],prompt:'Solve 115 - 6.',answer:'109'},
  ]}))[0],/Number line from zero to twenty/);
  assert.doesNotMatch(split(renderTestWorksheet({...place,practice:[
    {...place.practice[0],prompt:'Write the expanded form of 1347.'},
  ]}))[0],/Empty place-value chart/);
});

test('unknown test scope cannot create a bank, diagram, questions, or parent answers',()=>{
  const html=renderTestWorksheet(guide('Religion Chapter 1',[question(1,'Baptism')],{scopePending:true}));
  assert.doesNotMatch(html,/teacher-word-bank|math-visual|adult-key|word-bank-item/);
  assert.match(html,/Check your class notes/);
});
