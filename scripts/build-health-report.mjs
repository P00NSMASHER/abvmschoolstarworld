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
const latest=name=>productionRuns.find(run=>run.name===name)||null;
const latestCompleted=name=>productionRuns.find(run=>run.name===name&&run.conclusion)||null;
const decisiveConclusions=new Set(["success","failure","timed_out","action_required","startup_failure"]);
const latestDecisive=name=>productionRuns.find(run=>run.name===name&&decisiveConclusions.has(run.conclusion))||null;
const latestSuccess=name=>productionRuns.find(run=>run.name===name&&run.conclusion==="success")||null;
const recentRelevant=productionRuns.filter(run=>Object.values(workflowNames).includes(run.name)).slice(0,40);
const failures=recentRelevant.filter(run=>run.conclusion==="failure").map(run=>({
  name:run.name,id:run.id,created_at:run.created_at,html_url:run.html_url,
}));

const sourceCheckedAt=packData.sourceLastCheckedAt||packData.pack?.sourceCheckedAt||null;
const sourceAgeHours=sourceCheckedAt?(Date.now()-Date.parse(sourceCheckedAt))/3_600_000:null;
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
const completedHealthy=(workflow,maxAgeHours)=>{
  const latestRun=workflow.latest;
  const decisive=workflow.latestDecisive;
  const newerActive=latestRun&&activeStatuses.has(latestRun.status)&&(!decisive||Date.parse(latestRun.created_at)>=Date.parse(decisive.created_at));
  const run=newerActive?workflow.latestSuccess:decisive;
  if(!run||run.conclusion!=="success")return false;
  const age=runAgeHours(run);
  return age!==null&&age>=-.25&&age<=maxAgeHours;
};
const healthy=Boolean(
  status.schoolData.sourceSufficient &&
  status.schoolData.sourcePages===6 &&
  sourceFresh &&
  status.lunch.retrievalState==="verified" &&
  status.lunch.days>0 &&
  completedHealthy(status.workflows.qa,48) &&
  completedHealthy(status.workflows.deploy,48) &&
  completedHealthy(status.workflows.refresh,30) &&
  completedHealthy(status.workflows.watchdog,30)
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
  `- **App version:** ${status.appVersion}`,
  `- **Service worker cache:** ${status.serviceWorkerCache}`,
  `- **Git SHA:** ${status.gitSha||"unknown"}`,
  "",
  "## Latest workflow state",
  line("Teacher refresh",status.workflows.refresh.latest||status.workflows.refresh.latestDecisive||status.workflows.refresh.latestCompleted),
  line("App QA",status.workflows.qa.latest||status.workflows.qa.latestDecisive||status.workflows.qa.latestCompleted),
  line("Pages deploy",status.workflows.deploy.latest||status.workflows.deploy.latestDecisive||status.workflows.deploy.latestCompleted),
  line("Refresh watchdog",status.workflows.watchdog.latest||status.workflows.watchdog.latestDecisive||status.workflows.watchdog.latestCompleted),
  `- **Required successful-run age:** refresh/watchdog <=30h; QA/deploy <=48h`,
  "",
  "## Recent relevant failures",
  failures.length?failures.map(f=>`- ${f.name} — ${f.created_at} ([run](${f.html_url}))`).join("\n"):"- None in the fetched run window.",
  "",
].join("\n");
writeFileSync("health-output/abvm-health-summary.md",md);
console.log(md);
if(!healthy)process.exitCode=1;
