import {assessDailySchoolSources,scheduledSourceDue} from './source-freshness-recovery.mjs';

export function workflowEvidenceAt(run){
  return Date.parse(run?.updated_at||run?.created_at||0)||0;
}

export function selectPublicationEvidence(deployRun,refreshRun,homeworkPublication=null,lunchPublication=null){
  let publication=deployRun||null;
  if(refreshRun?.conclusion==="success"&&(!publication||workflowEvidenceAt(refreshRun)>workflowEvidenceAt(publication)))publication=refreshRun;
  // Source-only success cannot replace protected-main publication proof.
  for(const nested of [homeworkPublication,lunchPublication]){
    if(Number.isInteger(nested?.publisherJobId)&&(!publication||workflowEvidenceAt(nested)>workflowEvidenceAt(publication)))publication=nested;
  }
  return publication;
}

// A successful source check may skip Pages. Only the actual nested release job
// can establish publication; missing successful gates remain unhealthy.
export function publicationRunFromJobs(run,evidence){
  const publisherJobName={
    "Deploy ABVM to GitHub Pages":"deploy",
    "Refresh ABVM teacher pages":"deploy verified refresh through Pages workflow / deploy",
    "Refresh current ABVM homework":"Verify and deploy independently refreshed Homework / deploy",
    "Roll forward ABVM reviewed lunch week":"Release published reviewed lunches through guarded Pages / deploy",
  }[run?.name];
  if(!publisherJobName||run.head_branch!=="main"||
     run.status!=="completed"||Number(evidence?.run_id)!==Number(run.id))return null;
  const job=(evidence.jobs||[]).find(job=>Number(job.run_id)===Number(run.id)&&
    job.name===publisherJobName&&job.status==="completed"&&job.conclusion!=="skipped");
  if(!job)return null;
  const required=["Admit exact current protected-main commit","Verify checked-out source identity",
    "Run release QA","Recheck protected-main before publishing","Deploy",
    "Verify live lunch data and visible mobile flows","Retain exact live publication proof"];
  const verified=run.conclusion==="success"&&job.conclusion==="success"&&
    Number.isFinite(Date.parse(job.completed_at||""))&&required.every(name=>
    (job.steps||[]).some(step=>step.name===name&&step.status==="completed"&&step.conclusion==="success"));
  return {...run,conclusion:verified?"success":job.conclusion==="success"?"action_required":job.conclusion,
    verifiedReleaseQa:verified,
    publisherJobId:job.id,created_at:job.started_at||run.created_at,
    updated_at:job.completed_at||run.updated_at};
}

// Pages runs the same full application QA inside every guarded publication.
// A source-only check, workflow title or old successful run is not QA evidence.
export function selectQaEvidence(standalone,publications=[]){
  let selected=standalone||null;
  for(const run of publications){
    if(typeof run?.verifiedReleaseQa!=="boolean"||run.head_branch!=="main"||
       run.status!=="completed"||(run.conclusion==="success"&&!run.verifiedReleaseQa)||
       !Number.isInteger(run.publisherJobId)||!Number.isFinite(Date.parse(run.updated_at||"")))continue;
    // Unknown completion time on an existing failure must not be hidden.
    if(selected&&!Number.isFinite(Date.parse(selected.updated_at||"")))continue;
    if(!selected||workflowEvidenceAt(run)>workflowEvidenceAt(selected))selected=run;
  }
  return selected;
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

/**
 * A cancelled nested publisher remains a failure unless all teacher and lunch
 * gates passed, a separate protected-main Pages release later succeeded, and
 * an even later watchdog independently verified the published school data.
 * This is not a blanket "ignore cancelled workflows" exception.
 */
export function selectRecoveredCancelledRefresh({
  refreshRun,refreshJobs,publicationRun,watchdogRun,sourceCheckedAt,homeworkCheckedAt,
}={}){
  if(refreshRun?.name!=="Refresh ABVM teacher pages"||
     refreshRun?.head_branch!=="main"||refreshRun?.status!=="completed"||
     refreshRun?.conclusion!=="cancelled"||!Number.isInteger(refreshRun.id)||
     Number(refreshJobs?.run_id)!==refreshRun.id)return null;
  const jobs=Array.isArray(refreshJobs?.jobs)?refreshJobs.jobs:[];
  const source=jobs.find(job=>job.name==="refresh");
  const lunch=jobs.find(job=>job.name==="Refresh reviewed lunch week independently of held curriculum");
  const deploy=jobs.find(job=>job.name==="deploy verified refresh through Pages workflow / deploy");
  if(jobs.length!==3||!source||!lunch||!deploy)return null;
  const step=(job,name,conclusion="success")=>
    (job?.steps||[]).some(row=>row.name===name&&row.status==="completed"&&row.conclusion===conclusion);
  const passed=job=>job.status==="completed"&&job.conclusion==="success";
  if(!passed(source)||!passed(lunch)||
     !step(source,"Verify page-exact source parity and isolate unsupported curriculum")||
     !step(source,"Verify refreshed source health")||
     !step(source,"Validate the candidate app before changing main")||
     !step(source,"Commit refreshed pack against latest main")||
     !step(source,"Confirm exact published main SHA for gated Pages handoff")||
     !step(lunch,"Refresh only previously reviewed source-backed lunch fields")||
     !step(lunch,"Prove lunch isolation and negative-case integrity")||
     !step(lunch,"Confirm current protected-main SHA after lunch verification"))return null;
  // A completed or failed original deployment is a different event, never this exception.
  if(deploy.status!=="completed"||deploy.conclusion!=="cancelled"||
     !step(deploy,"Admit exact current protected-main commit")||
     !step(deploy,"Verify checked-out source identity")||
     !step(deploy,"Install Chromium and WebKit","cancelled")||
     !step(deploy,"Run release QA","skipped")||
     !step(deploy,"Deploy","skipped")||
     !step(deploy,"Verify live lunch data and visible mobile flows","skipped")||
     jobs.some(job=>(job.steps||[]).some(row=>row.conclusion==="failure")))return null;
  if(publicationRun?.status!=="completed"||publicationRun?.conclusion!=="success"||
     publicationRun?.head_branch!=="main"||
     !(publicationRun.name==="Deploy ABVM to GitHub Pages"||
       (publicationRun.name==="Refresh current ABVM homework"&&
        Number.isInteger(publicationRun.publisherJobId))))return null;
  if(watchdogRun?.name!=="Monitor ABVM refresh health"||
     watchdogRun.head_branch!=="main"||watchdogRun.status!=="completed"||
     watchdogRun.conclusion!=="success")return null;
  const times=[
    refreshRun.updated_at,publicationRun.created_at,publicationRun.updated_at,
    watchdogRun.run_started_at||watchdogRun.created_at,watchdogRun.updated_at,
    sourceCheckedAt,homeworkCheckedAt,
  ].map(value=>Date.parse(value||""));
  if(!times.every(Number.isFinite))return null;
  const [cancelled,pubStarted,published,watchStarted,watchCompleted,teacherChecked,homeworkChecked]=times;
  if(!(teacherChecked<=cancelled&&cancelled<pubStarted&&pubStarted<=published&&
       teacherChecked<=published&&homeworkChecked<=published&&
       published<watchStarted&&watchStarted<=watchCompleted))return null;
  return {state:"recovered",refreshRunId:refreshRun.id,publisherRunId:publicationRun.id,
    watchdogRunId:watchdogRun.id,cancelledStep:"Install Chromium and WebKit"};
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

/** Fail closed on absent or malformed GitHub branch-status evidence. */
export function assessMainBranchProtection(branch){
  if(branch?.name!=="main"||typeof branch?.protected!=="boolean")return {state:"unknown",protected:null};
  return {state:branch.protected?"protected":"unprotected",protected:branch.protected};
}

/**
 * GitHub cron can silently skip a scheduled Homework poll while an earlier
 * successful on-demand check keeps the saved source timestamp looking fresh.
 * Distinguish regular delivery from manual, push, or recovery dispatches.
 */
export function assessHomeworkPollingCadence(runs, now, {maxGapHours=2.5}={}) {
  const current=Date.parse(now||'');
  if(!Number.isFinite(current)||!Array.isArray(runs)||!(maxGapHours>0)){
    return {state:'unknown',lastScheduledAt:null,ageHours:null};
  }
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',hourCycle:'h23',hour:'2-digit',minute:'2-digit'
  }).formatToParts(new Date(current)).map(part=>[part.type,part.value]));
  const localHour=Number(parts.hour),localMinute=Number(parts.minute);
  const scheduled=runs.filter(run=>run?.name==='Refresh current ABVM homework'&&
    run?.event==='schedule'&&run?.head_branch==='main'&&
    Number.isFinite(Date.parse(run?.created_at||'')))
    .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const last=scheduled[0];
  // The last school-hour Homework poll is 23:23 Eastern. An absent late
  // poll remains overdue after its 90-minute grace even after midnight.
  // Likewise, 06:23 is due at 07:53, not 08:00. Reuse the exact
  // source-recovery controller's Eastern schedule instead of a second clock.
  const outsideActiveWindow=localHour<8||localHour>23||!Number.isFinite(localMinute);
  if(outsideActiveWindow){
    if(!last)return {state:'off-hours',lastScheduledAt:null,ageHours:null};
    const schedule=scheduledSourceDue({kind:'homework',now,checkedAt:last.created_at});
    if(schedule.reason==='scheduled-check-overdue'){
      const age=(current-Date.parse(last.created_at))/3_600_000;
      return {state:'delayed',lastScheduledAt:last.created_at,
        ageHours:Number(age.toFixed(2)),offHours:true,
        expectedSchoolDate:schedule.expectedSchoolDate,
        expectedLocalTime:schedule.expectedLocalTime};
    }
    return {state:'off-hours',lastScheduledAt:null,ageHours:null};
  }
  if(!last)return {state:'unknown',lastScheduledAt:null,ageHours:null};
  const age=(current-Date.parse(last.created_at))/3_600_000;
  if(age<-.25)return {state:'unknown',lastScheduledAt:last.created_at,ageHours:null};

  // A late but successful scheduled run repairs CURRENT freshness; it must not
  // silently erase earlier dropped/delayed school-day polling windows.
  // Compare only original scheduled runs on today's Eastern calendar date:
  // a legitimate prior-night interval is not an hourly-delivery failure.
  const localDay=value=>new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(value));
  const day=localDay(current);
  const schoolHour=value=>Number(new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',hourCycle:'h23',hour:'2-digit'
  }).format(new Date(value)));
  const sameDay=scheduled.filter(run=>localDay(run.created_at)===day)
    .sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at));
  let observedGapHours=null,gapFrom=null,gapTo=null;
  for(let i=1;i<sameDay.length;i++){
    const prior=sameDay[i-1],later=sameDay[i];
    if(schoolHour(later.created_at)<8)continue;
    const gap=(Date.parse(later.created_at)-Date.parse(prior.created_at))/3_600_000;
    if(gap>maxGapHours&&(observedGapHours===null||gap>observedGapHours)){
      observedGapHours=Number(gap.toFixed(2));
      gapFrom=prior.created_at;
      gapTo=later.created_at;
    }
  }
  return {state:age>maxGapHours?'delayed':'current',
    lastScheduledAt:last.created_at,ageHours:Number(age.toFixed(2)),
    observedGapHours,gapFrom,gapTo};
}
