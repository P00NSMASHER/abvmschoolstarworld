/**
 * Resolve visible Study Games questions against every governed app pool.
 * Test helpers must follow the real merged schoolwork bank, rather than
 * treating the teacher pack as the only available source of questions.
 */
export async function governedBrowserQuestions(page){
  return page.evaluate(async()=>{
    const [runtime,schoolwork]=await Promise.all([
      fetch('./data/study-pack-runtime.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Runtime pack unavailable');return r.json()}),
      fetch('./data/schoolwork.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Reviewed schoolwork unavailable');return r.json()})
    ]);
    const engine=window.ABVMStudyGames;
    const {buildStarBank}=await import('./star-practice.mjs');
    const catalog=engine.buildCatalog(runtime.pack,{sourceKey:engine.sourceKeyFromEnvelope(runtime.pack,runtime)});
    return [...catalog.questions,...schoolwork.lessons.flatMap(lesson=>lesson.questions),...buildStarBank()];
  });
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
