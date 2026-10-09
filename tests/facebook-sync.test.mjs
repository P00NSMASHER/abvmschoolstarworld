import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {syncFacebookFeeds,getAuthorizedFacebookPosts} from '../scripts/sync-facebook-feeds.mjs';
import {buildFacebookFeed,originalPostHash} from '../scripts/facebook-feed-policy.mjs';
const sourceData=JSON.parse(readFileSync(new URL('../pages/data/facebook-sources.json',import.meta.url),'utf8'));
const hsa=sourceData.sources.find(s=>s.authority==='hsa');
const active={...sourceData,sources:sourceData.sources.map(s=>s.authority==='hsa'?
  {...s,retrieval:{...s.retrieval,enabled:true}}:s)};
const time=new Date('2026-10-08T18:00:00Z');
const post=()=>({sourceId:hsa.id,postId:hsa.pageId+'_101',
  postUrl:'https://www.facebook.com/permalink.php?story_fbid=101&id='+hsa.pageId,
  postedAt:'2026-10-07T18:00:00Z',editedAt:null,
  sourceContentHash:originalPostHash('reviewed public message'),
  summary:'Approved parent fundraising announcement.',
  category:'Fundraiser',audience:'families',confidence:'high',noticeStatus:'active',
  eventDates:[],deadlineDates:[],eventKey:null,
  review:{status:'approved',piiReviewed:true,reviewedAt:'2026-10-08T18:00:00Z',reviewedBy:'fixture-reviewer'}});
const empty={schemaVersion:1,generatedAt:null,posts:[],display:[],conflicts:[]};
function graph(results,identity={id:hsa.pageId,name:hsa.organization}){
  let reads=0;
  const fetcher=async()=>({ok:true,json:async()=>++reads===1?identity:{data:results}});
  return fetcher;
}
test('one missing identity and one unavailable token stay source-isolated and do not publish guesses',async()=>{
  const result=await syncFacebookFeeds({config:active,reviewed:{schemaVersion:1,posts:[]},
    previous:empty,token:'',now:time,fetcher:()=>{throw Error('No calls expected');}});
  assert.deepEqual(result.reports.map(r=>r.status),['pending-identity','awaiting-authorized-api-token']);
  assert.deepEqual(result.feed.posts,[]);
});
test('authorized Graph API must return exact Page ID/name before reading any posts',async()=>{
  await assert.rejects(getAuthorizedFacebookPosts(active.sources[1],'token',graph([],{
    id:'999999999',name:'Another ABVM school'}),time),/identity\/name mismatch/);
});
test('Graph fetch uses independent owner IDs and a bounded review window',async()=>{
  const result=await getAuthorizedFacebookPosts(active.sources[1],'token',
    graph([{id:hsa.pageId+'_101',message:'reviewed public message'},
      {id:'999999999_1',message:'Different school post'}]),time);
  assert.equal(result.count,1);
  assert.equal(result.entries.get(hsa.pageId+'_101').hash,originalPostHash('reviewed public message'));
});
test('an edited message removes outdated review instead of silently overwriting it',async()=>{
  const reviewed={schemaVersion:1,posts:[post()]};
  const previous=buildFacebookFeed(sourceData,reviewed,{},time).feed;
  const result=await syncFacebookFeeds({config:active,reviewed,previous,token:'token',now:time,
    fetcher:graph([{id:hsa.pageId+'_101',message:'unapproved changed message'}])});
  assert.equal(result.quarantined,1);
  assert.equal(result.feed.posts.length,0);
  assert.equal(result.feed.quarantines.length,1);
  const second=await syncFacebookFeeds({config:active,reviewed,previous:result.feed,
    token:'token',now:new Date('2026-10-09T18:00:00Z'),fetcher:async()=>{throw Error('API temporarily unavailable');}});
  assert.equal(second.feed.posts.length,0,'a transient API failure must never republish previously quarantined content');
  assert.equal(second.feed.quarantines.length,1);
  const corrected=post();
  corrected.sourceContentHash=originalPostHash('unapproved changed message');
  corrected.review.reviewedAt='2026-10-10T18:00:00.000Z';
  const third=await syncFacebookFeeds({config:active,reviewed:{schemaVersion:1,posts:[corrected]},
    previous:second.feed,token:'token',now:new Date('2026-10-11T18:00:00Z'),
    fetcher:graph([{id:hsa.pageId+'_101',message:'unapproved changed message'}])});
  assert.equal(third.feed.posts.length,1);
  assert.equal(third.feed.quarantines.length,0);
  assert.deepEqual(third.feed.audit.map(a=>a.kind),['quarantined','review-restored']);
});
test('a newer Meta updated_time quarantines even when the text is unchanged',async()=>{
  const reviewed={schemaVersion:1,posts:[post()]};
  const previous=buildFacebookFeed(sourceData,reviewed,{},time).feed;
  const result=await syncFacebookFeeds({config:active,reviewed,previous,token:'token',now:time,
    fetcher:graph([{id:hsa.pageId+'_101',message:'reviewed public message',
      updated_time:'2026-10-08T19:00:00+0000'}])});
  assert.equal(result.feed.posts.length,0);
  assert.equal(result.quarantined,1);
  assert.equal(result.feed.quarantines[0].observedEditedAt,'2026-10-08T19:00:00.000Z');
});
test('a Page retrieval failure does not relabel an HSA approval',async()=>{
  const reviewed={schemaVersion:1,posts:[post()]};
  const result=await syncFacebookFeeds({config:active,reviewed,previous:empty,token:'token',now:time,
    fetcher:async()=>{throw Error('API unavailable');}});
  assert.equal(result.reports[1].status,'source-unavailable');
  assert.equal(result.feed.posts[0].sourceId,hsa.id);
});

test('page-specific credentials never authorize another Facebook source',async()=>{
  const originalSchool=sourceData.sources.find(s=>s.id==='ABVM_SCHOOL_FACEBOOK');
  const school={...originalSchool,pageId:'123456789012345',
    canonicalUrl:'https://www.facebook.com/p/Assumption-BVM-School-123456789012345/',
    identity:{status:'verified',method:'independent-public-page-verification',
      verifiedAt:'2026-10-08',evidenceUrl:originalSchool.shareUrl},
    retrieval:{method:'graph-api',enabled:true}};
  const config={...sourceData,sources:[school,active.sources[1]]};
  const seen=[];
  const respond=graph([]);
  const fetcher=async(url,params)=>{
    seen.push({url,auth:params.headers.authorization});
    assert.ok(url.includes('/'+hsa.pageId),
      'school API must never be called using the HSA token');
    assert.equal(params.headers.authorization,'Bearer hsa-page-only-token');
    return respond(url,params);
  };
  const result=await syncFacebookFeeds({config,reviewed:{schemaVersion:1,posts:[]},
    previous:empty,tokens:{ABVM_HSA_FACEBOOK:'hsa-page-only-token'},
    now:time,fetcher});
  assert.equal(result.reports[0].status,'awaiting-authorized-api-token');
  assert.equal(result.reports[1].status,'checked-authorized-api');
  assert.equal(seen.length,2);
  assert.deepEqual(result.feed.posts,[]);
});
