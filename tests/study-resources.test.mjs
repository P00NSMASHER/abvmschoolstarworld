import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudyResourceLoader, validStudyResource} from '../pages/study-resources.mjs';
const read = name => JSON.parse(readFileSync(new URL('../pages/data/'+name, import.meta.url), 'utf8'));
const response = value => ({ok:true,json:async()=>value});
for (const name of ['schoolwork.json','study-archive.json','religion-sources.json']) {
  test('current governed resource validates: '+name, () => assert(validStudyResource(name, read(name))));
}
test('invalid collection roots fail closed',()=>{
  for(const value of [null,[],5,'bad',{}]) assert.equal(validStudyResource('schoolwork.json',value),false);
  assert.equal(validStudyResource('study-archive.json',{notes:'bad'}),false);
  assert.equal(validStudyResource('study-archive.json',{}),false);
});
test('malformed nested questions and dates fail closed',()=>{
  const data=read('schoolwork.json'); data.lessons[0].questions[0].choices=['wrong','wrong'];
  assert.equal(validStudyResource('schoolwork.json',data),false);
  const archive=read('study-archive.json'); archive.notes[0].provenance=[{capturedAt:'not a date'}];
  assert.equal(validStudyResource('study-archive.json',archive),false);
});
test('a valid empty collection remains valid',()=>{
  assert(validStudyResource('schoolwork.json',{lessons:[]}));
  assert(validStudyResource('study-archive.json',{notes:[],questions:[],vocabulary:[]}));
});
test('simultaneous valid reads share one request',async()=>{
  let calls=0;const load=createStudyResourceLoader(async()=>{calls++;return response({lessons:[]});});
  const [a,b]=await Promise.all([load('schoolwork.json'),load('schoolwork.json')]);
  assert.equal(calls,1);assert.equal(a,b);
});
test('invalid successful HTTP payload is not cached and can be retried',async()=>{
  let calls=0;const load=createStudyResourceLoader(async()=>response(++calls===1?{lessons:'bad'}:{lessons:[]}));
  await assert.rejects(load('schoolwork.json'),/validated/);
  assert.deepEqual(await load('schoolwork.json'),{lessons:[]});assert.equal(calls,2);
});
test('HTTP failure and JSON failure remain retryable',async()=>{
  let calls=0;const load=createStudyResourceLoader(async()=>{
    calls++; if(calls===1)return {ok:false};
    if(calls===2)return {ok:true,json:async()=>{throw Error('invalid JSON')}};
    return response({lessons:[]});
  });
  await assert.rejects(load('schoolwork.json'));
  await assert.rejects(load('schoolwork.json'));
  assert.deepEqual(await load('schoolwork.json'),{lessons:[]});assert.equal(calls,3);
});
test('stalled read is aborted and a later request can recover',async()=>{
  let calls=0, signal;
  const load=createStudyResourceLoader(async(_url, options)=>{
    signal=options.signal; return ++calls===1?new Promise(()=>{}):response({lessons:[]});
  },10);
  await assert.rejects(load('schoolwork.json'),/too long/);assert.equal(signal.aborted,true);
  assert.deepEqual(await load('schoolwork.json'),{lessons:[]});assert.equal(calls,2);
});
test('the recovery module is included in the service worker',()=>{
  assert(readFileSync(new URL('../pages/sw.js',import.meta.url),'utf8').includes('"./study-resources.mjs"'));
});
