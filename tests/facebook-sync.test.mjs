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
  category:'Fundraiser',eventDates:[],eventKey:null,
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
});
test('a Page retrieval failure does not relabel an HSA approval',async()=>{
  const reviewed={schemaVersion:1,posts:[post()]};
  const result=await syncFacebookFeeds({config:active,reviewed,previous:empty,token:'token',now:time,
    fetcher:async()=>{throw Error('API unavailable');}});
  assert.equal(result.reports[1].status,'source-unavailable');
  assert.equal(result.feed.posts[0].sourceId,hsa.id);
});
