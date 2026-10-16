import test from 'node:test';
import assert from 'node:assert/strict';
import * as health from '../scripts/health-evidence.mjs';
const names=['Admit exact current protected-main commit','Verify checked-out source identity','Run release QA','Recheck protected-main before publishing','Deploy','Verify live lunch data and visible mobile flows','Retain exact live publication proof'];
const run={id:77,name:'Refresh current ABVM homework',head_branch:'main',status:'completed',conclusion:'success',created_at:'2026-10-16T14:55:25Z',updated_at:'2026-10-16T15:21:20Z'};
const evidence=()=>({run_id:77,jobs:[{id:88,run_id:77,name:'Verify and deploy independently refreshed Homework / deploy',status:'completed',conclusion:'success',started_at:'2026-10-16T15:05:50Z',completed_at:'2026-10-16T15:21:20Z',steps:names.map(name=>({name,status:'completed',conclusion:'success'}))}]});

test('successful nested Homework publication supersedes the earlier guarded standalone failure',()=>{
 assert.equal(typeof health.publicationRunFromJobs,'function');
 const publication=health.publicationRunFromJobs(run,evidence());
 assert.equal(publication.conclusion,'success');assert.equal(publication.publisherJobId,88);
 const old={conclusion:'failure',updated_at:'2026-10-16T15:05:47Z'};
 assert.equal(health.selectPublicationEvidence(old,null,publication).id,77);
});

test('a no-change Homework check cannot establish a publication',()=>{
 assert.equal(typeof health.publicationRunFromJobs,'function');
 for(const jobs of [[],[{...evidence().jobs[0],conclusion:'skipped'}]]){
  assert.equal(health.publicationRunFromJobs(run,{run_id:77,jobs}),null);
 }
});

test('missing or skipped release and live gates never establish successful publication',()=>{
 assert.equal(typeof health.publicationRunFromJobs,'function');
 for(const name of names){
  for(const mode of ['missing','skipped']){
   const data=evidence();data.jobs[0].steps=mode==='missing'?data.jobs[0].steps.filter(s=>s.name!==name):data.jobs[0].steps.map(s=>s.name===name?{...s,conclusion:'skipped'}:s);
   assert.equal(health.publicationRunFromJobs(run,data).conclusion,'action_required',name+' '+mode);
  }
 }
});

test('nested evidence is bound to the completed main Homework run',()=>{
 assert.equal(typeof health.publicationRunFromJobs,'function');
 for(const bad of [{...run,id:76},{...run,status:'in_progress'},{...run,head_branch:'feature'},{...run,name:'other'}])assert.equal(health.publicationRunFromJobs(bad,evidence()),null);
 const data=evidence();data.jobs[0].run_id=76;assert.equal(health.publicationRunFromJobs(run,data),null);
});

test('a newer failed nested publisher remains unhealthy even after an older successful publication',()=>{
 assert.equal(typeof health.publicationRunFromJobs,'function');
 const data=evidence();data.jobs[0].conclusion='failure';data.jobs[0].steps.find(s=>s.name==='Deploy').conclusion='failure';
 const failed=health.publicationRunFromJobs({...run,conclusion:'failure'},data);
 assert.equal(failed.conclusion,'failure');
 const previous={conclusion:'success',updated_at:'2026-10-16T15:00:00Z'};
 assert.equal(health.selectPublicationEvidence(previous,null,failed).conclusion,'failure');
 const newer={conclusion:'success',updated_at:'2026-10-16T15:30:00Z'};
 assert.equal(health.selectPublicationEvidence(newer,null,failed),newer);
});

test('missing publisher completion time cannot establish verified publication',()=>{
 const data=evidence();delete data.jobs[0].completed_at;
 assert.equal(health.publicationRunFromJobs(run,data).conclusion,'action_required');
});
