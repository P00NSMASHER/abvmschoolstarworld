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
    entries.set(row.id,{hash:originalPostHash(row.message||''),updatedAt:row.updated_time||null});
  }
  return {entries,count:entries.size,paged:!!response?.paging?.next};
}
export async function syncFacebookFeeds({
  config,reviewed,previous,token='',fetcher=fetch,now=new Date()
}){
  validateFacebookSources(config);
  validatePublishedFacebookFeed(config,previous);
  if(reviewed?.schemaVersion!==1||!Array.isArray(reviewed.posts))
    throw new Error('Facebook reviewed-post manifest schema invalid.');
  const reports=[],sourceChecks=new Map();
  for(const source of config.sources){
    if(source.identity.status!=='verified'){
      reports.push({id:source.id,status:'pending-identity',count:0});
      continue;
    }
    if(!source.retrieval.enabled){
      reports.push({id:source.id,status:'manual-review-only',count:0});
      continue;
    }
    if(!token){
      reports.push({id:source.id,status:'awaiting-authorized-api-token',count:0});
      continue;
    }
    try{
      const result=await getAuthorizedFacebookPosts(source,token,fetcher,now);
      sourceChecks.set(source.id,result.entries);
      reports.push({id:source.id,status:'checked-authorized-api',
        count:result.count,paginationLimited:result.paged});
    }catch(error){
      reports.push({id:source.id,status:'source-unavailable',
        reason:String(error.message||error).slice(0,160),count:0});
    }
  }
  const safe=reviewed.posts.filter(row=>{
    const entries=sourceChecks.get(row.sourceId);
    if(!entries||!entries.has(row.postId))return true;
    // A changed Facebook message is never replaced by old approved wording:
    // discard the now-stale approval until a human approves the new revision.
    return entries.get(row.postId).hash===row.sourceContentHash;
  });
  const quarantined=reviewed.posts.length-safe.length;
  const result=buildFacebookFeed(config,{schemaVersion:1,posts:safe},previous,now);
  validatePublishedFacebookFeed(config,result.feed);
  return {...result,reports,quarantined,reviewedCount:reviewed.posts.length};
}
async function main(){
  const config=read('facebook-sources.json');
  const reviewed=read('facebook-reviewed-posts.json');
  const previous=read('facebook-updates.json');
  const result=await syncFacebookFeeds({config,reviewed,previous,
    token:process.env.ABVM_FACEBOOK_ACCESS_TOKEN||'',now:new Date()});
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
