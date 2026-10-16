import {createHash} from "node:crypto";

const SHA256=/^[a-f0-9]{64}$/i;
const HIGH_CONFIDENCE_PII=[
  ["email",/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["phone",/(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/],
  ["ssn",/\b\d{3}-\d{2}-\d{4}\b/],
  ["street-address",/\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,4}\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way)\b/i],
];

function factsHash(facts){
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}
function allPublishedText(uploaded){
  return [
    ...uploaded.documents.flatMap(d=>[d.label,...(d.facts||[])]),
    ...uploaded.importantDates.map(x=>x.label),
    ...uploaded.reminders.map(x=>x.text),
    ...uploaded.parentNotices.map(x=>x.text),
  ].join("\n");
}

// Keep every verified source record, while resolving the public calendar to
// the newest dated official evidence for the same nearby school event.
const MONTH_INDEX={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
const SCHOOL_EVENT_WINDOW_MS=14*86400000;
function schoolEventTopic(value){
  const text=String(value||"").toLowerCase();
  if(/progress reports?/.test(text))return "progress reports";
  if(/parent.teacher conferences?/.test(text)&&!/grades?\s*5\s*[-–]\s*8/.test(text))return "Grade 2 conferences";
  if(/lego club/.test(text))return "Lego Club";
  if(/chick[-\s]?fil[-\s]?a.*delivery/.test(text))return "Chick-fil-A delivery";
  if(/(?:k\s*[-–]?\s*4|grade 2).*flag football/.test(text))return "K–4 flag football";
  if(/winter uniform/.test(text))return "winter uniform";
  return "";
}
function schoolEventDate(value,year){
  const match=String(value||"").match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})\b/i);
  if(!match)return null;
  const month=MONTH_INDEX[match[1].toLowerCase()];
  const day=Number(match[2]);
  if(month===undefined||day<1||day>31)return null;
  // Use the school year nearest the received date, including Dec/Jan.
  return [year-1,year,year+1].map(y=>Date.UTC(y,month,day));
}
function nearestSchoolDate(value,anchor){
  const choices=schoolEventDate(value,new Date(anchor).getUTCFullYear());
  if(!choices)return null;
  return choices.reduce((best,day)=>Math.abs(day-anchor)<Math.abs(best-anchor)?day:best);
}
function sourcePrecedenceErrors(uploaded){
  const precedence=uploaded?.sourcePrecedence;
  if(!precedence)return [];
  const id=precedence.authoritativeCurrentDocument;
  const authority=(uploaded.documents||[]).find(doc=>doc.id===id);
  if(!id||!authority||!["reviewed","legacy-reviewed"].includes(authority.review?.status)){
    return ["sourcePrecedence must name an existing approved authority"];
  }
  return [];
}
export function currentImportantDates(uploaded){
  const entries=uploaded?.importantDates||[];
  const documents=new Map((uploaded?.documents||[]).map(doc=>[doc.id,doc]));
  const authorityId=uploaded?.sourcePrecedence?.authoritativeCurrentDocument;
  return entries.filter((entry,index)=>{
    const topic=schoolEventTopic(entry.label);
    if(!topic)return true;
    const received=Date.parse(documents.get(entry.sourceDocument)?.receivedAt||"");
    if(!Number.isFinite(received))return true; // Policy rejects invalid timestamps.
    const eventDate=nearestSchoolDate(entry.date,received);
    if(eventDate===null)return true;
    return !entries.some((other,otherIndex)=>{
      if(otherIndex===index||schoolEventTopic(other.label)!==topic)return false;
      const otherReceived=Date.parse(documents.get(other.sourceDocument)?.receivedAt||"");
      if(!Number.isFinite(otherReceived))return false;
      const otherDate=nearestSchoolDate(other.date,otherReceived);
      if(otherDate===null||otherDate===eventDate||Math.abs(otherDate-eventDate)>SCHOOL_EVENT_WINDOW_MS)return false;
      if(otherReceived!==received)return otherReceived>received;
      const otherIsAuthority=other.sourceDocument===authorityId;
      const entryIsAuthority=entry.sourceDocument===authorityId;
      if(otherIsAuthority!==entryIsAuthority)return otherIsAuthority;
      // Equal receipts are stable and deterministic; keep the first record.
      return otherIndex<index;
    });
  });
}

export function validateUploadedNoticePolicy(uploaded){
  const errors=[];
  if(uploaded?.schemaVersion!==2)errors.push("uploaded notices schemaVersion must be 2");
  if(!Array.isArray(uploaded?.documents)||!uploaded.documents.length)errors.push("uploaded notices must contain documents");
  for(const doc of uploaded?.documents||[]){
    if(!doc.id||!doc.label||!doc.receivedAt||!Array.isArray(doc.facts)||!doc.facts.length){
      errors.push(`document ${doc.id||"unknown"} is incomplete`);continue;
    }
    if(Number.isNaN(Date.parse(doc.receivedAt)))errors.push(`document ${doc.id} receivedAt is invalid`);
    const expected=factsHash(doc.facts);
    if(doc.provenance?.factsHash!==expected)errors.push(`document ${doc.id} factsHash does not match reviewed facts`);
    const sourceHash=doc.provenance?.sourceContentHash;
    const legacy=doc.review?.status==="legacy-reviewed";
    if(!legacy&&!SHA256.test(String(sourceHash||"")))errors.push(`document ${doc.id} requires a sourceContentHash`);
    if(legacy&&sourceHash!==null)errors.push(`legacy document ${doc.id} must use null sourceContentHash when original bytes are unavailable`);
    if(doc.review?.piiReviewed!==true)errors.push(`document ${doc.id} is missing explicit PII review`);
    if(!["reviewed","legacy-reviewed"].includes(doc.review?.status))errors.push(`document ${doc.id} review status is not approved`);
    if(!doc.review?.reviewedBy||Number.isNaN(Date.parse(doc.review?.reviewedAt||"")))errors.push(`document ${doc.id} review receipt is incomplete`);
  }
  errors.push(...sourcePrecedenceErrors(uploaded));
  const text=allPublishedText(uploaded||{documents:[],importantDates:[],reminders:[],parentNotices:[]});
  for(const [name,pattern] of HIGH_CONFIDENCE_PII){
    if(pattern.test(text))errors.push(`uploaded notice content contains possible ${name}; manual redaction is required`);
  }
  if(errors.length)throw new Error("Uploaded notice policy failed:\n- "+errors.join("\n- "));
  return{documents:uploaded.documents.length,policy:"provenance+pii+dated-precedence-v2"};
}
