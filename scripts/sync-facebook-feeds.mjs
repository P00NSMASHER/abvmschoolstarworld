import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  validateFacebookSources,validatePublishedFacebookFeed,
  buildFacebookFeed,originalPostHash
} from './facebook-feed-policy.mjs';

const directory=new URL('../pages/data/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,directory),'utf8'));
const sameName=value=>String(value||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
const graphVersion=/^v\d+\.\d+$/.test(process.env.ABVM_FACEBOOK_GRAPH_VERSION||'')
  ?process.env.ABVM_FACEBOOK_GRAPH_VERSION:'v25.0';

async function graphJson(url,token,fetcher){
  const response=await fetcher(url,{headers:{accept:'application/json',authorization:'Bearer '+token},
    signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('Graph API request failed (HTTP '+response.status+').');
  const body=await response.json();
  if(body?.error)throw new Error('Graph API returned an access error.');
  return body;
}
export async function getAuthorizedFacebookPosts(source,token,fetcher=fetch,now=new Date()){
  if(source.identity?.status!=='verified'||source.retrieval?.enabled!==true)
    throw new Error('Retrieval disabled until independent Page identity approval.');
  if(!token)throw new Error('Authorized Facebook access token unavailable.');
  const base='https://graph.facebook.com/'+graphVersion+'/'+encodeURIComponent(source.pageId);
  const metadata=await graphJson(base+'?fields=id,name',token,fetcher);
  if(String(metadata.id)!==source.pageId||sameName(metadata.name)!==sameName(source.organization))
    throw new Error('Facebook Page identity/name mismatch; source quarantined.');
  const since=Math.floor((now.getTime()-14*86400000)/1000);
  const url=base+'/posts?fields=id,message,created_time,updated_time,permalink_url&since='+
    since+'&limit=100';
  const response=await graphJson(url,token,fetcher);
  if(!Array.isArray(response.data))throw new Error('Facebook posts response was not a list.');
  // Never persist unreviewed post messages, images, or student/family identifiers.
  const entries=new Map();
  for(const row of response.data){
    if(typeof row?.id!=='string'||!row.id.startsWith(source.pageId+'_'))continue;
    const updatedAt=Number.isFinite(Date.parse(row.updated_time||''))?
      new Date(row.updated_time).toISOString():null;
    entries.set(row.id,{hash:originalPostHash(row.message||''),updatedAt});
  }
  return {entries,count:entries.size,paged:!!response?.paging?.next};
}
export async function syncFacebookFeeds({
  config,reviewed,previous,token='',tokens={},fetcher=fetch,now=new Date()
}){
  validateFacebookSources(config);
  validatePublishedFacebookFeed(config,previous);
  if(reviewed?.schemaVersion!==1||!Array.isArray(reviewed.posts))
    throw new Error('Facebook reviewed-post manifest schema invalid.');
  const reports=[],sourceChecks=new Map();
  // Page-scoped tokens are preferred; the legacy token parameter is retained
  // for test callers, but production never supplies a shared credential.
  for(const source of config.sources){
    const pageToken=tokens[source.id]??token;
    if(source.identity.status!=='verified'){
      reports.push({id:source.id,status:'pending-identity',count:0});
      continue;
    }
    if(!source.retrieval.enabled){
      reports.push({id:source.id,status:'manual-review-only',count:0});
      continue;
    }
    if(!pageToken){
      reports.push({id:source.id,status:'awaiting-authorized-api-token',count:0});
      continue;
    }
    try{
      const result=await getAuthorizedFacebookPosts(source,pageToken,fetcher,now);
      sourceChecks.set(source.id,result.entries);
      reports.push({id:source.id,status:'checked-authorized-api',
        count:result.count,paginationLimited:result.paged});
    }catch(error){
      reports.push({id:source.id,status:'source-unavailable',
        reason:String(error.message||error).slice(0,160),count:0});
    }
  }
  // Persist a content-hash quarantine across API outages. Otherwise a rejected
  // edit would silently reappear as soon as Facebook becomes unavailable again.
  const pending=new Map((previous.quarantines||[]).map(q=>[q.sourceId+':'+q.postId,q]));
  const audit=[...(previous.audit||[])],safe=[];
  for(const row of reviewed.posts){
    const key=row.sourceId+':'+row.postId;
    const observed=sourceChecks.get(row.sourceId)?.get(row.postId);
    const old=pending.get(key);
    // Meta may revise a post without altering text (for example attached-media
    // changes); any update newer than approval requires another human review.
    const newerEdit=observed?.updatedAt&&
      Date.parse(observed.updatedAt)>Date.parse(row.review?.reviewedAt||'');
    if(observed&&(observed.hash!==row.sourceContentHash||newerEdit)){
      if(!old||old.observedHash!==observed.hash||old.observedEditedAt!==observed.updatedAt){
        const detectedAt=now.toISOString();
        pending.set(key,{sourceId:row.sourceId,postId:row.postId,
          rejectedHash:row.sourceContentHash,observedHash:observed.hash,
          observedEditedAt:observed.updatedAt,detectedAt});
        audit.push({kind:'quarantined',sourceId:row.sourceId,postId:row.postId,
          at:detectedAt,contentHash:observed.hash});
      }
      continue;
    }
    if(old){
      // A new verified original-source hash AND a newer human review
      // are both necessary. Failed checks never lift a previous quarantine.
      const cleared=observed&&observed.hash===old.observedHash&&
        row.sourceContentHash===observed.hash&&row.review?.status==='approved'&&
        Date.parse(row.review?.reviewedAt)>Date.parse(old.detectedAt)&&
        (!observed.updatedAt||Date.parse(row.review.reviewedAt)>=Date.parse(observed.updatedAt));
      if(!cleared)continue;
      pending.delete(key);
      audit.push({kind:'review-restored',sourceId:row.sourceId,postId:row.postId,
        at:now.toISOString(),contentHash:observed.hash});
    }
    safe.push(row);
  }
  const quarantined=reviewed.posts.length-safe.length;
  const state={...previous,quarantines:[...pending.values()].sort((a,b)=>
    (a.sourceId+':'+a.postId).localeCompare(b.sourceId+':'+b.postId)),audit:audit.slice(-200)};
  const result=buildFacebookFeed(config,{schemaVersion:1,posts:safe},state,now);
  const auditChanged=JSON.stringify(state.audit)!==JSON.stringify(previous.audit||[]);
  const quarantineChanged=JSON.stringify(state.quarantines)!==JSON.stringify(previous.quarantines||[]);
  const changed=result.changed||auditChanged||quarantineChanged;
  if(changed&&!result.changed)result.feed.generatedAt=now.toISOString();
  validatePublishedFacebookFeed(config,result.feed);
  return {...result,changed,reports,quarantined,reviewedCount:reviewed.posts.length};
}
async function main(){
  const config=read('facebook-sources.json');
  const reviewed=read('facebook-reviewed-posts.json');
  const previous=read('facebook-updates.json');
  const result=await syncFacebookFeeds({config,reviewed,previous,
    tokens:{
      ABVM_SCHOOL_FACEBOOK:process.env.ABVM_SCHOOL_FB_ACCESS_TOKEN||'',
      ABVM_HSA_FACEBOOK:process.env.ABVM_HSA_FB_ACCESS_TOKEN||''
    },now:new Date()});
  // Source-specific status only. Never log raw posts or bearer credentials.
  for(const report of result.reports)console.log('Facebook source',JSON.stringify(report));
  console.log('Facebook reviewed summary',JSON.stringify({
    reviewed:result.reviewedCount,published:result.feed.posts.length,
    quarantinedEdits:result.quarantined,conflicts:result.feed.conflicts.length,changed:result.changed
  }));
  if(!result.changed)return;
  if(!process.argv.includes('--write')){
    console.log('Dry run only: reviewed feed not written. Pass --write after QA.');
    return;
  }
  writeFileSync(new URL('facebook-updates.json',directory),JSON.stringify(result.feed,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error('Facebook feed sync failed safely:',error.message);process.exitCode=1;});
