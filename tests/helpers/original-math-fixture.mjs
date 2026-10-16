import {correctOriginalQuestion} from '../../scripts/question-corrections.mjs';
import {readFileSync} from 'node:fs';
// Interaction tests require a stable checked bank, not a permanent assumption
// that the live teacher still assigns Math. Only isolated Playwright responses
// use this historical original-practice snapshot. Never write it into pages/.
const snapshot=JSON.parse(readFileSync(new URL('../fixtures/math-original-practice.json',import.meta.url),'utf8'));
export function withOriginalMathFixture(envelope){
  const fixture=structuredClone(envelope),pack=fixture.pack;
  pack.sourceHash=String(pack.sourceHash)+'-qa-original-math';
  fixture.qaFixture='historical-original-math-interactions';
  pack.subjects=[...(pack.subjects||[]).filter(row=>row.subject!=='Math'),structuredClone(snapshot.subject)];
  const pipeline=pack.contentPipeline;
  pipeline.skills=[...pipeline.skills.filter(row=>row.subject!=='Math'),...structuredClone(snapshot.skills)];
  pipeline.questions=[...pipeline.questions.filter(row=>row.subject!=='Math'),...structuredClone(snapshot.questions).map(correctOriginalQuestion)];
  pipeline.qa={...pipeline.qa,skillCount:pipeline.skills.length,questionCount:pipeline.questions.length,subjectCoverage:[...new Set(pipeline.questions.map(q=>q.subject))]};
  return fixture;
}
export async function installOriginalMathFixture(page){
  const fixture=withOriginalMathFixture(await page.request.get('/data/study-pack.json').then(response=>response.json()));
  await page.route('**/data/study-pack*.json*',route=>route.fulfill({json:fixture}));
  return fixture;
}
