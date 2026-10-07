export function workflowEvidenceAt(run){
  return Date.parse(run?.updated_at||run?.created_at||0)||0;
}

export function selectPublicationEvidence(deployRun,refreshRun){
  if(refreshRun?.conclusion==="success"&&(!deployRun||workflowEvidenceAt(refreshRun)>workflowEvidenceAt(deployRun)))return refreshRun;
  return deployRun||null;
}

const activeWorkflowStatuses=new Set(["queued","in_progress","waiting","pending","requested"]);

export function selectEffectiveWorkflowRun(workflow){
  const newestCreated=workflow?.latestCreated||null;
  const decisive=workflow?.latestDecisive||null;
  const newerActive=newestCreated&&activeWorkflowStatuses.has(newestCreated.status)&&
    (!decisive||workflowEvidenceAt(newestCreated)>=workflowEvidenceAt(decisive));
  if(newerActive)return workflow?.latestSuccess||decisive;
  const cancellationIsNewestEvidence=newestCreated?.conclusion==="cancelled"&&
    (!decisive||workflowEvidenceAt(newestCreated)>workflowEvidenceAt(decisive));
  if(cancellationIsNewestEvidence)return newestCreated;
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
