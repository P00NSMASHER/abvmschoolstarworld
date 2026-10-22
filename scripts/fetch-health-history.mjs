import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicationRunFromJobs,workflowEvidenceAt} from './health-evidence.mjs';

const workflows=['sync-study-pack.yml','qa.yml','pages.yml','refresh-health.yml','refresh-current-homework.yml'];
export async function collectHealthHistory({repository,fetchJson}){
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository||''))throw new Error('Invalid health repository');
  const root=`repos/${repository}`;
  const byId=new Map();
  for(const file of workflows){
    const data=await fetchJson(`${root}/actions/workflows/${file}/runs?branch=main&per_page=100`);
    if(!Array.isArray(data?.workflow_runs))throw new Error('Missing workflow history: '+file);
    for(const run of data.workflow_runs){
      if(run.head_branch==='main')byId.set(run.id,run);
    }
  }
  const runs=[...byId.values()].sort((a,b)=>workflowEvidenceAt(b)-workflowEvidenceAt(a));
  const failed=runs.find(run=>run.name==='Refresh ABVM teacher pages'&&run.conclusion==='failure');
  const jobsFor=async run=>{
    const data=await fetchJson(`${root}/actions/runs/${run.id}/jobs?per_page=100`);
    if(!Array.isArray(data?.jobs))throw new Error('Missing workflow job evidence');
    return {run_id:run.id,jobs:data.jobs};
  };
  const refreshJobs=failed?await jobsFor(failed):{run_id:null,jobs:[]};
  // Capture real cancelled nested-publisher gates for conditional post-release recovery.
  // A cancellation by itself is never evidence of success.
  const cancelled=runs.find(run=>run.name==='Refresh ABVM teacher pages'&&
    run.head_branch==='main'&&run.status==='completed'&&run.conclusion==='cancelled');
  const cancelledRefreshJobs=cancelled?await jobsFor(cancelled):{run_id:null,jobs:[]};
  // A source job can finish and be published by another guarded Pages run
  // while its parent still waits for a redundant queued publisher.
  const latestRefresh=runs.filter(run=>run.name==='Refresh ABVM teacher pages')
    .sort((a,b)=>Date.parse(b.created_at||'')-Date.parse(a.created_at||''))[0];
  const refreshStageJobs=latestRefresh&&Number.isFinite(Date.parse(latestRefresh.created_at||''))&&latestRefresh.conclusion==null&&
    ['in_progress','pending','queued','waiting'].includes(latestRefresh.status)
    ?await jobsFor(latestRefresh):{run_id:null,jobs:[]};
  const homeworkPublications=[];
  // Skip source-only/no-change checks. Bound every request; absent proof is never success.
  const homework=runs.filter(run=>run.name==='Refresh current ABVM homework'&&run.status==='completed').slice(0,10);
  for(const run of homework){
    const publication=publicationRunFromJobs(run,await jobsFor(run));
    if(publication){homeworkPublications.push(publication);break;}
  }
  return {runs:{workflow_runs:runs},refreshJobs,cancelledRefreshJobs,refreshStageJobs,homeworkPublications};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const fetchJson=async path=>JSON.parse(execFileSync('gh',['api',path],{
    encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024,
  }));
  const result=await collectHealthHistory({repository:process.env.GITHUB_REPOSITORY,fetchJson});
  for(const [file,data] of [['workflow-runs.json',result.runs],['refresh-jobs.json',result.refreshJobs],
    ['cancelled-refresh-jobs.json',result.cancelledRefreshJobs],
    ['refresh-stage-jobs.json',result.refreshStageJobs],
    ['homework-publications.json',result.homeworkPublications]])writeFileSync(file,JSON.stringify(data,null,2)+'\n');
}
