import {readFileSync,mkdirSync,writeFileSync} from "node:fs";

const packData=JSON.parse(readFileSync(new URL("../pages/data/study-pack.json",import.meta.url),"utf8"));
const pkg=JSON.parse(readFileSync(new URL("../package.json",import.meta.url),"utf8"));
const sw=readFileSync(new URL("../pages/sw.js",import.meta.url),"utf8");
const cache=(sw.match(/const CACHE = "([^"]+)"/)||[])[1]||"unknown";
const runsPath=process.env.WORKFLOW_RUNS_FILE;
const runs=runsPath?JSON.parse(readFileSync(runsPath,"utf8")).workflow_runs||[]:[];

const workflowNames={
  refresh:"Refresh ABVM teacher pages",
  qa:"ABVM App QA",
  deploy:"Deploy ABVM to GitHub Pages",
  watchdog:"Monitor ABVM refresh health",
};
const latest=name=>runs.find(run=>run.name===name)||null;
const latestCompleted=name=>runs.find(run=>run.name===name&&run.conclusion)||null;
const latestSuccess=name=>runs.find(run=>run.name===name&&run.conclusion==="success")||null;
const recentRelevant=runs.filter(run=>Object.values(workflowNames).includes(run.name)).slice(0,40);
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
  workflows:{
    refresh:{latest:latest(workflowNames.refresh),latestCompleted:latestCompleted(workflowNames.refresh),latestSuccess:latestSuccess(workflowNames.refresh)},
    qa:{latest:latest(workflowNames.qa),latestCompleted:latestCompleted(workflowNames.qa),latestSuccess:latestSuccess(workflowNames.qa)},
    deploy:{latest:latest(workflowNames.deploy),latestCompleted:latestCompleted(workflowNames.deploy),latestSuccess:latestSuccess(workflowNames.deploy)},
    watchdog:{latest:latest(workflowNames.watchdog),latestCompleted:latestCompleted(workflowNames.watchdog),latestSuccess:latestSuccess(workflowNames.watchdog)},
  },
  recentFailures:failures,
};
const sourceFresh=sourceAgeHours!==null&&sourceAgeHours>=-.25&&sourceAgeHours<=30;
const completedHealthy=workflow=>{
  const run=workflow.latestCompleted;
  return !run||run.conclusion==="success";
};
const healthy=Boolean(
  status.schoolData.sourceSufficient &&
  status.schoolData.sourcePages===6 &&
  sourceFresh &&
  completedHealthy(status.workflows.qa) &&
  completedHealthy(status.workflows.deploy) &&
  completedHealthy(status.workflows.refresh) &&
  completedHealthy(status.workflows.watchdog)
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
  `- **Source coverage:** ${status.schoolData.sourcePages}/6 teacher pages; source sufficient = ${status.schoolData.sourceSufficient}; fresh <=30h = ${sourceFresh}`,
  `- **App version:** ${status.appVersion}`,
  `- **Service worker cache:** ${status.serviceWorkerCache}`,
  `- **Git SHA:** ${status.gitSha||"unknown"}`,
  "",
  "## Latest workflow state",
  line("Teacher refresh",status.workflows.refresh.latestCompleted||status.workflows.refresh.latest),
  line("App QA",status.workflows.qa.latestCompleted||status.workflows.qa.latest),
  line("Pages deploy",status.workflows.deploy.latestCompleted||status.workflows.deploy.latest),
  line("Refresh watchdog",status.workflows.watchdog.latestCompleted||status.workflows.watchdog.latest),
  "",
  "## Recent relevant failures",
  failures.length?failures.map(f=>`- ${f.name} — ${f.created_at} ([run](${f.html_url}))`).join("\n"):"- None in the fetched run window.",
  "",
].join("\n");
writeFileSync("health-output/abvm-health-summary.md",md);
console.log(md);
if(!healthy)process.exitCode=1;
