import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationRunFromJobs,selectQaEvidence} from '../scripts/health-evidence.mjs';

const names=['Admit exact current protected-main commit','Verify checked-out source identity','Run release QA','Recheck protected-main before publishing','Deploy','Verify live lunch data and visible mobile flows','Retain exact live publication proof'];
const fixture=(name='Refresh current ABVM homework',jobName='Verify and deploy independently refreshed Homework / deploy')=>{
  const run={id:7,name,head_branch:'main',status:'completed',conclusion:'success',created_at:'2026-10-26T12:00:00Z',updated_at:'2026-10-26T12:10:00Z'};
  const evidence={run_id:7,jobs:[{id:8,run_id:7,name:jobName,status:'completed',conclusion:'success',started_at:run.created_at,completed_at:run.updated_at,steps:names.map(name=>({name,status:'completed',conclusion:'success'}))}]};
  return {run,evidence};
};
const old={id:1,conclusion:'success',updated_at:'2026-10-23T08:00:00Z'};

test('recent fully verified Pages QA replaces a stale standalone QA receipt in every publishing lane',()=>{
  for(const [name,job] of [
    ['Refresh current ABVM homework','Verify and deploy independently refreshed Homework / deploy'],
    ['Roll forward ABVM reviewed lunch week','Release published reviewed lunches through guarded Pages / deploy'],
    ['Refresh ABVM teacher pages','deploy verified refresh through Pages workflow / deploy'],
    ['Deploy ABVM to GitHub Pages','deploy'],
  ]){
    const {run,evidence}=fixture(name,job);
    const publication=publicationRunFromJobs(run,evidence);
    assert.equal(publication.verifiedReleaseQa,true);
    assert.equal(selectQaEvidence(old,[publication]),publication);
  }
});

test('source-only checks and unbound receipts cannot renew the QA clock',()=>{
  const {run,evidence}=fixture();
  assert.equal(publicationRunFromJobs(run,{run_id:7,jobs:[]}),null);
  const good=publicationRunFromJobs(run,evidence);
  for(const bad of [run,{...good,verifiedReleaseQa:undefined},{...good,head_branch:'feature'},
    {...good,status:'in_progress'},{...good,publisherJobId:undefined},{...good,updated_at:'invalid'}]){
    assert.equal(selectQaEvidence(old,[bad]),old);
  }
});

test('missing or failed publisher gates and newer standalone failures stay unhealthy',()=>{
  for(const name of names){
    const {run,evidence}=fixture();
    evidence.jobs[0].steps=evidence.jobs[0].steps.filter(step=>step.name!==name);
    const receipt=publicationRunFromJobs(run,evidence);
    assert.equal(selectQaEvidence(old,[receipt]).conclusion,'action_required',name);
  }
  const {run,evidence}=fixture();
  const good=publicationRunFromJobs(run,evidence);
  for(const updated_at of ['2026-10-26T13:00:00Z','invalid']){
    const failure={conclusion:'failure',updated_at};
    assert.equal(selectQaEvidence(failure,[good]),failure);
  }
  evidence.jobs[0].conclusion='failure';
  const failed=publicationRunFromJobs({...run,conclusion:'failure'},evidence);
  assert.equal(selectQaEvidence(old,[failed]).conclusion,'failure');
});
