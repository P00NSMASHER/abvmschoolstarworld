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
  const text=allPublishedText(uploaded||{documents:[],importantDates:[],reminders:[],parentNotices:[]});
  for(const [name,pattern] of HIGH_CONFIDENCE_PII){
    if(pattern.test(text))errors.push(`uploaded notice content contains possible ${name}; manual redaction is required`);
  }
  if(errors.length)throw new Error("Uploaded notice policy failed:\n- "+errors.join("\n- "));
  return{documents:uploaded.documents.length,policy:"provenance+pii-review-v1"};
}
