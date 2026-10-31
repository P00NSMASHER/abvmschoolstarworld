import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {selectQaEvidence,assessHomeworkHealth,assessHomeworkPollingCadence,assessMainBranchProtection,selectEffectiveWorkflowRun,selectGovernedCurriculumHold,selectPublicationEvidence,selectRefreshFailureEvidence,selectRecoveredRefreshRace,selectRecoveredCancelledRefresh} from "./health-evidence.mjs";
import {assessUpcomingLunchCoverage,displayedSchoolWeekDates,schoolWeekLabel} from "./school-week-label.mjs";
import {assessPublicationParity} from "./publication-parity-health.mjs";

const packData=JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8"));
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const sw=readFileSync(new URL("../pages/sw.js",import.meta.url),"utf8");
const cache=(sw.match(/const CACHE = "([^"]+)"/)||[])[1]||"unknown";
const runsPath=process.env.WORKFLOW_RUNS_FILE;
const refreshJobsPath=process.env.REFRESH_JOBS_FILE;
const cancelledRefreshJobsPath=process.env.REFRESH_CANCELLED_JOBS_FILE;
const refreshStageJobsPath=process.env.REFRESH_STAGE_JOBS_FILE;
const openPullsPath=process.env.OPEN_PULLS_FILE;
const publicationsPath=process.env.HOMEWORK_PUBLICATIONS_FILE;
const lunchPublicationsPath=process.env.LUNCH_PUBLICATIONS_FILE;
const qaPublicationsPath=process.env.QA_PUBLICATIONS_FILE;
const mainBranchPath=process.env.MAIN_BRANCH_FILE;
const runs=runsPath?JSON.parse(readFileSync(runsPath,"utf8")).workflow_runs||[]:[];
const refreshJobsData=refreshJobsPath?JSON.parse(readFileSync(refreshJobsPath,"utf8")):{run_id:null,jobs:[]};
const cancelledRefreshJobsData=cancelledRefreshJobsPath?JSON.parse(readFileSync(cancelledRefreshJobsPath,"utf8")):{run_id:null,jobs:[]};
const refreshStageJobs=refreshStageJobsPath?JSON.parse(readFileSync(refreshStageJobsPath,"utf8")):{run_id:null,jobs:[]};
const openPulls=openPullsPath?JSON.parse(readFileSync(openPullsPath,"utf8")):[];
const homeworkPublications=publicationsPath?JSON.parse(readFileSync(publicationsPath,"utf8")):[];
const lunchPublications=lunchPublicationsPath?JSON.parse(readFileSync(lunchPublicationsPath,"utf8")):[];
const qaPublications=qaPublicationsPath?JSON.parse(readFileSync(qaPublicationsPath,"utf8")):[];
const mainBranchEvidence=mainBranchPath?JSON.parse(readFileSync(mainBranchPath,"utf8")):null;
const liveParityPath=process.env.SOURCE_RECOVERY_PLAN_FILE;
const publicationParity=assessPublicationParity(liveParityPath?JSON.parse(readFileSync(liveParityPath,"utf8")):null);

const productionRuns=runs.filter(run=>run.head_branch==="main"||run.event==="schedule");

const workflowNames={
  refresh:"Refresh ABVM teacher pages",
  qa:"ABVM App QA",
  deploy:"Deploy ABVM to GitHub Pages",
  watchdog:"Monitor ABVM refresh health",
  homework:"Refresh current ABVM homework",
  lunch:"Roll forward ABVM reviewed lunch week",
};
const runEvidenceAt=run=>Date.parse(run?.updated_at||run?.created_at||0)||0;
const runCreatedAt=run=>Date.parse(run?.created_at||0)||0;
const rankedRuns=name=>productionRuns.filter(run=>run.name===name).sort((a,b)=>runEvidenceAt(b)-runEvidenceAt(a));
const createdRuns=name=>productionRuns.filter(run=>run.name===name).sort((a,b)=>runCreatedAt(b)-runCreatedAt(a));
const latest=name=>rankedRuns(name)[0]||null;
const latestCreated=name=>createdRuns(name)[0]||null;
const latestCompleted=name=>rankedRuns(name).find(run=>run.conclusion)||null;
const decisiveConclusions=new Set(["success","failure","timed_out","action_required","startup_failure"]);
const latestDecisive=name=>rankedRuns(name).find(run=>decisiveConclusions.has(run.conclusion))||null;
const latestSuccess=name=>rankedRuns(name).find(run=>run.conclusion==="success")||null;
const recentRelevant=productionRuns.filter(run=>Object.values(workflowNames).includes(run.name)).sort((a,b)=>runEvidenceAt(b)-runEvidenceAt(a)).slice(0,40);
const failures=recentRelevant.filter(run=>run.conclusion==="failure").map(run=>({
  name:run.name,id:run.id,created_at:run.created_at,html_url:run.html_url,
}));

const sourceCheckedAt=packData.sourceLastCheckedAt||packData.pack?.sourceCheckedAt||null;
const sourceAgeHours=sourceCheckedAt?(Date.now()-Date.parse(sourceCheckedAt))/3_600_000:null;
const contentPipeline=packData.pack?.contentPipeline||null;
const pipelineCoverage=Array.isArray(contentPipeline?.coverage)?contentPipeline.coverage:[];
const unsupportedTopics=pipelineCoverage.filter(row=>row?.status==="GENERATOR_UNSUPPORTED").map(row=>row.topic).filter(Boolean);
const sourceInsufficientTopics=pipelineCoverage.filter(row=>row?.status==="SOURCE_INSUFFICIENT").map(row=>row.topic).filter(Boolean);
const partiallyCoveredTopics=pipelineCoverage.filter(row=>row?.status==="PARTIALLY_COVERED").map(row=>row.topic).filter(Boolean);
const notPracticedByDesignTopics=pipelineCoverage.filter(row=>row?.status==="NOT_PRACTICED_BY_DESIGN").map(row=>row.topic).filter(Boolean);
const pipelineUnsupportedCount=Number.isFinite(Number(contentPipeline?.qa?.unsupportedSkillCount))
  ?Number(contentPipeline.qa.unsupportedSkillCount)
  :unsupportedTopics.length;
const now=new Date().toISOString();
const reportedWeekLabel=packData.pack?.weekLabel||null;
const postingWeekLabel=packData.pack?.teacherPostingWeekLabel||reportedWeekLabel;
const expectedWeekLabel=schoolWeekLabel(now,{calendarDisplay:true});
const upcomingLunch=assessUpcomingLunchCoverage(packData.pack,now);
const status={
  generatedAt:now,
  publicationParity,
  repositorySecurity:{mainBranch:assessMainBranchProtection(mainBranchEvidence)},
  appVersion:pkg.version,
  serviceWorkerCache:cache,
  gitSha:process.env.GITHUB_SHA||null,
  schoolData:{
    checkedAt:sourceCheckedAt,
    ageHours:sourceAgeHours===null?null:Number(sourceAgeHours.toFixed(2)),
    sourceSufficient:packData.pack?.sourceSufficient===true,
    sourcePages:packData.sourcePages?.length||0,
    sourceHash:packData.pack?.sourceHash||null,
    displayWeekLabel:reportedWeekLabel,
    teacherPostingWeekLabel:postingWeekLabel,
    expectedCalendarWeekLabel:expectedWeekLabel,
  },
  homework:assessHomeworkHealth(JSON.parse(readFileSync(new URL("../pages/data/homework-current.json",import.meta.url),"utf8")),now),
  lunch:{
    status:packData.pack?.lunchMenuSource?.status||"unknown",
    retrievalState:packData.pack?.lunchMenuSource?.retrievalState||"unknown",
    weekStart:packData.pack?.lunchMenuSource?.weekStart||null,
    weekEnd:packData.pack?.lunchMenuSource?.weekEnd||null,
    days:packData.pack?.lunchMenu?.length||0,
    missingDates:packData.pack?.lunchMenuSource?.missingDates||[],
    coverageThrough:packData.pack?.lunchMenuSource?.coverageThrough||null,
    pendingDocuments:packData.pack?.lunchMenuSource?.pendingDocuments||[],
    sourcePages:packData.pack?.lunchMenuSource?.sourcePages||[],
    lastError:packData.pack?.lunchMenuSource?.lastError||null,
    upcomingWeek:upcomingLunch,
  },
  contentPipeline:{
    present:Boolean(contentPipeline),
    qaStatus:contentPipeline?.qa?.status||"missing",
    safetyState:contentPipeline?.safetyState||"missing",
    skillCount:Number(contentPipeline?.qa?.skillCount||contentPipeline?.skills?.length||0),
    questionCount:Number(contentPipeline?.qa?.questionCount||contentPipeline?.questions?.length||0),
    sourceInsufficientCount:Number(contentPipeline?.qa?.sourceInsufficientCount||sourceInsufficientTopics.length||0),
    partiallyCoveredCount:partiallyCoveredTopics.length,
    notPracticedByDesignCount:notPracticedByDesignTopics.length,
    unsupportedSkillCount:pipelineUnsupportedCount,
    snapshotScope:"last-published-pack",
    lineageRequired:contentPipeline?.sourcePolicy?.requirePageExactLineage===true,
    pageExactLineageCount:Number(contentPipeline?.qa?.pageExactLineageCount||0),
    unresolvedLineageCount:Number(contentPipeline?.qa?.unresolvedLineageCount||0),
    sourceInsufficientTopics,
    partiallyCoveredTopics,
    notPracticedByDesignTopics,
    unsupportedTopics,
  },
  workflows:{
    refresh:{latest:latest(workflowNames.refresh),latestCreated:latestCreated(workflowNames.refresh),latestCompleted:latestCompleted(workflowNames.refresh),latestDecisive:latestDecisive(workflowNames.refresh),latestSuccess:latestSuccess(workflowNames.refresh)},
    homework:{latest:latest(workflowNames.homework),latestCreated:latestCreated(workflowNames.homework),latestCompleted:latestCompleted(workflowNames.homework),latestDecisive:latestDecisive(workflowNames.homework),latestSuccess:latestSuccess(workflowNames.homework)},
    lunch:{latest:latest(workflowNames.lunch),latestCreated:latestCreated(workflowNames.lunch),latestCompleted:latestCompleted(workflowNames.lunch),latestDecisive:latestDecisive(workflowNames.lunch),latestSuccess:latestSuccess(workflowNames.lunch)},
    qa:{latest:latest(workflowNames.qa),latestCreated:latestCreated(workflowNames.qa),latestCompleted:latestCompleted(workflowNames.qa),latestDecisive:latestDecisive(workflowNames.qa),latestSuccess:latestSuccess(workflowNames.qa)},
    deploy:{latest:latest(workflowNames.deploy),latestCreated:latestCreated(workflowNames.deploy),latestCompleted:latestCompleted(workflowNames.deploy),latestDecisive:latestDecisive(workflowNames.deploy),latestSuccess:latestSuccess(workflowNames.deploy)},
    watchdog:{latest:latest(workflowNames.watchdog),latestCreated:latestCreated(workflowNames.watchdog),latestCompleted:latestCompleted(workflowNames.watchdog),latestDecisive:latestDecisive(workflowNames.watchdog),latestSuccess:latestSuccess(workflowNames.watchdog)},
  },
  recentFailures:failures,
};
const SOURCE_FRESH_HOURS=16;
const sourceFresh=sourceAgeHours!==null&&sourceAgeHours>=-.25&&sourceAgeHours<=SOURCE_FRESH_HOURS;
const runAgeHours=run=>run?.created_at?(Date.now()-Date.parse(run.created_at))/3_600_000:null;
const effectiveRun=workflow=>selectEffectiveWorkflowRun(workflow);
const completedRunHealthy=(run,maxAgeHours)=>{
  if(!run||run.conclusion!=="success")return false;
  const age=runAgeHours(run);
  return age!==null&&age>=-.25&&age<=maxAgeHours;
};
const completedHealthy=(workflow,maxAgeHours)=>completedRunHealthy(effectiveRun(workflow),maxAgeHours);
const effectivePublicationRun=()=>selectPublicationEvidence(
  effectiveRun(status.workflows.deploy),
  effectiveRun(status.workflows.refresh),
  homeworkPublications.filter(run=>run.head_branch==="main"&&run.name===workflowNames.homework&&
    Number.isInteger(run.publisherJobId)).sort((a,b)=>runEvidenceAt(b)-runEvidenceAt(a))[0]||null,
  lunchPublications.filter(run=>run.head_branch==="main"&&run.name===workflowNames.lunch&&
    Number.isInteger(run.publisherJobId)).sort((a,b)=>runEvidenceAt(b)-runEvidenceAt(a))[0]||null
);
status.publicationEvidence=effectivePublicationRun();
status.qaEvidence=selectQaEvidence(effectiveRun(status.workflows.qa),qaPublications);
const effectiveRefreshRun=effectiveRun(status.workflows.refresh);
const curriculumHoldRefreshRun=selectRefreshFailureEvidence(productionRuns,refreshJobsData);
status.curriculumHold=selectGovernedCurriculumHold(curriculumHoldRefreshRun,refreshJobsData,openPulls);
// The last published pack and the latest teacher refresh are different snapshots.
// A published-pack generator count of zero must not imply a blocked refresh
// has no new gaps or that an educator approved unpublished curriculum.
status.curriculumReview={
  state:status.curriculumHold?"automated-qa-hold":"not-established",
  evidence:status.curriculumHold?"exact-failed-refresh-step-and-open-draft":"not-available",
  candidatePrNumber:status.curriculumHold?.candidatePrNumber||null,
  automatedPromotion:false,
};
status.refreshStage=refreshStageJobsPath?(await import("./refresh-stage-health.mjs")).selectPublishedRefreshStage({
  refreshRun:status.workflows.refresh.latestCreated,refreshJobs:refreshStageJobs,
  publicationRun:status.publicationEvidence,watchdogRun:effectiveRun(status.workflows.watchdog),sourceCheckedAt,
}):null;
const refreshDisplayRun=status.curriculumHold?curriculumHoldRefreshRun:effectiveRefreshRun;
const refreshHealthy=completedHealthy(status.workflows.refresh,30);
status.refreshRecovery=selectRecoveredRefreshRace({
  refreshRun:effectiveRefreshRun,
  refreshJobs:refreshJobsData,
  publicationRun:status.publicationEvidence,
  watchdogRun:effectiveRun(status.workflows.watchdog),
  sourceCheckedAt,
});
// A superseded cancelled publisher is recoverable only after independent
// exact-main publication and a later live watchdog both succeed.
status.cancelledRefreshRecovery=!status.curriculumHold?selectRecoveredCancelledRefresh({
  refreshRun:effectiveRefreshRun,refreshJobs:cancelledRefreshJobsData,
  publicationRun:status.publicationEvidence,watchdogRun:effectiveRun(status.workflows.watchdog),
  sourceCheckedAt,homeworkCheckedAt:status.homework.checkedAt,
}):null;
const refreshOperationallyHealthy=refreshHealthy||Boolean(status.refreshRecovery)||Boolean(status.cancelledRefreshRecovery);
const pipelineHealthy=Boolean(
  status.contentPipeline.present &&
  status.contentPipeline.qaStatus==="pass" &&
  ["SAFE_PARTIAL","READY"].includes(status.contentPipeline.safetyState) &&
  (!status.contentPipeline.lineageRequired || (
    status.contentPipeline.unresolvedLineageCount===0 &&
    status.contentPipeline.pageExactLineageCount===status.contentPipeline.questionCount
  ))
);
const lunchReviewedCoverageComplete=Boolean(
  status.lunch.days>0 &&
  status.lunch.missingDates.length===0 &&
  status.lunch.pendingDocuments.length===0 &&
  status.lunch.coverageThrough &&
  status.lunch.sourcePages.length>0 &&
  status.lunch.sourcePages.every(page=>
    page?.reviewedAt &&
    page?.checkedAt &&
    /^[a-f0-9]{64}$/i.test(String(page?.contentHash||""))
  )
);
const targetLunchWeek=displayedSchoolWeekDates(now);
status.lunch.currentWeek=status.lunch.weekStart===targetLunchWeek[0]&&
  status.lunch.weekEnd===targetLunchWeek.at(-1);
const lunchVerified=status.lunch.retrievalState==="verified";
const lunchOperationallyUsable=Boolean(
  lunchVerified ||
  (status.lunch.retrievalState==="unavailable"&&lunchReviewedCoverageComplete)
);
const criticalHealthy=Boolean(
  status.schoolData.sourceSufficient &&
  status.schoolData.sourcePages===6 &&
  sourceFresh &&
  status.homework.healthy &&
  lunchOperationallyUsable &&
  status.lunch.currentWeek &&
  completedRunHealthy(status.qaEvidence,48) &&
  completedRunHealthy(status.publicationEvidence,48) &&
  (refreshOperationallyHealthy || Boolean(status.refreshStage)) &&
  completedHealthy(status.workflows.watchdog,30) &&
  pipelineHealthy &&
  publicationParity.verified
);
status.homeworkPolling=assessHomeworkPollingCadence(productionRuns,now);
const warnings=[];
if(publicationParity.state==="mismatch")warnings.push("Confirmed public study-pack/Homework deployment mismatch: curriculum "+publicationParity.curriculum+"; Homework "+publicationParity.homework+". Recent successful jobs alone cannot certify current public content.");
if(publicationParity.state==="unknown")warnings.push("Live school publication parity is unavailable or unverified; never assert a healthy published site without both exact file comparisons.");
if(status.refreshStage)warnings.push("The newest teacher source passed every source/QA/commit gate and a later guarded publication plus live watchdog verified it. Its parent workflow is still running; historical failures are retained, not relabeled as success.");
if(status.homeworkPolling.state==="delayed"){
  if(status.homeworkPolling.offHours===true){
    warnings.push("Scheduled Homework polling missed an expected school-time check after the 90-minute grace: "+
      status.homeworkPolling.expectedSchoolDate+" "+status.homeworkPolling.expectedLocalTime+
      " America/New_York. Last observed scheduled run: "+status.homeworkPolling.lastScheduledAt+
      ". A previous night or morning polling gap is not erased by entering off-hours.");
  }else{
    warnings.push("Scheduled hourly Homework polling is delayed: the last actual cron run was "+
      status.homeworkPolling.ageHours+"h ago. A successful manual, push or recovery run does not prove the hourly schedule was delivered.");
  }
}
if(status.homeworkPolling.state==="unknown"){
  warnings.push("No valid scheduled Homework polling run was observed in the available workflow history during active school hours.");
}
if(Number.isFinite(status.homeworkPolling.observedGapHours)){
  warnings.push("Scheduled Homework polling had an observed "+
    status.homeworkPolling.observedGapHours+"h same-day gap between "+
    status.homeworkPolling.gapFrom+" and "+status.homeworkPolling.gapTo+
    ". The latest scheduled run may be current, but it cannot retroactively establish missing school-day polls.");
}
if(mainBranchPath && status.repositorySecurity.mainBranch.state==="unprotected"){
  warnings.push("GitHub main is unprotected: in Settings > Branches, block force pushes and deletion while preserving verified direct fast-forward teacher and homework updates.");
}
if(mainBranchPath && status.repositorySecurity.mainBranch.state==="unknown"){
  warnings.push("GitHub main branch protection could not be verified; do not report repository security as healthy.");
}
if(status.refreshRecovery)warnings.push("The teacher refresh and reviewed lunch QA passed, but the Pages release safely stopped when main advanced. A later gated publication and live freshness watchdog confirmed recovery.");
if(status.cancelledRefreshRecovery)warnings.push("The teacher and lunch source checks passed, but their nested browser install was cancelled. A later protected-main Pages release and independent live watchdog proved recovery; the cancelled workflow remains in history.");
if(reportedWeekLabel!==expectedWeekLabel){
  warnings.push("School-data week label "+(reportedWeekLabel||"is missing")+" does not match the displayed "+expectedWeekLabel+"; retain the actual teacher-posting week for assignments.");
}
if(!status.lunch.currentWeek){
  warnings.push("Published reviewed lunch week "+(status.lunch.weekStart||"unknown")+
    "–"+(status.lunch.weekEnd||"unknown")+" is not current "+
    targetLunchWeek[0]+"–"+targetLunchWeek.at(-1)+
    "; the isolated reviewed-lunch recovery must publish exact current-week data.");
}
if(upcomingLunch.missingDates.length){
  warnings.push("Upcoming school-week lunch archive has no verified menu or explicit no-school status for: "+upcomingLunch.missingDates.join(", ")+".");
}
if(sourceInsufficientTopics.length){
  warnings.push(sourceInsufficientTopics.length+" study topic(s) have insufficient verified teacher-source detail for full practice: "+sourceInsufficientTopics.join(", ")+". No definitions or lesson facts were invented.");
}
if(status.contentPipeline.unsupportedSkillCount>0){
  warnings.push("Practice questions remain isolated for "+status.contentPipeline.unsupportedSkillCount+" verified topic(s): "+(status.contentPipeline.unsupportedTopics.join(", ")||"details unavailable")+". Verified source facts remain publishable.");
}
if(status.curriculumHold){
  warnings.push("Teacher refresh is awaiting automated curriculum quality checks for candidate PR #"+status.curriculumHold.candidatePrNumber+"; no educator or owner approval is required.");
}
if(!lunchVerified&&lunchOperationallyUsable){
  warnings.push("Lunch source bridge is unavailable; complete previously reviewed coverage remains usable"+(status.lunch.lastError?" ("+status.lunch.lastError+")":"")+".");
}
status.warnings=warnings;
status.overall=criticalHealthy?(warnings.length?"attention":"healthy"):"critical";

mkdirSync("health-output",{recursive:true});
writeFileSync("health-output/abvm-health-status.json",JSON.stringify(status,null,2)+"\n");

const line=(label,run)=>`- **${label}:** ${run?(run.conclusion||run.status)+" — "+run.created_at+" ([run]("+run.html_url+"))":"No run found"}`;
const md=[
  "# ABVM operational health",
  "",
  `**Overall: ${status.overall.toUpperCase()}**`,
  "",
  `- **School data checked:** ${sourceCheckedAt||"missing"}${sourceAgeHours===null?"":` (${sourceAgeHours.toFixed(1)}h old)`}`,
  `- **School-week labels:** Calendar ${expectedWeekLabel}; pack ${reportedWeekLabel||"missing"}; teacher posting ${postingWeekLabel||"missing"}`,
  `- **Upcoming week lunches (${upcomingLunch.weekLabel}):** missing verified or no-school entries: ${upcomingLunch.missingDates.join(", ")||"none"}`,
  `- **Source coverage:** ${status.schoolData.sourcePages}/6 teacher pages; source sufficient = ${status.schoolData.sourceSufficient}; fresh <=${SOURCE_FRESH_HOURS}h = ${sourceFresh}`,
  `- **Homework checked:** ${status.homework.checkedAt||"missing"}; status ${status.homework.status}; scheduled school-day window and <=8h = ${status.homework.healthy}`,
  `- **Hourly Homework cron:** ${status.homeworkPolling.state}; last scheduled ${status.homeworkPolling.lastScheduledAt||"not observed"}; age ${status.homeworkPolling.ageHours===null?"n/a":status.homeworkPolling.ageHours+"h"}`,
  `- **Lunch source:** ${status.lunch.retrievalState}; ${status.lunch.days} reviewed days; current published week = ${status.lunch.currentWeek}; complete reviewed coverage = ${lunchReviewedCoverageComplete}; missing dates: ${status.lunch.missingDates.join(", ")||"none"}`,
  `- **Grade 2 content pipeline:** QA ${status.contentPipeline.qaStatus}; safety ${status.contentPipeline.safetyState}; ${status.contentPipeline.skillCount} skills; ${status.contentPipeline.questionCount} questions; partial ${status.contentPipeline.partiallyCoveredCount}; source-insufficient ${status.contentPipeline.sourceInsufficientCount}; not-practiced-by-design ${status.contentPipeline.notPracticedByDesignCount}; unsupported ${status.contentPipeline.unsupportedSkillCount}`,
  `- **Question lineage:** required = ${status.contentPipeline.lineageRequired}; page-exact ${status.contentPipeline.pageExactLineageCount}/${status.contentPipeline.questionCount}; unresolved ${status.contentPipeline.unresolvedLineageCount}`,
  `- **Live study-pack and Homework parity:** curriculum ${publicationParity.curriculum}; Homework ${publicationParity.homework}; overall ${publicationParity.state}`,
  `- **Partially covered study topics:** ${status.contentPipeline.partiallyCoveredTopics.join(", ")||"none"}`,
  `- **Source-insufficient study topics:** ${status.contentPipeline.sourceInsufficientTopics.join(", ")||"none"}`,
  `- **Intentionally not practiced:** ${status.contentPipeline.notPracticedByDesignTopics.join(", ")||"none"}`,
  `- **Published-pack generator-unsupported topics (snapshot):** ${status.contentPipeline.unsupportedTopics.join(", ")||"none in last published pack"}; NOT a claim about the newest teacher refresh`,
  `- **Latest refresh curriculum gate:** ${status.curriculumReview.state==="automated-qa-hold"?"AUTOMATED QA HOLD — unresolved candidate PR #"+status.curriculumReview.candidatePrNumber:"No verified hold evidence; newest teacher coverage is not established by the last published pack"}`,
  `- **Curriculum hold:** ${status.curriculumHold?"draft PR #"+status.curriculumHold.candidatePrNumber+"; publication intentionally blocked":"none verified in available workflow evidence"}`,
  `- **App version:** ${status.appVersion}`,
  `- **Service worker cache:** ${status.serviceWorkerCache}`,
  `- **Main branch protection:** ${status.repositorySecurity.mainBranch.state.toUpperCase()} (GitHub branch-status evidence)`,
  `- **Git SHA:** ${status.gitSha||"unknown"}`,
  "",
  ...(warnings.length?["## Attention items",...warnings.map(w=>"- "+w),""]:[]),
  "## Workflow evidence used for health verdict",
  line("Teacher refresh",refreshDisplayRun),
  ...(status.refreshStage?[line("Current teacher workflow",status.workflows.refresh.latestCreated)]:[]),
  `- **Verified source stage:** ${status.refreshStage?"job "+status.refreshStage.sourceJobId+"; live publication "+status.refreshStage.publisherRunId+"; watchdog "+status.refreshStage.watchdogRunId+"; parent still pending":"no separate pending-parent proof"}`,
  `- **Guarded refresh race recovery:** ${status.refreshRecovery?"verified by publication "+status.refreshRecovery.publisherRunId+" and watchdog "+status.refreshRecovery.watchdogRunId:"not established"}`,
  `- **Cancelled publisher recovery:** ${status.cancelledRefreshRecovery?"verified by publication "+status.cancelledRefreshRecovery.publisherRunId+" and watchdog "+status.cancelledRefreshRecovery.watchdogRunId:"not established"}`,
  line("Homework refresh",effectiveRun(status.workflows.homework)),
  line("Reviewed lunch rollover",effectiveRun(status.workflows.lunch)),
  line("App QA (standalone or verified release)",status.qaEvidence),
  line("Publication evidence",status.publicationEvidence),
  line("Standalone Pages deploy",effectiveRun(status.workflows.deploy)),
  line("Refresh watchdog",effectiveRun(status.workflows.watchdog)),
  `- **Required successful-run age:** refresh/watchdog <=30h; QA/publication <=48h`,
  "",
  "## Recent relevant failures",
  failures.length?failures.map(f=>`- ${f.name} — ${f.created_at} ([run](${f.html_url}))`).join("\n"):"- None in the fetched run window.",
  "",
].join("\n");
writeFileSync("health-output/abvm-health-summary.md",md);
console.log(md);
if(status.overall==="critical")process.exitCode=1;

