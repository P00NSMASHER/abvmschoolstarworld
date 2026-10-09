import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateFacebookSources,buildFacebookFeed,validatePublishedFacebookFeed,
  normalizeReviewedFacebookPost,originalPostHash
} from '../scripts/facebook-feed-policy.mjs';

const config=JSON.parse(readFileSync(new URL('../pages/data/facebook-sources.json',import.meta.url),'utf8'));
const hsa=config.sources.find(x=>x.id==='ABVM_HSA_FACEBOOK');
const school=config.sources.find(x=>x.id==='ABVM_SCHOOL_FACEBOOK');
const verifiedConfig=config;
const pendingSchool={
  ...school,pageId:null,canonicalUrl:null,
  identity:{status:'pending',method:'fixture-unverified',verifiedAt:null,evidenceUrl:null},
  retrieval:{method:'graph-api',enabled:false}
};
const pendingConfig={...config,sources:[pendingSchool,hsa]};
const timestamp='2026-10-08T18:00:00.000Z';
function post(source,{id='101',summary='School community reminder for the fall event.',date='2026-10-12',key='fall-school-event',category}={}){
  return {
    sourceId:source.id,postId:source.pageId+'_'+id,
    postUrl:'https://www.facebook.com/permalink.php?story_fbid='+id+'&id='+source.pageId,
    postedAt:'2026-10-08T13:00:00.000Z',editedAt:null,
    sourceContentHash:originalPostHash('original message '+id),
    summary,category:category||(source.authority==='hsa'?'HSA event':'School event'),
    audience:'families',confidence:'high',noticeStatus:'active',
    eventDates:date?[date]:[],deadlineDates:[],eventKey:date?key:null,
    review:{status:'approved',piiReviewed:true,reviewedBy:'fixture-reviewer',reviewedAt:timestamp}
  };
}
test('exact school/HSA source identities and source-specific Page IDs are pinned',()=>{
  assert.equal(validateFacebookSources(config),true);
  assert.equal(school.pageId,'100057127132786');
  assert.equal(school.canonicalUrl,'https://www.facebook.com/ABVM11/');
  assert.equal(school.identity.status,'verified');
  assert.equal(school.retrieval.enabled,false,'browser identity proof is not API access');
  const switched=structuredClone(config);
  switched.sources[0].shareUrl=switched.sources[1].shareUrl;
  assert.throws(()=>validateFacebookSources(switched),/share link mismatch/);
  const different=structuredClone(config);different.sources[0].pageId=hsa.pageId;
  assert.throws(()=>validateFacebookSources(different),/cannot be reassigned/);
  const enabled=structuredClone(pendingConfig);enabled.sources[0].retrieval.enabled=true;
  assert.throws(()=>validateFacebookSources(enabled),/pending source/);
});
test('reviewed HSA announcements remain attributed to HSA and do not change the teacher pack',()=>{
  const teacherPack={subjects:[{subject:'Spelling',topics:['Test Oct 9']}],importantDates:[{source:'teacher-tests',label:'Grammar test'}]};
  const before=JSON.stringify(teacherPack);
  const {feed}=buildFacebookFeed(config,{schemaVersion:1,posts:[post(hsa)]},{},new Date(timestamp));
  assert.equal(feed.posts[0].sourceId,'ABVM_HSA_FACEBOOK');
  assert.equal(feed.posts[0].authority,'hsa');
  assert.equal(feed.posts[0].audience,'families');
  assert.equal(feed.posts[0].confidence,'high');
  assert.equal(feed.posts[0].verificationStatus,'verified-and-reviewed');
  assert.equal(feed.display[0].sources[0].sourceId,'ABVM_HSA_FACEBOOK');
  assert.equal(JSON.stringify(teacherPack),before);
  assert.equal(validatePublishedFacebookFeed(config,feed),true);
});
test('same approved event from two pages consolidates display only and retains both originals',()=>{
  const {feed}=buildFacebookFeed(verifiedConfig,{schemaVersion:1,posts:[post(school),post(hsa)]},{},new Date(timestamp));
  assert.equal(feed.posts.length,2);
  assert.equal(feed.display.length,1);
  assert.deepEqual(new Set(feed.display[0].sources.map(x=>x.sourceId)),new Set([school.id,hsa.id]));
  assert.equal(feed.display[0].category,'School event',
    'HSA categorization must not silently replace the official school classification');
  assert.equal(feed.display[0].sources[0].sourceId,school.id,
    'official school evidence must appear before HSA corroboration in a combined card');
  assert.equal(feed.display[0].sources.find(s=>s.sourceId===hsa.id).category,'HSA event',
    'the original HSA category must remain visible in provenance');
  assert.equal(feed.display[0].sources.find(s=>s.sourceId===school.id).category,'School event');
  assert.equal(feed.conflicts.length,0);
  assert.equal(validatePublishedFacebookFeed(verifiedConfig,feed),true);
});
test('conflicting event dates are explicitly flagged and never silently selected',()=>{
  const {feed}=buildFacebookFeed(verifiedConfig,{schemaVersion:1,posts:[
    post(school,{date:'2026-10-12'}),post(hsa,{date:'2026-10-13'})
  ]},{},new Date(timestamp));
  assert.equal(feed.conflicts.length,1);
  assert.equal(feed.display.length,2);
  assert.ok(feed.display.every(x=>x.conflict));
});
test('two notices with matching dates but materially different details cannot silently merge',()=>{
  const result=buildFacebookFeed(verifiedConfig,{schemaVersion:1,posts:[
    post(school,{summary:'School concert starts at 6 PM'}),
    post(hsa,{summary:'School concert starts at 7 PM'})
  ]},{},new Date(timestamp)).feed;
  assert.equal(result.display.length,2);
  assert.equal(result.conflicts.length,1);
  assert.ok(result.display.every(row=>row.conflict));
});
test('HSA cannot establish academic instructions without teacher corroboration',()=>{
  assert.throws(()=>normalizeReviewedFacebookPost(post(hsa,{category:'Academic'}),hsa),/academic instructions/);
  assert.throws(()=>normalizeReviewedFacebookPost(post(school,{category:'Academic'}),school),/academic instructions/);
});
test('a source without verified identity still cannot publish school posts',()=>{
  assert.throws(()=>buildFacebookFeed(pendingConfig,{schemaVersion:1,posts:[post(school)]}),/unverified/);
});
test('edited posts require a newer review and cannot update silently',()=>{
  const modified=post(hsa);modified.editedAt='2026-10-08T19:00:00.000Z';
  assert.throws(()=>normalizeReviewedFacebookPost(modified,hsa),/new content review/);
});
test('Graph ownership and external posts are rejected even if the source label looks right',()=>{
  const wrong=post(hsa);wrong.postUrl='https://www.facebook.com/permalink.php?story_fbid=101&id=123456789012345';
  assert.throws(()=>normalizeReviewedFacebookPost(wrong,hsa),/does not bind/);
  wrong.postUrl='https://fake-facebook.example/post/1';
  assert.throws(()=>normalizeReviewedFacebookPost(wrong,hsa),/does not bind/);
  wrong.postUrl='https://www.facebook.com/fake/'+hsa.pageId+'/something';
  assert.throws(()=>normalizeReviewedFacebookPost(wrong,hsa),/does not bind/);
  wrong.postUrl='https://www.facebook.com/permalink.php?story_fbid=999&id='+hsa.pageId;
  assert.throws(()=>normalizeReviewedFacebookPost(wrong,hsa),/does not bind/);
  wrong.postUrl='https://www.facebook.com/permalink.php?id='+hsa.pageId;
  assert.throws(()=>normalizeReviewedFacebookPost(wrong,hsa),/does not bind/);
});
test('repeated runs are idempotent and do not rewrite collection time',()=>{
  const reviewed={schemaVersion:1,posts:[post(hsa)]};
  const first=buildFacebookFeed(config,reviewed,{},new Date(timestamp));
  const second=buildFacebookFeed(config,reviewed,first.feed,new Date('2026-10-09T18:00:00.000Z'));
  assert.equal(second.changed,false);
  assert.deepEqual(second.feed,first.feed);
  assert.equal(first.feed.posts[0].postedAt,reviewed.posts[0].postedAt);
});
test('historical posts do not gain a new publication timestamp when discovered later',()=>{
  const older=post(hsa);older.postedAt='2026-09-20T18:00:00.000Z';
  const {feed}=buildFacebookFeed(config,{schemaVersion:1,posts:[older]},{},new Date('2026-10-08T18:00:00Z'));
  assert.equal(feed.posts[0].postedAt,older.postedAt);
  assert.equal(feed.posts[0].collectedAt,'2026-10-08T18:00:00.000Z');
});
test('misidentified another school or unchanged privacy review is rejected',()=>{
  const bad=post(hsa);bad.review.piiReviewed=false;
  assert.throws(()=>normalizeReviewedFacebookPost(bad,hsa),/privacy-reviewed/);
  const wrongOrg=structuredClone(config);wrongOrg.sources[1].organization='Assumption BVM West Grove';
  assert.throws(()=>validateFacebookSources(wrongOrg),/organization/);
  const swapped=structuredClone(config);swapped.sources[1].pageId='9999999999999';
  assert.throws(()=>validateFacebookSources(swapped),/cannot be reassigned/);
});
test('unreviewed and removed records never leak from source history',()=>{
  assert.throws(()=>buildFacebookFeed(config,{schemaVersion:1,posts:[{...post(hsa),review:{status:'pending'}}]}),/privacy-reviewed/);
  const first=buildFacebookFeed(config,{schemaVersion:1,posts:[post(hsa)]}).feed;
  const empty=buildFacebookFeed(config,{schemaVersion:1,posts:[]},first).feed;
  assert.deepEqual(empty.posts,[]);
});
