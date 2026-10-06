import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCurriculumCoverageResolved,
  unresolvedCurriculumCoverage,
} from '../scripts/assert-curriculum-coverage-resolved.mjs';

test('curriculum coverage gate passes a resolved plan',()=>{
  assert.deepEqual(unresolvedCurriculumCoverage({unsupportedCount:0,candidates:[]}),[]);
  assert.equal(assertCurriculumCoverageResolved({unsupportedCount:0,candidates:[]}),true);
});

test('curriculum coverage gate reports exact governed candidates',()=>{
  const plan={
    unsupportedCount:1,
    candidates:[{
      subject:'Spelling / Handwriting',
      topic:'short i / long i',
      candidateId:'curriculum-spelling-handwriting-short-i-long-i-8c547e7fcf',
    }],
  };
  assert.deepEqual(unresolvedCurriculumCoverage(plan),[{
    subject:'Spelling / Handwriting',
    topic:'short i / long i',
    candidateId:'curriculum-spelling-handwriting-short-i-long-i-8c547e7fcf',
  }]);
  assert.throws(
    ()=>assertCurriculumCoverageResolved(plan,{context:'Refresh blocked'}),
    /Refresh blocked: Spelling \/ Handwriting: short i \/ long i \(curriculum-spelling-handwriting-short-i-long-i-8c547e7fcf\)/
  );
});


test('curriculum coverage gate fails closed on inconsistent reports',()=>{
  assert.throws(
    ()=>unresolvedCurriculumCoverage({unsupportedCount:1,candidates:[]}),
    /inconsistent: unsupportedCount=1, candidates=0/
  );
  assert.throws(
    ()=>unresolvedCurriculumCoverage({unsupportedCount:0,candidates:[{subject:'Reading',topic:'x'}]}),
    /inconsistent: unsupportedCount=0, candidates=1/
  );
  assert.throws(
    ()=>unresolvedCurriculumCoverage({candidates:[]}),
    /invalid unsupportedCount/
  );
});
