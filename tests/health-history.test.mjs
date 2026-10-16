import test from 'node:test';
import assert from 'node:assert/strict';
import * as history from '../scripts/fetch-health-history.mjs';
const repo='owner/app';

test('workflow history retains each production lane despite a burst of unrelated PR runs',async()=>{
 assert.equal(typeof history.collectHealthHistory,'function');
 const result=await history.collectHealthHistory({repository:repo,fetchJson:async path=>{
  if(path.includes('/pulls?'))return [];
  if(path.includes('/workflows/qa.yml/'))return {workflow_runs:[{id:2,name:'ABVM App QA',head_branch:'main',conclusion:'success'}]};
  if(path.includes('/workflows/sync-study-pack.yml/'))return {workflow_runs:[{id:1,name:'Refresh ABVM teacher pages',head_branch:'main',conclusion:'success'}]};
  if(path.includes('/workflows/'))return {workflow_runs:[]};
  throw Error('Unexpected API request');
 }});
 assert.deepEqual(result.runs.workflow_runs.map(r=>r.id).sort(),[1,2]);
 assert.deepEqual(result.refreshJobs,{run_id:null,jobs:[]});
 assert.deepEqual(result.homeworkPublications,[]);
});

test('history skips no-publication checks and binds the first actual Homework publisher jobs',async()=>{
 assert.equal(typeof history.collectHealthHistory,'function');
 const result=await history.collectHealthHistory({repository:repo,fetchJson:async path=>{
  if(path.includes('/pulls?'))return [];
  if(path.includes('/workflows/refresh-current-homework.yml/'))return {workflow_runs:[
   {id:2,name:'Refresh current ABVM homework',head_branch:'main',status:'completed',conclusion:'success',updated_at:'2026-10-16T16:00:00Z'},
   {id:1,name:'Refresh current ABVM homework',head_branch:'main',status:'completed',conclusion:'failure',updated_at:'2026-10-16T15:00:00Z'}]};
  if(path.includes('/workflows/'))return {workflow_runs:[]};
  if(path.includes('/runs/2/jobs?'))return {jobs:[]};
  if(path.includes('/runs/1/jobs?'))return {jobs:[{id:3,run_id:1,name:'Verify and deploy independently refreshed Homework / deploy',status:'completed',conclusion:'failure',completed_at:'2026-10-16T15:00:00Z'}]};
  throw Error('Unexpected API request');
 }});
 assert.equal(result.homeworkPublications.length,1);
 assert.equal(result.homeworkPublications[0].publisherJobId,3);
 assert.equal(result.homeworkPublications[0].conclusion,'failure');
});

test('malformed source history fails closed instead of writing an empty healthy history',async()=>{
 assert.equal(typeof history.collectHealthHistory,'function');
 await assert.rejects(()=>history.collectHealthHistory({repository:repo,fetchJson:async()=>({})}),/workflow history/);
});

test('a newer active refresh cannot change the binding of fetched failure steps',async()=>{
 const result=await history.collectHealthHistory({repository:repo,fetchJson:async path=>{
  if(path.includes('/workflows/sync-study-pack.yml/'))return {workflow_runs:[
   {id:2,name:'Refresh ABVM teacher pages',head_branch:'main',status:'in_progress',conclusion:null,updated_at:'2026-10-16T16:00:00Z'},
   {id:1,name:'Refresh ABVM teacher pages',head_branch:'main',status:'completed',conclusion:'failure',updated_at:'2026-10-16T15:00:00Z'}]};
  if(path.includes('/workflows/'))return {workflow_runs:[]};
  if(path.includes('/runs/1/jobs?'))return {jobs:[{run_id:1,steps:[{name:'Commit refreshed pack against latest main',conclusion:'failure'}]}]};
  throw Error('Wrong failure job requested');
 }});
 assert.equal(result.refreshJobs.run_id,1);
 assert.equal(result.refreshJobs.jobs[0].steps[0].name,'Commit refreshed pack against latest main');
});
