import {assessDailySchoolSources} from './source-freshness-recovery.mjs';

export function workflowEvidenceAt(run){
  return Date.parse(run?.updated_at||run?.created_at||0)||0;
}

export function selectPublicationEvidence(deployRun,refreshRun,homeworkPublication=null){
  let publication=deployRun||null;
  if(refreshRun?.conclusion==="success"&&(!publication||workflowEvidenceAt(refreshRun)>workflowEvidenceAt(publication)))publication=refreshRun;
  if(Number.isInteger(homeworkPublication?.publisherJobId)&&(!publication||workflowEvidenceAt(homeworkPublication)>workflowEvidenceAt(publication)))publication=homeworkPublication;
  return publication;
}

// A successful source check may skip Pages. Only the actual nested release job
// can establish publication; missing successful gates remain unhealthy.
export function publicationRunFromJobs(run,evidence){
  if(run?.name!=="Refresh current ABVM homework"||run.head_branch!=="main"||
     run.status!=="completed"||Number(evidence?.run_id)!==Number(run.id))return null;
  const job=(evidence.jobs||[]).find(job=>Number(job.run_id)===Number(run.id)&&
    job.name==="Verify and deploy independently refreshed Homework / deploy"&&
    job.status==="completed"&&job.conclusion!=="skipped");
  if(!job)return null;
  const required=["Admit exact current protected-main commit","Verify checked-out source identity",
    "Run release QA","Recheck protected-main before publishing","Deploy",
    "Verify live lunch data and visible mobile flows","Retain exact live publication proof"];
  const verified=run.conclusion==="success"&&job.conclusion==="success"&&
    Number.isFinite(Date.parse(job.completed_at||""))&&required.every(name=>
    (job.steps||[]).some(step=>step.name===name&&step.status==="completed"&&step.conclusion==="success"));
  return {...run,conclusion:verified?"success":job.conclusion==="success"?"action_required":job.conclusion,
    publisherJobId:job.id,created_at:job.started_at||run.created_at,
    updated_at:job.completed_at||run.updated_at};
}

const completedEvidenceTime=run=>{
  const timestamp=Date.parse(run?.updated_at||"");
  return Number.isFinite(timestamp)?timestamp:null;
};

export function selectEffectiveWorkflowRun(workflow){
  const decisive=workflow?.latestDecisive||null;
  // A cancelled run can complete after a later-created run; creation order alone is not sufficient.
  const cancellations=[workflow?.latestCreated,workflow?.latestCompleted]
    .filter(run=>run?.conclusion==="cancelled");
  const missingTimestamp=cancellations.find(run=>completedEvidenceTime(run)===null);
  if(missingTimestamp)return missingTimestamp;
  const latestCancellation=cancellations.sort((a,b)=>completedEvidenceTime(b)-completedEvidenceTime(a))[0]||null;
  const decisiveAt=completedEvidenceTime(decisive);
  if(latestCancellation&&(decisiveAt===null||completedEvidenceTime(latestCancellation)>=decisiveAt))return latestCancellation;
  // Do not infer success from an active rerun or from an un-timestamped successful completion.
  if(decisive?.conclusion==="success"&&decisiveAt===null)return null;
  return decisive;
}

export function selectRefreshFailureEvidence(runs,refreshJobsData){
  const runId=Number(refreshJobsData?.run_id);
  if(!Number.isFinite(runId))return null;
  return (Array.isArray(runs)?runs:[]).find(run=>Number(run?.id)===runId)||null;
}

export function selectGovernedCurriculumHold(refreshRun,refreshJobsData,openPulls=[]){
  if(refreshRun?.conclusion!=="failure")return null;
  if(Number(refreshJobsData?.run_id)!==Number(refreshRun?.id))return null;
  const failedSteps=(Array.isArray(refreshJobsData?.jobs)?refreshJobsData.jobs:[])
    .flatMap(job=>Array.isArray(job?.steps)?job.steps:[])
    .filter(step=>step?.conclusion==="failure");
  if(failedSteps.length!==1||failedSteps[0]?.name!=="Block publication while curriculum candidates are unresolved")return null;
  const candidate=(Array.isArray(openPulls)?openPulls:[]).find(pr=>
    pr?.state==="open"&&
    pr?.draft===true&&
    String(pr?.head?.ref||"").startsWith("curriculum-candidate-")
  );
  if(!candidate)return null;
  return {
    runId:Number(refreshRun.id),
    failedStep:failedSteps[0].name,
    candidatePrNumber:Number(candidate.number),
    candidatePrUrl:String(candidate.html_url||""),
    candidateBranch:String(candidate.head.ref),
  };
}

/**
 * Report a guarded release race as recovered only when fresh teacher-source QA,
 * reviewed lunch, later proven publication, and an even later live-vs-main
 * watchdog all succeeded. Ordinary failed refreshes stay critical.
 */
export function selectRecoveredRefreshRace({refreshRun,refreshJobs,publicationRun,watchdogRun,sourceCheckedAt}={}){
  if(refreshRun?.name!=="Refresh ABVM teacher pages"||
     refreshRun?.head_branch!=="main"||refreshRun?.status!=="completed"||
     refreshRun?.conclusion!=="failure"||
     !Number.isInteger(refreshRun?.id)||Number(refreshJobs?.run_id)!==refreshRun.id)return null;
  const jobs=Array.isArray(refreshJobs?.jobs)?refreshJobs.jobs:[];
  const source=jobs.find(job=>job.name==="refresh");
  const lunch=jobs.find(job=>job.name==="Refresh reviewed lunch week independently of held curriculum");
  const deploy=jobs.find(job=>job.name==="deploy verified refresh through Pages workflow / deploy");
  if(jobs.length!==3||!source||!lunch||!deploy)return null;
  const passed=job=>job.status==="completed"&&job.conclusion==="success";
  const step=(job,name,conclusion="success")=>
    (job?.steps||[]).some(row=>row.name===name&&row.status==="completed"&&row.conclusion===conclusion);
  if(!passed(source)||!passed(lunch)||
     !step(source,"Verify page-exact source parity and isolate unsupported curriculum")||
     !step(source,"Verify refreshed source health")||
     !step(source,"Validate the candidate app before changing main")||
     !step(source,"Commit refreshed pack against latest main")||
     !step(lunch,"Refresh only previously reviewed source-backed lunch fields")||
     !step(lunch,"Prove lunch isolation and negative-case integrity"))return null;
  if(deploy.status!=="completed"||deploy.conclusion!=="failure"||
     !step(deploy,"Admit exact current protected-main commit")||
     !step(deploy,"Verify checked-out source identity")||
     !step(deploy,"Run release QA")||
     !step(deploy,"Recheck protected-main before publishing","failure")||
     !step(deploy,"Deploy","skipped")||
     !step(deploy,"Verify live lunch data and visible mobile flows","skipped"))return null;
  const failed=jobs.flatMap(job=>(job.steps||[]).filter(row=>row.conclusion==="failure")
    .map(row=>({job:job.name,name:row.name})));
  if(failed.length!==1||failed[0].job!==deploy.name||
     failed[0].name!=="Recheck protected-main before publishing")return null;
  if(publicationRun?.status!=="completed"||publicationRun?.conclusion!=="success"||
     publicationRun?.head_branch!=="main"||
     !(publicationRun.name==="Deploy ABVM to GitHub Pages"||
       (publicationRun.name==="Refresh current ABVM homework"&&
        Number.isInteger(publicationRun.publisherJobId))))return null;
  if(watchdogRun?.name!=="Monitor ABVM refresh health"||
     watchdogRun?.head_branch!=="main"||watchdogRun?.status!=="completed"||
     watchdogRun?.conclusion!=="success")return null;
  const refreshCompleted=Date.parse(refreshRun.updated_at||"");
  const published=Date.parse(publicationRun.updated_at||"");
  const watchdogStarted=Date.parse(watchdogRun.created_at||"");
  const checked=Date.parse(sourceCheckedAt||"");
  if(![refreshCompleted,published,watchdogStarted,checked].every(Number.isFinite)||
     !(checked<=refreshCompleted&&refreshCompleted<published&&published<watchdogStarted))return null;
  return {state:"recovered",refreshRunId:refreshRun.id,
    publisherRunId:publicationRun.id,watchdogRunId:watchdogRun.id,
    failedStep:"Recheck protected-main before publishing"};
}

export function assessHomeworkHealth(posting, now) {
  const checked=Date.parse(posting?.checkedAt||'');
  const current=Date.parse(now);
  const ageHours=Number.isFinite(checked)&&Number.isFinite(current)
    ?(current-checked)/3_600_000:null;
  return {
    checkedAt:posting?.checkedAt||null,
    ageHours:ageHours===null?null:Number(ageHours.toFixed(2)),
    status:posting?.status||'missing',
    healthy:assessDailySchoolSources({now,homework:posting}).homeworkFresh,
  };
}
