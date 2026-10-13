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

// A newer automated notice must not silently reverse a parent-confirmed
// Grade 2 date from the currently reviewed teacher planner. A genuine
// correction requires a new reviewed sourcePrecedence receipt.
const MONTH_INDEX={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
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
function reviewedPlannerDateConflicts(uploaded){
  const precedence=uploaded?.sourcePrecedence;
  if(!precedence)return [];
  const errors=[];
  const documents=uploaded.documents||[];
  const id=precedence.authoritativeCurrentDocument;
  const authority=documents.find(doc=>doc.id===id);
  if(!id||!authority||authority.review?.status!=="reviewed"||
     /^automated-/i.test(String(authority.review?.reviewedBy||""))){
    return ["sourcePrecedence must name an existing, manually reviewed teacher/parent authority"];
  }
  const authorityTime=Date.parse(authority.receivedAt);
  if(!Number.isFinite(authorityTime))return ["authoritative planner receivedAt is invalid"];
  const canonical=new Map();
  for(const entry of (uploaded.importantDates||[]).filter(x=>x.sourceDocument===id)){
    const topic=schoolEventTopic(entry.label);
    if(topic)canonical.set(topic,entry.date);
  }
  for(const entry of (uploaded.reminders||[]).filter(x=>x.sourceDocument===id)){
    const topic=schoolEventTopic(entry.text);
    if(topic&&!canonical.has(topic))canonical.set(topic,entry.text);
  }
  for(const entry of uploaded.importantDates||[]){
    if(entry.sourceDocument===id)continue;
    const doc=documents.find(d=>d.id===entry.sourceDocument);
    if(!doc)continue; // Other existing document-reference checks remain separate.
    const docTime=Date.parse(doc.receivedAt);
    if(!Number.isFinite(docTime)){
      errors.push("notice "+doc.id+" has invalid receivedAt");
      continue;
    }
    // Older evidence stays in document history, but cannot re-enter the current calendar
    // at a conflicting date through a delayed/out-of-order import.
    const topic=schoolEventTopic(entry.label);
    if(!topic||!canonical.has(topic))continue;
    const confirmed=nearestSchoolDate(canonical.get(topic),authorityTime);
    const proposed=nearestSchoolDate(entry.date,authorityTime);
    if(confirmed===null||proposed===null){
      errors.push("cannot reconcile newer "+topic+" date without human review");
    }else if(proposed!==confirmed&&Math.abs(proposed-confirmed)<=14*86400000){
      errors.push("newer "+doc.id+" conflicts with parent-confirmed "+topic+
        " date; review teacher source and update sourcePrecedence before publication");
    }
  }
  return errors;
}

export function validateUploadedNoticePolicy(uploaded){
  const errors=[];
  if(uploaded?.schemaVersion!==2)errors.push("uploaded notices schemaVersion must be 2");
  if(!Array.isArray(uploaded?.documents)||!uploaded.documents.length)errors.push("uploaded notices must contain documents");
  for(const doc of uploaded?.documents||[]){
    if(!doc.id||!doc.label||!doc.receivedAt||!Array.isArray(doc.facts)||!doc.facts.length){
      errors.push(`document ${doc.id||"unknown"} is incomplete`);continue;
    }
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
  errors.push(...reviewedPlannerDateConflicts(uploaded));
  const text=allPublishedText(uploaded||{documents:[],importantDates:[],reminders:[],parentNotices:[]});
  for(const [name,pattern] of HIGH_CONFIDENCE_PII){
    if(pattern.test(text))errors.push(`uploaded notice content contains possible ${name}; manual redaction is required`);
  }
  if(errors.length)throw new Error("Uploaded notice policy failed:\n- "+errors.join("\n- "));
  return{documents:uploaded.documents.length,policy:"provenance+pii-review-v1"};
}
