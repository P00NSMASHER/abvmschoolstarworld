import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshSources,inspectReview} from '../scripts/check-religion-sources.mjs';
const page='<script src="/scripts/colisr2.js"></script><script src="/scripts/init_isr_opmz.js"></script>';
const data=c=>`/* col_g2_s${c}.js */ var questionCount=1; qstn[0].text="stub"; qstn[0].answer=0;`;
test('new chapter requires explicit matching URL plus verified page/data identity',async()=>{
 const doc={chapters:[{chapter:5,url:'https://isr.christourlife.com/col_g2_s5'},{chapter:6,url:'https://example.com'}]};
 let calls=0;await refreshSources(doc,async url=>{calls++;return {status:200,text:url.endsWith('.js')?data(5):page}});
 assert.equal(doc.chapters[0].status,'verified');assert.equal(doc.chapters[1].status,'unverified');assert.equal(calls,2);
 assert.equal(inspectReview(page,data(4),5).schemaPresent,false);
});
test('unavailable publisher retains last-known proof with explicit stale state',async()=>{
 const doc={chapters:[{chapter:2,url:'https://isr.christourlife.com/col_g2_s2',available:true,lastVerifiedAt:'2026-10-04T12:00:00Z'}]};
 await refreshSources(doc,async()=>{throw Error('unavailable')});assert.equal(doc.chapters[0].status,'stale');assert.equal(doc.chapters[0].available,true);assert.equal(doc.chapters[0].stale,true);
});
