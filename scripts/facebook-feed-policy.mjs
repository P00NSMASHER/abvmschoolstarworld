import {createHash} from 'node:crypto';

export const FACEBOOK_IDS=Object.freeze(['ABVM_SCHOOL_FACEBOOK','ABVM_HSA_FACEBOOK']);
export const FACEBOOK_CATEGORIES=Object.freeze([
  'Academic','Official school announcement','Calendar or schedule','Lunch',
  'School event','HSA event','Fundraiser','Volunteer opportunity','Deadline',
  'Cancellation or correction','General community news'
]);
const known=Object.freeze({
  ABVM_SCHOOL_FACEBOOK:{
    shareUrl:'https://www.facebook.com/share/1USvBxRNwD/?mibextid=wwXIfr',
    authority:'school',organization:'Assumption BVM School'
  },
  ABVM_HSA_FACEBOOK:{
    shareUrl:'https://www.facebook.com/share/1MwtxVZMSq/?mibextid=wwXIfr',
    authority:'hsa',organization:'Assumption BVM Home & School Association',pageId:'61552549763989'
  }
});
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const fail=message=>{throw new Error('Facebook feed: '+message);};
const requireThat=(condition,message)=>{if(!condition)fail(message);};
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(value)
  &&/(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const dateOnly=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value))return false;
  const date=new Date(value+'T12:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
};
const sha256=value=>createHash('sha256').update(value).digest('hex');
function facebookUrl(value){
  try{
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password||!['facebook.com','www.facebook.com','m.facebook.com'].includes(u.hostname))return null;
    return u;
  }catch{return null;}
}
function canonicalPostIsOwned(post,source){
  const url=facebookUrl(post.postUrl);
  if(!url)return false;
  const linkedId=url.searchParams.get('id');
  if(linkedId&&linkedId!==source.pageId)return false;
  const pageSlug=new URL(source.canonicalUrl).pathname.split('/').filter(Boolean).slice(-1)[0]||'';
  const path=decodeURIComponent(url.pathname).toLowerCase();
  return (linkedId===source.pageId)||path.includes(source.pageId)||
    (pageSlug.length>=8&&path.includes(pageSlug.toLowerCase()));
}
export function validateFacebookSources(config){
  requireThat(config?.schemaVersion===1,'sources schema must be 1');
  requireThat(config?.timeZone==='America/New_York','timezone must be America/New_York');
  requireThat(Array.isArray(config.sources)&&config.sources.length===2,'exactly two isolated sources required');
  const seen=new Set(),pageIds=new Set();
  for(const row of config.sources){
    const rule=known[row?.id];
    requireThat(!!rule&&!seen.has(row.id),'unknown or duplicated source ID');
    seen.add(row.id);
    requireThat(row.organization===rule.organization&&row.authority===rule.authority,'source organization/authority mismatch: '+row.id);
    requireThat(row.shareUrl===rule.shareUrl,'original share link mismatch: '+row.id);
    requireThat(row.retrieval?.method==='graph-api'&&typeof row.retrieval?.enabled==='boolean','unsupported retrieval settings: '+row.id);
    requireThat(['pending','verified'].includes(row.identity?.status),'identity status invalid: '+row.id);
    if(row.identity.status==='verified'){
      requireThat(/^\d{8,25}$/.test(String(row.pageId||'')),'verified source needs numeric Page ID: '+row.id);
      if(rule.pageId)requireThat(row.pageId===rule.pageId,'verified HSA Page ID cannot be reassigned');
      requireThat(!!facebookUrl(row.canonicalUrl)&&!!facebookUrl(row.identity.evidenceUrl),'verified source needs Facebook identity evidence: '+row.id);
      requireThat(dateOnly(row.identity.verifiedAt),'verified source needs verification date: '+row.id);
      requireThat(clean(row.identity.method).length>=8,'verified source method missing: '+row.id);
      requireThat(!pageIds.has(row.pageId),'Facebook Page ID must not be shared across sources');
      pageIds.add(row.pageId);
    }else{
      requireThat(row.retrieval.enabled===false,'pending source must never be enabled: '+row.id);
      requireThat(row.pageId===null&&row.canonicalUrl===null,'pending source cannot claim canonical Page identity: '+row.id);
    }
  }
  requireThat(seen.size===FACEBOOK_IDS.length,'both named sources required');
  return true;
}
export function normalizeReviewedFacebookPost(row,source,now=new Date(),old=null){
  requireThat(source?.identity?.status==='verified','post source is unverified');
  requireThat(row?.sourceId===source.id,'post sourceId mismatch');
  requireThat(typeof row.postId==='string'&&row.postId.startsWith(source.pageId+'_')
    &&/^[a-zA-Z0-9_]+$/.test(row.postId),'post ID must be issued by its claimed Page');
  requireThat(canonicalPostIsOwned(row,source),'post permalink does not bind to its Page');
  requireThat(iso(row.postedAt),'original post timestamp required');
  requireThat(row.editedAt===null||row.editedAt===undefined||iso(row.editedAt),'edited timestamp invalid');
  requireThat(/^[0-9a-f]{64}$/.test(String(row.sourceContentHash||'')),'original source evidence hash missing');
  requireThat(typeof row.summary==='string'&&clean(row.summary).length>=5&&clean(row.summary).length<=480,'reviewed summary must be 5–480 characters');
  requireThat(FACEBOOK_CATEGORIES.includes(row.category),'unsupported content category');
  requireThat(row.category!=='Academic','Facebook may not establish academic instructions');
  requireThat(['families','students','staff','volunteers','school-community','grade-2'].includes(row.audience),'approved audience is required');
  requireThat(['high','moderate'].includes(row.confidence),'reviewed confidence required');
  requireThat(['active','corrected','cancelled'].includes(row.noticeStatus),'reviewed notice status required');
  requireThat(Array.isArray(row.eventDates)&&row.eventDates.length<=10
    &&row.eventDates.every(dateOnly),'event dates must be manually reviewed YYYY-MM-DD');
  const eventDates=[...new Set(row.eventDates)].sort();
  requireThat(Array.isArray(row.deadlineDates)&&row.deadlineDates.length<=10
    &&row.deadlineDates.every(dateOnly),'deadline dates must be reviewed YYYY-MM-DD');
  const deadlineDates=[...new Set(row.deadlineDates)].sort();
  requireThat((eventDates.length===0&&deadlineDates.length===0)||(typeof row.eventKey==='string'&&/^[a-z0-9][a-z0-9-_]{4,100}$/.test(row.eventKey)),
    'dated events need a reviewed dedupe key');
  requireThat(!row.eventKey||eventDates.length>0||deadlineDates.length>0,'undated posts cannot automatically deduplicate as events');
  requireThat(row.review?.status==='approved'&&row.review?.piiReviewed===true,'post not privacy-reviewed and approved');
  requireThat(iso(row.review?.reviewedAt)&&clean(row.review?.reviewedBy).length>=3,'review timestamp and reviewer required');
  if(row.editedAt)requireThat(Date.parse(row.review.reviewedAt)>=Date.parse(row.editedAt),
    'edited posts require a new content review');
  const current={
    sourceId:source.id,organization:source.organization,authority:source.authority,
    postId:row.postId,postUrl:row.postUrl,postedAt:row.postedAt,
    editedAt:row.editedAt||null,sourceContentHash:row.sourceContentHash,
    summary:clean(row.summary),category:row.category,audience:row.audience,
    confidence:row.confidence,noticeStatus:row.noticeStatus,verificationStatus:'verified-and-reviewed',
    eventDates,deadlineDates,eventKey:row.eventKey||null,review:{
      status:'approved',piiReviewed:true,reviewedAt:row.review.reviewedAt,
      reviewedBy:row.review.reviewedBy,
      ...(row.review.teacherEvidenceUrl?{teacherEvidenceUrl:row.review.teacherEvidenceUrl}:{})
    }
  };
  const oldComparable=old&&{...old};
  if(oldComparable)delete oldComparable.collectedAt;
  return {...current,collectedAt:oldComparable&&JSON.stringify(oldComparable)===JSON.stringify(current)&&iso(old?.collectedAt)
    ?old.collectedAt:new Date(now).toISOString()};
}
function assembleDisplays(posts){
  const byEvent=new Map(),noEvent=[];
  for(const post of posts){
    if(!post.eventKey){noEvent.push([post]);continue;}
    if(!byEvent.has(post.eventKey))byEvent.set(post.eventKey,[]);
    byEvent.get(post.eventKey).push(post);
  }
  const display=[],conflicts=[];
  for(const [key,group] of byEvent){
    const signatures=[...new Set(group.map(p=>[p.eventDates.join('|'),p.deadlineDates.join('|'),p.noticeStatus,clean(p.summary).toLowerCase()].join('::')))];
    if(signatures.length>1){
      conflicts.push({eventKey:key,sourceIds:[...new Set(group.map(p=>p.sourceId))],
        postIds:group.map(p=>p.postId),eventDateVariants:group.map(p=>({sourceId:p.sourceId,dates:p.eventDates,deadlines:p.deadlineDates,status:p.noticeStatus}))});
      for(const post of group)noEvent.push([post]);
    }else noEvent.push(group);
  }
  for(const group of noEvent){
    const first=group[0],isConflict=conflicts.some(row=>row.eventKey===first.eventKey);
    display.push({
      id: first.eventKey&&!isConflict?'event:'+first.eventKey:'post:'+first.sourceId+':'+first.postId,
      summary:first.summary,category:first.category,audience:first.audience,
      confidence:first.confidence,noticeStatus:first.noticeStatus,
      verificationStatus:'verified-and-reviewed',eventDates:first.eventDates,deadlineDates:first.deadlineDates,
      postedAt:group.reduce((latest,p)=>p.postedAt>latest?p.postedAt:latest,first.postedAt),
      conflict:isConflict,sources:group.map(p=>({
        sourceId:p.sourceId,organization:p.organization,postId:p.postId,postUrl:p.postUrl
      }))
    });
  }
  display.sort((a,b)=>b.postedAt.localeCompare(a.postedAt)||a.id.localeCompare(b.id));
  return {display,conflicts};
}
export function buildFacebookFeed(config,reviewed,previous={},now=new Date()){
  validateFacebookSources(config);
  requireThat(reviewed?.schemaVersion===1&&Array.isArray(reviewed.posts),'reviewed posts schema invalid');
  const sources=new Map(config.sources.map(p=>[p.id,p]));
  const earlier=new Map((previous.posts||[]).map(row=>[row.sourceId+':'+row.postId,row]));
  const ids=new Set(),posts=[];
  for(const candidate of reviewed.posts){
    const source=sources.get(candidate?.sourceId);
    requireThat(!!source,'reviewed post points to unknown source');
    const key=candidate.sourceId+':'+candidate.postId;
    requireThat(!ids.has(key),'duplicate source-specific post ID: '+key);
    ids.add(key);
    posts.push(normalizeReviewedFacebookPost(candidate,source,now,earlier.get(key)));
  }
  posts.sort((a,b)=>a.sourceId.localeCompare(b.sourceId)||a.postId.localeCompare(b.postId));
  const {display,conflicts}=assembleDisplays(posts);
  const quarantines=previous.quarantines||[],audit=previous.audit||[];
  const content={posts,display,conflicts,quarantines,audit};
  const same=JSON.stringify(content)===JSON.stringify({
    posts:previous?.posts||[],display:previous?.display||[],conflicts:previous?.conflicts||[],
    quarantines:previous?.quarantines||[],audit:previous?.audit||[]
  });
  return {changed:!same,feed:{schemaVersion:1,generatedAt:same?(previous.generatedAt||null):new Date(now).toISOString(),...content}};
}
export function validatePublishedFacebookFeed(config,feed){
  requireThat(feed?.schemaVersion===1&&Array.isArray(feed.posts)
    &&Array.isArray(feed.display)&&Array.isArray(feed.conflicts),'published feed schema invalid');
  const quarantines=feed.quarantines||[],audit=feed.audit||[];
  requireThat(Array.isArray(quarantines)&&Array.isArray(audit)&&audit.length<=200,'quarantine/audit schema invalid');
  const sources=new Map(config.sources.map(source=>[source.id,source]));
  const seen=new Set();
  for(const item of quarantines){
    const source=sources.get(item.sourceId),key=item.sourceId+':'+item.postId;
    requireThat(source?.identity.status==='verified'&&item.postId?.startsWith(source.pageId+'_'),
      'quarantine is bound to an unknown Facebook Page');
    requireThat(!seen.has(key),'duplicate quarantine ID');
    seen.add(key);
    requireThat(iso(item.detectedAt)&&/^[0-9a-f]{64}$/.test(item.observedHash||'')&&
      /^[0-9a-f]{64}$/.test(item.rejectedHash||''),'invalid edit quarantine evidence');
    requireThat(!feed.posts.some(p=>p.sourceId===item.sourceId&&p.postId===item.postId),
      'quarantined Facebook post cannot be published');
  }
  for(const item of audit){
    requireThat(['quarantined','review-restored'].includes(item.kind)&&
      sources.has(item.sourceId)&&typeof item.postId==='string'&&iso(item.at)&&
      /^[0-9a-f]{64}$/.test(item.contentHash||''),'invalid audit entry');
  }
  if(feed.posts.length===0){
    requireThat(feed.generatedAt===null||iso(feed.generatedAt),'empty feed needs a valid publication/retraction timestamp');
  }else requireThat(iso(feed.generatedAt),'published feed generatedAt missing');
  const recomputed=buildFacebookFeed(config,{schemaVersion:1,posts:feed.posts},feed,
    feed.generatedAt?new Date(feed.generatedAt):new Date('2026-10-08T00:00:00.000Z')).feed;
  requireThat(JSON.stringify(recomputed.posts)===JSON.stringify(feed.posts),'published post provenance failed validation');
  requireThat(JSON.stringify(recomputed.display)===JSON.stringify(feed.display),'published display/source merge failed validation');
  requireThat(JSON.stringify(recomputed.conflicts)===JSON.stringify(feed.conflicts),'published conflicts failed validation');
  requireThat(JSON.stringify(recomputed.quarantines)===JSON.stringify(quarantines),'quarantine receipt failed validation');
  requireThat(JSON.stringify(recomputed.audit)===JSON.stringify(audit),'audit receipt failed validation');
  return true;
}
export function originalPostHash(rawMessage){return sha256(String(rawMessage??''));}
