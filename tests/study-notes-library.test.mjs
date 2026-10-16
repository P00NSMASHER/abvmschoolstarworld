import test from 'node:test';
import assert from 'node:assert/strict';
import {notesLibraryData,renderNotesLibrary} from '../pages/study-notes-library.mjs';

const data={notes:[
 {subject:'Reading / ELA',kind:'topic',text:'Phonics: Short vowels'},
 {subject:'Reading / ELA',kind:'topic',text:'Phonics: Short vowels'},
 {subject:'Reading / ELA',text:'Say each sound, then blend.'},
 {subject:'Religion',kind:'topic',text:'Chapter 3: Jesus Lives in His Church'},
],vocabulary:[{subject:'Reading / ELA',term:'café',meaning:'A small place to eat.'}],
 lessons:[{id:'saved-1',subject:'Math',title:'Place value',notes:['A hundred has ten tens.'],studiedOn:null}],
 links:[{subject:'Religion',label:'Official Chapter 3 review',url:'https://www.loyolapress.com/review'},{subject:'Religion',label:'Unsafe',url:'javascript:alert(1)'}],warnings:[]};
test('library preserves exact source order, deduplicates presentation and never mutates governed material',()=>{
 const frozen=JSON.parse(JSON.stringify(data));const rows=notesLibraryData(data);
 assert.deepEqual(rows.map(r=>r.subject),['Reading / ELA','Math','Religion']);
 assert.deepEqual(rows[0].original,['Phonics: Short vowels','Say each sound, then blend.']);
 assert.equal(rows[0].topics.length,1);assert.equal(rows[2].links.length,1);
 assert.equal(rows[1].lessons[0].studiedOn,null);assert.deepEqual(data,frozen);
});
test('search finds every word across notes, vocabulary meanings and undated saved lessons',()=>{
 assert.equal(notesLibraryData(data,{query:'SHORT vowels'})[0].topics.length,1);
 assert.equal(notesLibraryData(data,{query:'cafe'})[0].words[0].term,'café');
 assert.equal(notesLibraryData(data,{query:'small eat'})[0].words[0].term,'café');
 assert.equal(notesLibraryData(data,{query:'ten tens'})[0].subject,'Math');
 assert.equal(notesLibraryData(data,{query:'not-here'}).length,0);
 assert.equal(notesLibraryData(data,{query:'Religion'})[0].topics.length,1);
 assert.equal(notesLibraryData(data,{query:'Religion church'})[0].topics.length,1);
 assert.equal(notesLibraryData(data,{query:'warm drink',meaning:row=>row.term==='café'?'A warm drink.':row.meaning})[0].words[0].term,'café');
});
test('library and reader escape source text and preserve accurate empty and undated states',()=>{
 const hostile={notes:[{subject:'<Math>',kind:'topic',text:'<script>alert(1)</script>'}],lessons:[],vocabulary:[],links:[],warnings:[]};
 const html=renderNotesLibrary(hostile,{subject:'<Math>',query:'<script>'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('Search study notes'));assert.ok(html.includes('Back to subjects'));
 assert.ok(renderNotesLibrary(data,{subject:'Math'}).includes('Undated schoolwork'));
 assert.ok(renderNotesLibrary({notes:[]}).includes('No lesson notes are included in this selection.'));
});

test('confirmed subtraction topics get useful original study notes without inventing teacher content',()=>{
 const source={notes:[{subject:'Math',kind:'topic',text:'Math (subtraction)'}]};
 const row=notesLibraryData(source)[0];
 assert.ok(row.explanations.some(section=>section.title==='Subtraction, step by step'));
 const html=renderNotesLibrary(source,{subject:'Math'});
 assert.ok(html.includes('12 − 5 = 7'));assert.ok(html.includes('7 + 5 = 12'));
 assert.ok(html.includes('ABVM worked example'));assert.deepEqual(row.original,['Math (subtraction)']);
 assert.equal(notesLibraryData({notes:[{subject:'Math',kind:'topic',text:'Time'}]})[0].explanations.length,0);
 assert.equal(notesLibraryData(source,{query:'difference'})[0].subject,'Math');
});
test('chapter explanations stay scoped, searchable and separate from exact source wording',()=>{
 const source={notes:[{subject:'Religion',kind:'topic',text:'Chapter 3: Church'},{subject:'Religion',kind:'topic',text:'Chapter 1: Gifts'}],
 explanations:[{subject:'Religion',topic:'Chapter 3: Church',title:'Chapter 3',paragraphs:['Baptism gives new life in grace.'],label:'Class review'}]};
 const row=notesLibraryData(source,{query:'Baptism'})[0];
 assert.deepEqual(row.topics,['Chapter 3: Church']);assert.equal(row.explanations.length,1);
 assert.deepEqual(row.original,['Chapter 3: Church','Chapter 1: Gifts']);
 assert.ok(renderNotesLibrary(source,{subject:'Religion'}).includes('Baptism gives new life in grace.'));
});


test('study-note paragraphs are fully consolidated and visible without a practice panel',()=>{
 const html=renderNotesLibrary({notes:[{subject:'Math',kind:'topic',text:'Compare numbers'},{subject:'Math',kind:'study-note',text:'Compare hundreds, then tens, then ones.'}]},{subject:'Math'});
 assert.ok(html.includes('<p>Compare hundreds, then tens, then ones.</p>'));
 assert.ok(!html.includes('Practice ideas'));assert.ok(!html.includes('-ideas'));
 assert.ok(!/study-note-review[^>]*><summary/.test(html));
});
