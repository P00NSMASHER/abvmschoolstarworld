import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../pages/november-practice-tests.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const storeKey='abvm-grade2-tuesday-2026-11-17-v2';

function paper(saved=null){
  const nodes=new Map(),listeners=new Map(),storage=new Map(saved?[[storeKey,JSON.stringify(saved)]]:[]);
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:'',innerHTML:''});return nodes.get(id);};
  const context={document:{getElementById:node,querySelectorAll:()=>[],querySelector:()=>null,
    addEventListener:(event,handler)=>listeners.set(event,handler)},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}};
  vm.runInNewContext(script+'\nthis.inspect=()=>({state,score:score(TESTS.math)}); this.redraw=render;',context);
  return {context,node,storage,input(value,id='m1'){
    // Match the actual rendered input's dataset, including any erroneous part marker.
    const markup=node('paper').innerHTML.match(new RegExp('<input[^>]*data-qid="'+id+'"[^>]*>'))[0];
    const part=markup.match(/data-part="([^"]*)"/)?.[1];
    listeners.get('input')({target:{id:'',type:'text',value,dataset:{qid:id,...(part===undefined?{}:{part})}}});
  }};
}

test('single-answer Math inputs retain exactly the typed answer after rerender',()=>{
  const p=paper();p.input('37');p.context.redraw();
  assert.equal(p.context.inspect().state.answers.math.m1,'37');
  assert.match(p.node('paper').innerHTML,/data-qid="m1"[^>]*value="37"/);
  assert.equal(p.context.inspect().score.count,1);
});

test('erasing a Math answer returns the completion count to zero',()=>{
  const p=paper();p.input('37');p.input('');
  assert.equal(p.node('progress').textContent,'0 of 20 answers entered');
  p.context.redraw();
  assert.match(p.node('paper').innerHTML,/data-qid="m1"[^>]*value=""/);
});

test('existing malformed single-answer arrays are repaired without losing saved work',()=>{
  const p=paper({active:'math',answers:{math:{m1:['37',''],m2:['',''],m3:'57'},religion:{r1:'A'}},submitted:{religion:true},student:'',date:''});
  assert.equal(p.context.inspect().state.answers.math.m1,'37');
  assert.equal(p.context.inspect().state.answers.math.m2,'');
  assert.equal(p.context.inspect().state.answers.math.m3,'57');
  assert.equal(p.context.inspect().state.answers.religion.r1,'A');
  assert.equal(p.context.inspect().state.submitted.religion,true);
  assert.equal(p.node('progress').textContent,'2 of 20 answers entered');
  assert.equal(p.context.inspect().score.count,2);
});
