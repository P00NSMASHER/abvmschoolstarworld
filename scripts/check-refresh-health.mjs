import {appendFileSync, readFileSync} from "node:fs";

const DATA_PATH=new URL("../pages/data/study-pack.json",import.meta.url);
const argv=process.argv.slice(2);

function option(name,fallback=null){
  const i=argv.indexOf(name);
  return i>=0&&argv[i+1]!==undefined?argv[i+1]:fallback;
}
const requireToday=argv.includes("--require-today");
const maxAgeHours=Number(option("--max-age-hours","8"));
const liveUrl=option("--live-url");
const waitSeconds=Math.max(0,Number(option("--wait-seconds","0"))||0);

function easternDateKey(value){
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))return"";
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(date);
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return map.year+"-"+map.month+"-"+map.day;
}
function isoDate(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?null:date;
}

const MONTH_INDEX={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
function parseFriendlySchoolDate(value,year){
  const match=String(value||"").match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s*(\d{1,2})/i);
  if(!match)return null;
  return new Date(Date.UTC(year,MONTH_INDEX[match[1].replace(".","").toLowerCase()],Number(match[2]),12));
}
function easternSchoolWeek(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const base=new Date(Date.UTC(Number(map.year),Number(map.month)-1,Number(map.day),12));
  const day=base.getUTCDay();
  base.setUTCDate(base.getUTCDate()-(day===0?6:day-1));
  const end=new Date(base);end.setUTCDate(base.getUTCDate()+4);
  return{start:base,end};
}
function validatePack(data,label,{freshness=true}={}){
  const errors=[];
  const pack=data?.pack||{};
  const expectedTitles=["Home","Homework","Reading Work","Weekly Spelling List","Tests","Religion"];
  const checked=isoDate(data?.sourceLastCheckedAt);
  const packChecked=isoDate(pack?.sourceCheckedAt);

  if(data?.delivery!=="verified")errors.push(label+": delivery is not verified");
  if(pack?.sourceSufficient!==true)errors.push(label+": pack.sourceSufficient is not true");
  if(!checked)errors.push(label+": sourceLastCheckedAt is missing or invalid");
  if(!packChecked)errors.push(label+": pack.sourceCheckedAt is missing or invalid");
  if(checked&&packChecked&&Math.abs(checked-packChecked)>60_000)errors.push(label+": source check timestamps disagree");
  if(!/^teacher-pages-[a-f0-9]{20}$/i.test(String(pack?.sourceHash||"")))errors.push(label+": sourceHash is missing or malformed");

  const sourcePages=Array.isArray(data?.sourcePages)?data.sourcePages:[];
  if(sourcePages.length<expectedTitles.length)errors.push(label+": source page count collapsed to "+sourcePages.length);
  for(const title of expectedTitles){
    if(!sourcePages.some(page=>page?.title===title))errors.push(label+": missing source page "+title);
  }
  const uniqueUrls=new Set(sourcePages.map(page=>page?.url).filter(Boolean));
  if(uniqueUrls.size<expectedTitles.length)errors.push(label+": source URLs are missing or duplicated");
  for(const page of sourcePages){
    if(!/^https:\/\/sites\.google\.com\/view\/abvmgr2\//.test(String(page?.url||"")))errors.push(label+": unexpected source URL for "+(page?.title||"unknown"));
    if(!isoDate(page?.checkedAt))errors.push(label+": invalid checkedAt for "+(page?.title||"unknown"));
    if(!/^[a-f0-9]{64}$/i.test(String(page?.contentHash||"")))errors.push(label+": invalid content hash for "+(page?.title||"unknown"));
  }

  if(!Array.isArray(pack?.homework)||pack.homework.length<1)errors.push(label+": homework set is empty");
  if(!Array.isArray(pack?.subjects)||pack.subjects.length<4)errors.push(label+": subject set is unexpectedly small");
  if(!Array.isArray(pack?.importantDates)||pack.importantDates.length<1)errors.push(label+": importantDates is empty");
  if(!Array.isArray(pack?.parentNotices))errors.push(label+": parentNotices is not an array");

  const lunchSource=pack?.lunchMenuSource||null;
  const lunchMenu=Array.isArray(pack?.lunchMenu)?pack.lunchMenu:[];
  const schoolWeek=easternSchoolWeek();
  const expectedStart=schoolWeek.start.toISOString().slice(0,10);
  const expectedEnd=schoolWeek.end.toISOString().slice(0,10);
  if(!lunchSource)errors.push(label+": lunchMenuSource is missing");
  else{
    if(lunchSource.provider!=="Saint Clair Area School District")errors.push(label+": lunch provider is not the official Saint Clair source");
    if(lunchSource.school!=="Assumption BVM School")errors.push(label+": lunch school is not Assumption BVM School");
    if(lunchSource.weekStart&&lunchSource.weekStart!==expectedStart)errors.push(label+": lunch source weekStart is not the current school week");
    if(lunchSource.weekEnd&&lunchSource.weekEnd!==expectedEnd)errors.push(label+": lunch source weekEnd is not the current school week");
    if(!["current-week","partial-current-week"].includes(String(lunchSource.status||"")))errors.push(label+": lunch source status is not current-week/partial-current-week");
    const lunchChecked=isoDate(lunchSource.checkedAt);
    if(!lunchChecked)errors.push(label+": lunch source checkedAt is missing or invalid");
    else if(freshness){
      const lunchAge=(Date.now()-lunchChecked.getTime())/3_600_000;
      if(lunchAge<-.25)errors.push(label+": lunch source timestamp is in the future");
      if(Number.isFinite(maxAgeHours)&&lunchAge>maxAgeHours)errors.push(label+": lunch source is "+lunchAge.toFixed(1)+"h old (limit "+maxAgeHours+"h)");
    }
  }
  if(lunchMenu.length<1)errors.push(label+": current-week lunch menu is empty");
  const lunchYear=schoolWeek.start.getUTCFullYear();
  for(const lunch of lunchMenu){
    const date=parseFriendlySchoolDate(lunch?.day,lunchYear);
    if(!date||date<schoolWeek.start||date>schoolWeek.end)errors.push(label+": stale/out-of-week lunch entry "+String(lunch?.day||"unknown"));
    if(!Array.isArray(lunch?.items)||lunch.items.length<1)errors.push(label+": lunch entry has no food items for "+String(lunch?.day||"unknown"));
  }

  if(!data?.syncPolicy?.primaryAt||!data?.syncPolicy?.backupAt)errors.push(label+": hardened primary/backup sync policy is missing");
  if(data?.syncPolicy?.retriesPerSource!==3)errors.push(label+": retriesPerSource must remain 3");

  if(freshness&&checked){
    const ageHours=(Date.now()-checked.getTime())/3_600_000;
    if(ageHours<-.25)errors.push(label+": source timestamp is in the future");
    if(Number.isFinite(maxAgeHours)&&ageHours>maxAgeHours)errors.push(label+": source data is "+ageHours.toFixed(1)+"h old (limit "+maxAgeHours+"h)");
    if(requireToday&&easternDateKey(checked)!==easternDateKey(new Date()))errors.push(label+": source data was not checked today in America/New_York");
  }
  return errors;
}
function readLocal(){
  return JSON.parse(readFileSync(DATA_PATH,"utf8"));
}
function sameRefresh(local,live){
  return local?.sourceLastCheckedAt===live?.sourceLastCheckedAt
    && local?.pack?.sourceHash===live?.pack?.sourceHash
    && local?.pack?.uploadedNoticeHash===live?.pack?.uploadedNoticeHash;
}
async function fetchLive(){
  const separator=liveUrl.includes("?")?"&":"?";
  const response=await fetch(liveUrl+separator+"health="+Date.now(),{
    headers:{"cache-control":"no-cache","user-agent":"ABVM-Refresh-Health/1.0"},
    signal:AbortSignal.timeout(15_000),
  });
  if(!response.ok)throw new Error("live pack returned HTTP "+response.status);
  return response.json();
}
function writeSummary(lines){
  const summary=process.env.GITHUB_STEP_SUMMARY;
  if(summary)appendFileSync(summary,lines.join("\n")+"\n","utf8");
}

const local=readLocal();
let errors=validatePack(local,"repository pack");
let live=null;
let liveError=null;

if(liveUrl){
  const deadline=Date.now()+waitSeconds*1000;
  do{
    try{
      live=await fetchLive();
      const candidateErrors=validatePack(live,"deployed pack");
      if(!sameRefresh(local,live))candidateErrors.push("deployed pack does not match the repository refresh timestamp/hash");
      if(candidateErrors.length===0){liveError=null;break}
      liveError=candidateErrors.join("; ");
    }catch(error){
      liveError=error instanceof Error?error.message:String(error);
    }
    if(Date.now()>=deadline)break;
    await new Promise(resolve=>setTimeout(resolve,10_000));
  }while(true);
  if(liveError)errors.push(liveError);
}

const checked=local?.sourceLastCheckedAt||"unknown";
const summary=[
  "## ABVM refresh health",
  "",
  "- Repository source check: **"+checked+"**",
  "- Expected source pages: **6**",
  "- Repository pack: **"+(errors.filter(e=>e.startsWith("repository pack")).length?"FAIL":"PASS")+"**",
  "- Deployed pack comparison: **"+(liveUrl?(liveError?"FAIL":"PASS"):"not requested")+"**",
  "- Freshness requirement: **"+(requireToday?"checked today":"<="+maxAgeHours+"h")+"**",
];
writeSummary(summary);

if(errors.length){
  console.error("ABVM refresh health FAILED");
  for(const error of errors)console.error("- "+error);
  process.exit(1);
}
console.log("ABVM refresh health passed:",{checkedAt:checked,sourcePages:local.sourcePages?.length||0,liveVerified:Boolean(liveUrl)});
