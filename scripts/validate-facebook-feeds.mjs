import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateFacebookSources,validatePublishedFacebookFeed,buildFacebookFeed} from './facebook-feed-policy.mjs';

const read=file=>JSON.parse(readFileSync(new URL('../pages/data/'+file,import.meta.url),'utf8'));
export function validateLocalFacebookFeeds(){
  const sources=read('facebook-sources.json');
  const reviewed=read('facebook-reviewed-posts.json');
  const published=read('facebook-updates.json');
  validateFacebookSources(sources);
  validatePublishedFacebookFeed(sources,published);
  buildFacebookFeed(sources,reviewed,published);
  return {sources:sources.sources.map(s=>({id:s.id,status:s.identity.status,enabled:s.retrieval.enabled})),
    reviewed:reviewed.posts.length,published:published.posts.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log('Facebook feed source-isolation validation passed',JSON.stringify(validateLocalFacebookFeeds()));
}
