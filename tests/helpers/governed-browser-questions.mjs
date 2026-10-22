/**
 * Resolve visible Study Games questions against every governed app pool.
 * The Study materials player can select verified historical archive questions;
 * the browser QA resolver must not label those formerly-current items unknown.
 * An unrecognized or conflicting answer must still fail closed.
 */
import {schoolDay} from '../../pages/study-model.mjs';

export function mergeGovernedQuestionPools({catalog,schoolwork,archive,star,observedAt}={}){
  const observedDay=schoolDay(observedAt??new Date());
  const approvedSources=archive?.sources||{};
  const validArchiveQuestion=q=>q&&typeof q.id==='string'&&q.id&&
    typeof q.prompt==='string'&&q.prompt&&typeof q.answer==='string'&&
    Array.isArray(q.choices)&&q.choices.length>1&&
    q.choices.every(choice=>typeof choice==='string')&&
    new Set(q.choices).size===q.choices.length&&q.choices.includes(q.answer)&&
    typeof q.firstSeenAt==='string'&&Number.isFinite(Date.parse(q.firstSeenAt))&&
    schoolDay(q.firstSeenAt)<=observedDay&&
    Array.isArray(q.provenance)&&q.provenance.some(p=>
      typeof p?.sourceRef==='string'&&p.sourceRef&&
      Object.hasOwn(approvedSources,p.sourceRef)&&
      typeof p.capturedAt==='string'&&Number.isFinite(Date.parse(p.capturedAt))&&
      schoolDay(p.capturedAt)<=observedDay);
  return [
    ...(Array.isArray(catalog?.questions)?catalog.questions:[]),
    ...(Array.isArray(schoolwork?.lessons)?schoolwork.lessons.flatMap(lesson=>Array.isArray(lesson?.questions)?lesson.questions:[]):[]),
    ...(Array.isArray(star)?star:[]),
    ...(Array.isArray(archive?.questions)?archive.questions.filter(validArchiveQuestion):[]),
  ];
}

export async function governedBrowserQuestions(page){
  const sources=await page.evaluate(async()=>{
    const [runtime,schoolwork,archive]=await Promise.all([
      fetch('./data/study-pack-runtime.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Runtime pack unavailable');return r.json()}),
      fetch('./data/schoolwork.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Reviewed schoolwork unavailable');return r.json()}),
      fetch('./data/study-archive.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Verified historical study archive unavailable');return r.json()}),
    ]);
    const engine=window.ABVMStudyGames;
    const {buildStarBank}=await import('./star-practice.mjs');
    const catalog=engine.buildCatalog(runtime.pack,{sourceKey:engine.sourceKeyFromEnvelope(runtime.pack,runtime)});
    return {catalog,schoolwork,archive,star:buildStarBank(),observedAt:new Date().toISOString()};
  });
  return mergeGovernedQuestionPools(sources);
}

export async function resolveGovernedBrowserQuestion(page){
  const prompt=(await page.locator('.game-question-card h2').innerText()).trim();
  const choices=(await page.locator('.game-question-card [data-game-answer] strong').allTextContents()).map(value=>value.trim());
  const pool=await governedBrowserQuestions(page);
  const matches=pool.filter(q=>q.prompt===prompt&&q.choices.length===choices.length&&
    q.choices.every(choice=>choices.includes(choice))&&choices.includes(q.answer));
  const answers=new Set(matches.map(q=>q.answer));
  if(answers.size!==1)throw new Error('Rendered question must match exactly one governed answer: '+prompt);
  const answer=[...answers][0];
  const row=matches[0];
  return {prompt,answer,choices,skill:row.skill,answerIndex:choices.indexOf(answer),
    correct:choices.indexOf(answer),wrong:choices.map((choice,index)=>choice===answer?-1:index).filter(index=>index>=0)};
}
