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
 assert.deepEqual(rows.map(r=>r.subject),['Reading / ELA','Religion','Math']);
 assert.deepEqual(rows[0].original,['Phonics: Short vowels','Say each sound, then blend.']);
 assert.equal(rows[0].topics.length,1);assert.equal(rows[1].links.length,1);
 assert.equal(rows[2].lessons[0].studiedOn,null);assert.deepEqual(data,frozen);
});
test('search finds every word across notes, vocabulary meanings and undated saved lessons',()=>{
 assert.equal(notesLibraryData(data,{query:'SHORT vowels'})[0].topics.length,1);
 assert.equal(notesLibraryData(data,{query:'cafe'})[0].words[0].term,'café');
 assert.equal(notesLibraryData(data,{query:'small eat'})[0].words[0].term,'café');
 assert.equal(notesLibraryData(data,{query:'ten tens'})[0].subject,'Math');
 assert.equal(notesLibraryData(data,{query:'not-here'}).length,0);
 assert.equal(notesLibraryData(data,{query:'Religion'})[0].topics.length,1);
});
test('library and reader escape source text and preserve accurate empty and undated states',()=>{
 const hostile={notes:[{subject:'<Math>',kind:'topic',text:'<script>alert(1)</script>'}],lessons:[],vocabulary:[],links:[],warnings:[]};
 const html=renderNotesLibrary(hostile,{subject:'<Math>',query:'<script>'});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
 assert.ok(html.includes('Search study notes'));assert.ok(html.includes('Back to subjects'));
 assert.ok(renderNotesLibrary(data,{subject:'Math'}).includes('Undated schoolwork'));
 assert.ok(renderNotesLibrary({notes:[]}).includes('No lesson notes are included in this selection.'));
});
