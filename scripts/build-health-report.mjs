import {readFileSync,mkdirSync,writeFileSync} from "node:fs";

const packData=JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8"));
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const sw=readFileSync(new URL("../pages/sw.js",import.meta.url),"utf8");
const cache=(sw.match(/const CACHE = "([^"]+)"/)||[])[1]||"unknown";
const runsPath=process.env.WORKFLOW_RUNS_FILE;
const runs=runsPath?JSON.parse(readFileSync(runsPath,"utf8")).workflow_runs||[]:[];

const productionRuns=runs.filter(run=>run.head_branch==="main"||run.event==="schedule");

const workflowNames={
  refresh:"Refresh ABVM teacher pages",
  qa:"ABVM App QA",
  deploy:"Deploy ABVM to GitHub Pages",
  watchdog:"Monitor ABVM refresh health",
};
const runEvidenceAt=run=>Date.parse(run?.updated_at||run?.created_at||0)||0;
const rankedRuns=name=>productionRuns.filter(run=>run.name===name).sort((a,b)=>runEvidenceAt(b)-runEvidenceAt(a));
const latest=name=>rankedRuns(name)[0]||null;
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
const status={
  generatedAt:now,
  appVersion:pkg.version,
  serviceWorkerCache:cache,
  gitSha:process.env.GITHUB_SHA||null,
  schoolData:{
    checkedAt:sourceCheckedAt,
    ageHours:sourceAgeHours===null?null:Number(sourceAgeHours.toFixed(2)),
    sourceSufficient:packData.pack?.sourceSufficient===true,
    sourcePages:packData.sourcePages?.length||0,
    sourceHash:packData.pack?.sourceHash||null,
  },
  lunch:{status:packData.pack?.lunchMenuSource?.status||"unknown",retrievalState:packData.pack?.lunchMenuSource?.retrievalState||"unknown",days:packData.pack?.lunchMenu?.length||0,missingDates:packData.pack?.lunchMenuSource?.missingDates||[]},
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
    lineageRequired:contentPipeline?.sourcePolicy?.requirePageExactLineage===true,
    pageExactLineageCount:Number(contentPipeline?.qa?.pageExactLineageCount||0),
    unresolvedLineageCount:Number(contentPipeline?.qa?.unresolvedLineageCount||0),
    sourceInsufficientTopics,
    partiallyCoveredTopics,
    notPracticedByDesignTopics,
    unsupportedTopics,
  },
  workflows:{
    refresh:{latest:latest(workflowNames.refresh),latestCompleted:latestCompleted(workflowNames.refresh),latestDecisive:latestDecisive(workflowNames.refresh),latestSuccess:latestSuccess(workflowNames.refresh)},
    qa:{latest:latest(workflowNames.qa),latestCompleted:latestCompleted(workflowNames.qa),latestDecisive:latestDecisive(workflowNames.qa),latestSuccess:latestSuccess(workflowNames.qa)},
    deploy:{latest:latest(workflowNames.deploy),latestCompleted:latestCompleted(workflowNames.deploy),latestDecisive:latestDecisive(workflowNames.deploy),latestSuccess:latestSuccess(workflowNames.deploy)},
    watchdog:{latest:latest(workflowNames.watchdog),latestCompleted:latestCompleted(workflowNames.watchdog),latestDecisive:latestDecisive(workflowNames.watchdog),latestSuccess:latestSuccess(workflowNames.watchdog)},
  },
  recentFailures:failures,
};
const sourceFresh=sourceAgeHours!==null&&sourceAgeHours>=-.25&&sourceAgeHours<=8;
const runAgeHours=run=>run?.created_at?(Date.now()-Date.parse(run.created_at))/3_600_000:null;
const activeStatuses=new Set(["queued","in_progress","waiting","pending","requested"]);
const effectiveRun=workflow=>{
  const latestRun=workflow.latest;
  const decisive=workflow.latestDecisive;
  const newerActive=latestRun&&activeStatuses.has(latestRun.status)&&(!decisive||Date.parse(latestRun.created_at)>=Date.parse(decisive.created_at));
  return newerActive?workflow.latestSuccess:decisive;
};
const completedHealthy=(workflow,maxAgeHours)=>{
  const run=effectiveRun(workflow);
  if(!run||run.conclusion!=="success")return false;
  const age=runAgeHours(run);
  return age!==null&&age>=-.25&&age<=maxAgeHours;
};
const pipelineHealthy=Boolean(
  status.contentPipeline.present &&
  status.contentPipeline.qaStatus==="pass" &&
  status.contentPipeline.unsupportedSkillCount===0 &&
  (!status.contentPipeline.lineageRequired || (
    status.contentPipeline.unresolvedLineageCount===0 &&
    status.contentPipeline.pageExactLineageCount===status.contentPipeline.questionCount
  ))
);
const healthy=Boolean(
  status.schoolData.sourceSufficient &&
  status.schoolData.sourcePages===6 &&
  sourceFresh &&
  status.lunch.retrievalState==="verified" &&
  status.lunch.days>0 &&
  completedHealthy(status.workflows.qa,48) &&
  completedHealthy(status.workflows.deploy,48) &&
  completedHealthy(status.workflows.refresh,30) &&
  completedHealthy(status.workflows.watchdog,30) &&
  pipelineHealthy
);
status.overall=healthy?"healthy":"attention";

mkdirSync("health-output",{recursive:true});
writeFileSync("health-output/abvm-health-status.json",JSON.stringify(status,null,2)+"\n");

const line=(label,run)=>`- **${label}:** ${run?(run.conclusion||run.status)+" — "+run.created_at+" ([run]("+run.html_url+"))":"No run found"}`;
const md=[
  "# ABVM operational health",
  "",
  `**Overall: ${status.overall.toUpperCase()}**`,
  "",
  `- **School data checked:** ${sourceCheckedAt||"missing"}${sourceAgeHours===null?"":` (${sourceAgeHours.toFixed(1)}h old)`}`,
  `- **Source coverage:** ${status.schoolData.sourcePages}/6 teacher pages; source sufficient = ${status.schoolData.sourceSufficient}; fresh <=8h = ${sourceFresh}`,
  `- **Lunch source:** ${status.lunch.retrievalState}; ${status.lunch.days} reviewed days; missing dates: ${status.lunch.missingDates.join(", ")||"none"}`,
  `- **Grade 2 content pipeline:** QA ${status.contentPipeline.qaStatus}; safety ${status.contentPipeline.safetyState}; ${status.contentPipeline.skillCount} skills; ${status.contentPipeline.questionCount} questions; partial ${status.contentPipeline.partiallyCoveredCount}; source-insufficient ${status.contentPipeline.sourceInsufficientCount}; not-practiced-by-design ${status.contentPipeline.notPracticedByDesignCount}; unsupported ${status.contentPipeline.unsupportedSkillCount}`,
  `- **Question lineage:** required = ${status.contentPipeline.lineageRequired}; page-exact ${status.contentPipeline.pageExactLineageCount}/${status.contentPipeline.questionCount}; unresolved ${status.contentPipeline.unresolvedLineageCount}`,
  `- **Partially covered study topics:** ${status.contentPipeline.partiallyCoveredTopics.join(", ")||"none"}`,
  `- **Source-insufficient study topics:** ${status.contentPipeline.sourceInsufficientTopics.join(", ")||"none"}`,
  `- **Intentionally not practiced:** ${status.contentPipeline.notPracticedByDesignTopics.join(", ")||"none"}`,
  `- **Unsupported teacher skills:** ${status.contentPipeline.unsupportedTopics.join(", ")||"none"}`,
  `- **App version:** ${status.appVersion}`,
  `- **Service worker cache:** ${status.serviceWorkerCache}`,
  `- **Git SHA:** ${status.gitSha||"unknown"}`,
  "",
  "## Workflow evidence used for health verdict",
  line("Teacher refresh",effectiveRun(status.workflows.refresh)),
  line("App QA",effectiveRun(status.workflows.qa)),
  line("Pages deploy",effectiveRun(status.workflows.deploy)),
  line("Refresh watchdog",effectiveRun(status.workflows.watchdog)),
  `- **Required successful-run age:** refresh/watchdog <=30h; QA/deploy <=48h`,
  "",
  "## Recent relevant failures",
  failures.length?failures.map(f=>`- ${f.name} — ${f.created_at} ([run](${f.html_url}))`).join("\n"):"- None in the fetched run window.",
  "",
].join("\n");
writeFileSync("health-output/abvm-health-summary.md",md);
console.log(md);
if(!healthy)process.exitCode=1;
