/** Verify publisher review availability without executing or retaining question content. */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const file = fileURLToPath(new URL('../pages/data/religion-sources.json', import.meta.url));
const origin = 'https://isr.christourlife.com';
export function inspectReview(page, data, chapter) {
  const identity = new RegExp(`/\\*\\s*col_g2_s${chapter}\\.js\\s*\\*/`).test(data);
  const count = Number(data.match(/\bvar\s+questionCount\s*=\s*(\d+)/)?.[1]);
  const texts = [...data.matchAll(/qstn\[(\d+)\]\.text\s*=/g)].map(m => Number(m[1]));
  const answers = [...data.matchAll(/qstn\[(\d+)\]\.answer\s*=/g)].map(m => Number(m[1]));
  const schemaPresent = identity && Number.isInteger(count) && count > 0 && count <= 100 && new Set(texts).size === count && Array.from({length: count}, (_, i) => i).every(i => texts.includes(i) && answers.includes(i));
  const pagePresent = /\/scripts\/colisr2\.js/.test(page) && /\/scripts\/init_isr_opmz\.js/.test(page);
  return { chapterMatched: identity, schemaPresent, pagePresent, questionCount: schemaPresent ? count : null };
}
async function fetchText(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(20000), redirect:'error'});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return {status: response.status, text: await response.text()};
}
export async function refreshSources(document, fetcher = fetchText, now = new Date().toISOString()) {
  for (const item of document.chapters) {
    // A new chapter requires an explicitly supplied matching publisher URL.
    if (!Number.isInteger(item.chapter) || item.chapter < 1 || item.chapter > 99 || item.url !== `${origin}/col_g2_s${item.chapter}`) {item.status='unverified'; item.available=false; continue;}
    const pageUrl = `${origin}/col_g2_s${item.chapter}`;
    const dataUrl = `${origin}/scripts/data/col_g2_s${item.chapter}.js`;
    item.checkedAt=now;
    try {
      const [page,data] = await Promise.all([fetcher(pageUrl),fetcher(dataUrl)]);
      const proof=inspectReview(page.text,data.text,item.chapter);
      Object.assign(item,proof,{url:pageUrl,httpStatus:page.status,dataHttpStatus:data.status});
      item.available=proof.chapterMatched && proof.schemaPresent && proof.pagePresent;
      item.status=item.available?'verified':'unverified';
      item.stale=false;
      if(item.available) item.lastVerifiedAt=now;
      delete item.error;
    } catch(error) {
      item.status='stale'; item.stale=true;
      item.error=String(error.message).slice(0,160);
      // Keep last verified availability, but explicitly mark it stale.
      item.available=Boolean(item.available && item.lastVerifiedAt);
    }
  }
  document.checkedAt=now;
  return document;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const document=JSON.parse(await fs.readFile(file,'utf8'));
  await refreshSources(document);
  await fs.writeFile(file,JSON.stringify(document,null,2)+'\n');
  console.log(document.chapters.map(c=>`Chapter ${c.chapter}: ${c.status}, ${c.questionCount??'unknown'} questions`).join('\n'));
  if(document.chapters.some(c=>c.status!=='verified')) process.exitCode=1;
}
