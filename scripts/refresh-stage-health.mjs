/** Distinguish verified live source service from a still-pending parent run.
 * Never rewrite a cancelled/failed run as success. Only the latest active
 * teacher run, its successful source gates, and later live proof can qualify.
 */
export function selectPublishedRefreshStage({refreshRun,refreshJobs,publicationRun,watchdogRun,sourceCheckedAt}={}){
  if(refreshRun?.name!=="Refresh ABVM teacher pages"||refreshRun.head_branch!=="main"||
     !Number.isInteger(refreshRun.id)||refreshRun.conclusion!=null||
     !["in_progress","pending","queued","waiting"].includes(refreshRun.status)||
     refreshJobs?.run_id!==refreshRun.id)return null;
  const jobs=refreshJobs.jobs;
  if(!Array.isArray(jobs)||jobs.some(job=>job.run_id!==refreshRun.id||
    (job.conclusion!=null&&!["success","skipped"].includes(job.conclusion))))return null;
  const sources=jobs.filter(job=>job.name==="refresh");
  if(sources.length!==1)return null;
  const source=sources[0];
  const passed=run=>run?.status==="completed"&&run?.conclusion==="success";
  const sourceRequired=["Scan and validate the public teacher pages",
    "Verify page-exact source parity and isolate unsupported curriculum",
    "Verify refreshed source health","Validate the candidate app before changing main"];
  const historicalPublishRequired=["Commit refreshed pack against latest main",
    "Confirm exact published main SHA for gated Pages handoff"];
  const lockedPublishRequired=["Reject incompatible main drift and restore verified candidate",
    "Reject stale teacher data after a publication queue delay",
    "Commit verified teacher candidate without rerunning long QA under lock",
    "Confirm exact published main SHA for gated Pages handoff"];
  if(!Number.isInteger(source.id)||!passed(source)||!sourceRequired.every(name=>
    source.steps?.some(step=>step.name===name&&passed(step))))return null;
  // Existing completed runs put the source commit in refresh. New runs put
  // it in a separate job: never treat preparation alone as publication.
  const locked=jobs.filter(job=>job.name==="Commit only exact checked source data under the shared writer lock");
  if(locked.length>1)return null;
  const publisher=locked[0]||null;
  if(publisher){
    if(!Number.isInteger(publisher.id)||!passed(publisher)||!lockedPublishRequired.every(name=>
      publisher.steps?.some(step=>step.name===name&&passed(step))))return null;
  }else if(!historicalPublishRequired.every(name=>
    source.steps?.some(step=>step.name===name&&passed(step))))return null;
  if(!passed(publicationRun)||publicationRun.head_branch!=="main"||!Number.isInteger(publicationRun.id)||
    !(publicationRun.name==="Deploy ABVM to GitHub Pages"||
      (publicationRun.name==="Refresh current ABVM homework"&&Number.isInteger(publicationRun.publisherJobId))))return null;
  if(!passed(watchdogRun)||watchdogRun.name!=="Monitor ABVM refresh health"||
    watchdogRun.head_branch!=="main"||!Number.isInteger(watchdogRun.id))return null;
  const values=[refreshRun.created_at,source.started_at,sourceCheckedAt,source.completed_at,
    ...(publisher?[publisher.started_at,publisher.completed_at]:[]),
    publicationRun.updated_at,watchdogRun.created_at,watchdogRun.updated_at].map(value=>Date.parse(value||""));
  if(!values.every(Number.isFinite)||values.some((value,index)=>index>0&&value<values[index-1]))return null;
  return {state:"published-parent-pending",refreshRunId:refreshRun.id,sourceJobId:source.id,
    sourceCompletedAt:source.completed_at,
    ...(publisher?{lockedSourcePublisherJobId:publisher.id}:{}),
    publisherRunId:publicationRun.id,watchdogRunId:watchdogRun.id};
}
