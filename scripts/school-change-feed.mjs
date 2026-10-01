import {createHash} from 'node:crypto';

const SUBJECTS=['Reading / ELA','Spelling / Handwriting','Math','Religion'];
const ALLOWED_KINDS=new Set(['new-skill','review-skill','removed-skill','event','lunch','unchanged']);
const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const normalize=value=>text(value).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const hash=value=>createHash('sha256').update(String(value??'')).digest('hex').slice(0,12);

function skillMap(pack,subject){
  return new Map((pack?.contentPipeline?.skills||[])
    .filter(row=>text(row?.subject)===subject)
    .map(row=>[text(row?.id),text(row?.label)||text(row?.id)])
    .filter(([id])=>id));
}
function eventKey(row){return normalize(`${row?.date||''}|${row?.label||''}|${row?.source||''}`)}
function lunchSignature(pack){
  return JSON.stringify((pack?.lunchMenu||[]).map(row=>({date:text(row?.date||row?.day),meal:text(row?.meal||row?.menu||row?.items)})));
}
function matchingTest(pack,label){
  const terms=normalize(label).split(' ').filter(term=>term.length>=4);
  return (pack?.importantDates||[]).find(row=>{
    if(!/test|grammar|spelling|handwriting|math/i.test(text(row?.kind)+' '+text(row?.label)))return false;
    const hay=new Set(normalize(row?.label).split(' ').filter(Boolean));
    return terms.length&&terms.every(term=>hay.has(term));
  })||null;
}
function item(kind,subject,message){
  return {id:`change-${hash(kind+'|'+subject+'|'+message)}`,kind,subject:text(subject),text:text(message)};
}

export function buildSchoolChangeFeed({previousPack={},currentPack={},generatedAt=new Date().toISOString(),sourceHash=''}={}){
  const changed=[],unchanged=[];
  for(const subject of SUBJECTS){
    const before=skillMap(previousPack,subject),after=skillMap(currentPack,subject);
    const added=[...after].filter(([id])=>!before.has(id));
    const removed=[...before].filter(([id])=>!after.has(id));
    for(const [,label] of added){
      const test=matchingTest(currentPack,label);
      changed.push(item('new-skill',subject,`New: ${subject} — ${label}${test?.date?`, test ${text(test.date)}`:''}`));
    }
    const reviewIds=new Set((currentPack?.recentReviewPipeline?.skills||[]).map(row=>text(row?.id)).filter(Boolean));
    for(const [id,label] of removed){
      if(reviewIds.has(id))changed.push(item('review-skill',subject,`Moved to recent review: ${subject} — ${label}`));
      else changed.push(item('removed-skill',subject,`Removed from current week: ${subject} — ${label}`));
    }
    if(!added.length&&!removed.length)unchanged.push(item('unchanged',subject,`No changes to ${subject}.`));
  }

  const beforeEvents=new Set((previousPack?.importantDates||[]).map(eventKey));
  for(const row of currentPack?.importantDates||[]){
    if(!row?.label||beforeEvents.has(eventKey(row)))continue;
    if(!['teacher-home','teacher-tests','uploaded-notice'].includes(text(row?.source)))continue;
    changed.push(item('event','School',`Added school event: ${text(row.label)}${row?.date?` — ${text(row.date)}`:''}`));
  }
  if(lunchSignature(previousPack)!==lunchSignature(currentPack)){
    changed.push(item('lunch','Lunch','Lunch menu updated.'));
  }

  const dedupe=new Map();
  for(const row of [...changed,...unchanged])if(row.text&&!dedupe.has(row.text))dedupe.set(row.text,row);
  return {
    schemaVersion:1,
    generatedAt:new Date(generatedAt).toISOString(),
    sourceHash:text(sourceHash||currentPack?.sourceHash),
    changed:changed.length>0,
    items:[...dedupe.values()].slice(0,12),
  };
}

export function validateSchoolChangeFeed(feed){
  const issues=[];
  if(!feed||typeof feed!=='object')return ['change-feed-missing'];
  if(feed.schemaVersion!==1)issues.push('change-feed-schema-invalid');
  if(!Number.isFinite(Date.parse(feed.generatedAt||'')))issues.push('change-feed-generated-at-invalid');
  if(!text(feed.sourceHash))issues.push('change-feed-source-hash-missing');
  if(!Array.isArray(feed.items)||feed.items.length>12)issues.push('change-feed-items-invalid');
  for(const row of feed.items||[]){
    if(!text(row?.id))issues.push('change-feed-id-missing');
    if(!ALLOWED_KINDS.has(row?.kind))issues.push(`change-feed-kind-invalid:${text(row?.kind)}`);
    if(!text(row?.text))issues.push(`change-feed-text-missing:${text(row?.id)}`);
  }
  return [...new Set(issues)];
}
