export function workflowEvidenceAt(run){
  return Date.parse(run?.updated_at||run?.created_at||0)||0;
}

export function selectPublicationEvidence(deployRun,refreshRun){
  if(refreshRun?.conclusion==="success"&&(!deployRun||workflowEvidenceAt(refreshRun)>workflowEvidenceAt(deployRun)))return refreshRun;
  return deployRun||null;
}
