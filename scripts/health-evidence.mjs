export function workflowEvidenceAt(run){
  return Date.parse(run?.updated_at||run?.created_at||0)||0;
}

export function selectPublicationEvidence(deployRun,refreshRun){
  if(refreshRun?.conclusion==="success"&&(!deployRun||workflowEvidenceAt(refreshRun)>workflowEvidenceAt(deployRun)))return refreshRun;
  return deployRun||null;
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
