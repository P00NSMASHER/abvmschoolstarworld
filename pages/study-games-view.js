(()=>{"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
function recordAttempt(state,q,{counted=true,kind="primary",correct=false,resolved=false,index=0,hintUsed=false,attempt=1}={}){
  if(!state||!q)return null;
  if(!Array.isArray(state.results))state.results=[];
  const key=String(kind)+"|"+String(index)+"|"+String(q.id||q.prompt||"item");
  let row=state.results.find(item=>item.key===key);
  if(!row){row={key,questionId:String(q.id||""),subject:String(q.subject||"Practice"),sourceKey:String(state.sourceKey||""),mode:String(state.mode||""),counted:counted===true,kind:String(kind),firstCorrect:null,resolvedCorrect:null,hintUsed:false,attempts:0,correctedOnRetry:false};state.results.push(row)}
  if(row.firstCorrect===null)row.firstCorrect=!!correct;
  row.hintUsed=row.hintUsed||!!hintUsed;
  row.attempts=Math.max(Number(row.attempts)||0,Number(attempt)||0);
  if(resolved){row.resolvedCorrect=!!correct;row.correctedOnRetry=!!correct&&row.firstCorrect===false}
  return row;
}
function scoreSummary(state){
  const answered=(Array.isArray(state?.results)?state.results:[]).filter(row=>row?.counted===true&&typeof row.firstCorrect==="boolean");
  const correct=answered.filter(row=>row.firstCorrect===true).length,incorrect=answered.length-correct;
  const corrected=answered.filter(row=>row.firstCorrect===false&&row.resolvedCorrect===true).length,hinted=answered.filter(row=>row.hintUsed===true).length;
  return {answered:answered.length,correct,incorrect,corrected,hinted,percent:answered.length?Math.round((correct/answered.length)*100):null};
}
function sectionScores(state){
  const rows=(Array.isArray(state?.results)?state.results:[]).filter(row=>row?.counted===true&&typeof row.firstCorrect==="boolean"),map=new Map();
  for(const row of rows){const subject=String(row.subject||"Practice"),item=map.get(subject)||{subject,answered:0,correct:0};item.answered++;if(row.firstCorrect===true)item.correct++;map.set(subject,item)}
  return [...map.values()].map(item=>({...item,percent:item.answered?Math.round((item.correct/item.answered)*100):null})).sort((a,b)=>a.subject.localeCompare(b.subject));
}
function icon(modeId){
  const icons={
    quick:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icon-fill" d="m24 6 5.3 10.8 11.9 1.7-8.6 8.4 2 11.8L24 33.1l-10.6 5.6 2-11.8-8.6-8.4 11.9-1.7L24 6Z"/><path class="icon-spark" d="M37.5 7.5v6M34.5 10.5h6"/></svg>',
    math:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="icon-outline" x="9" y="6.5" width="30" height="35" rx="6"/><rect class="icon-screen" x="14" y="11" width="20" height="7" rx="2.5"/><path class="icon-stroke" d="M16 26h7M19.5 22.5v7M28 26h6M16 34h7M28 34h6"/></svg>',
    words:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="icon-book" d="M7.5 11.5c5.5-1.4 10.5-.6 16.5 3.1v24c-5.7-3.5-11-4.3-16.5-2.7V11.5Z"/><path class="icon-book" d="M40.5 11.5c-5.5-1.4-10.5-.6-16.5 3.1v24c5.7-3.5 11-4.3 16.5-2.7V11.5Z"/><text class="icon-letter" x="13" y="27">A</text><text class="icon-letter small" x="29" y="29">a</text></svg>',
    faith:'<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="icon-halo" cx="24" cy="24" r="18"/><path class="icon-cross" d="M24 12v24M17 20h14"/><path class="icon-ray" d="M10 12l3 3M38 12l-3 3M9 31l4-2M39 31l-4-2"/></svg>'
  };
  return '<span class="study-game-icon game-icon-'+esc(modeId)+'" aria-hidden="true">'+(icons[modeId]||icons.quick)+'</span>';
}
function richVisual(raw){
  if(!raw||typeof raw!=="object")return "";
  const kind=String(raw.kind||""),label=String(raw.label||"").trim();
  if(!label)return "";
  if(kind==="number-line"){
    const min=Number(raw.min),max=Number(raw.max),start=Number(raw.start),steps=Number(raw.steps);
    if(![min,max,start,steps].every(Number.isInteger)||min<0||max<=min||max-min>20||start<min||start>max||steps<1||steps>20)return "";
    const ticks=[];for(let n=min;n<=max;n++)ticks.push('<span class="'+(n===start?'start':'')+'"><i></i><b>'+n+'</b></span>');
    return '<figure class="game-rich-content rich-number-line" role="img" aria-label="'+esc(label)+'"><div>'+ticks.join("")+'</div><figcaption>'+esc("Start at "+start+" · move back "+steps+" spaces")+'</figcaption></figure>';
  }
  if(kind==="clock"){
    const hour=Number(raw.hour),minute=Number(raw.minute);
    if(!Number.isInteger(hour)||hour<1||hour>12||!Number.isInteger(minute)||minute<0||minute>59)return "";
    const minuteDeg=minute*6,hourDeg=((hour%12)+(minute/60))*30,time=hour+":"+String(minute).padStart(2,"0");
    return '<figure class="game-rich-content rich-clock-wrap" role="img" aria-label="'+esc(label)+'"><div class="rich-clock"><span class="clock-hand hour" style="transform:rotate('+hourDeg+'deg)"></span><span class="clock-hand minute" style="transform:rotate('+minuteDeg+'deg)"></span><i></i></div><figcaption>'+esc("Start time "+time)+'</figcaption></figure>';
  }
  if(kind==="place-value"){
    const number=Number(raw.number);if(!Number.isInteger(number)||number<0||number>999)return "";
    return '<figure class="game-rich-content rich-place-value" role="img" aria-label="'+esc(label)+'"><div><span><small>Hundreds</small><b aria-hidden="true">?</b></span><span><small>Tens</small><b aria-hidden="true">?</b></span><span><small>Ones</small><b aria-hidden="true">?</b></span></div><figcaption>'+esc("Use the number in the question to fill the chart")+'</figcaption></figure>';
  }
  if(kind==="bar-chart"){
    const entries=Array.isArray(raw.entries)?raw.entries:[],clean=entries.map(row=>({label:String(row?.label||"").trim(),value:Number(row?.value)}));
    if(clean.length<2||clean.length>5||clean.some(row=>!row.label||!Number.isInteger(row.value)||row.value<0||row.value>99))return "";
    const max=Math.max(1,...clean.map(row=>row.value));
    return '<figure class="game-rich-content rich-bar-chart" role="img" aria-label="'+esc(label)+'"><div>'+clean.map(row=>'<span><small>'+esc(row.label)+'</small><i style="width:'+Math.round((row.value/max)*100)+'%"></i><b>'+row.value+'</b></span>').join("")+'</div><figcaption>'+esc("Use the chart to compare the values")+'</figcaption></figure>';
  }
  return "";
}

function play({g,mode,q,teach,retryInstruction,labels,canRead=false}){
  if(!q)return '<section class="game-empty"><h2>No questions are ready for this game yet.</h2><button type="button" data-game-home>Back to games</button></section>';
  const support=g.supportMode,comeback=g.comebackMode,review=support||comeback,progress=g.index+1,total=g.questions.length,pct=Math.round((progress/Math.max(1,total))*100),chosen=g.selectedIndex,visual=richVisual(q.richContent),wrong=new Set(g.wrong||[]),score=scoreSummary(g);
  const answers=q.choices.map((choice,index)=>{
    let klass="";
    if(g.answered){if(choice===q.answer)klass=" correct";else if(index===chosen||wrong.has(index))klass=" wrong"}
    else if(wrong.has(index))klass=" wrong";
    return '<button type="button" class="game-answer'+klass+'" data-game-answer="'+index+'" '+(g.answered||wrong.has(index)?'disabled aria-disabled="true"':'')+'><span>'+String.fromCharCode(65+index)+'</span><strong>'+esc(choice)+'</strong></button>';
  }).join("");
  const selected=chosen===null?null:q.choices[chosen],correct=selected===q.answer,targeted=!correct&&selected?q.choiceDiagnostics?.[selected]?.feedback:null;
  const adaptive=!g.strict&&!support&&!comeback&&!correct&&(g.learningRow?.ConsecutiveWrong||0)>=2?'<small class="adaptive-note">A smaller same-skill support step is next. It does not count toward your score.</small>':'';
  const scoreText=score.answered?score.correct+' / '+score.answered+' correct on first try':'No answers yet';
  const retryClue=!review&&!g.answered&&g.retry?'<section class="game-feedback incorrect retry" aria-live="polite" aria-atomic="true"><span aria-hidden="true">✕</span><div><strong>Incorrect. Try again.</strong><p>'+esc(q.hint||retryInstruction||"Try a different answer.")+'</p></div></section>':'';
  let feedback="";
  if(g.answered){
    const title=correct?(review?"Correct":g.misses?"Correct on retry":"Correct"):'Incorrect. The correct answer is '+q.answer+'.';
    const note=review?'Review question · not part of the section score.':correct&&g.misses?'First-try score did not increase.':correct&&g.hints?'Hint used · first-response correct, but not independent.':!correct?'First-try score did not increase.':'';
    feedback='<section class="game-feedback '+(correct?'correct':'incorrect retry')+'" aria-live="polite" aria-atomic="true"><span aria-hidden="true">'+(correct?'✓':'✕')+'</span><div><strong>'+esc(title)+'</strong><p>'+esc(correct?q.explanation:(targeted||q.explanation))+'</p>'+(note?'<small class="adaptive-note">'+esc(note)+'</small>':'')+adaptive+'</div></section><button type="button" class="game-next" data-game-next>'+(review?'Continue':progress===total?'See my score':'Next question')+' <span>›</span></button>';
  }
  return '<div class="game-topbar"><button type="button" data-game-home aria-label="Back to study games">‹</button><div><span>'+esc(comeback?"Comeback":support?"Support step":mode.title)+'</span><strong>'+(comeback?'Remember this skill later':support?'Same skill · smaller step':progress+' of '+total)+'</strong><small class="game-live-score" aria-label="Current first-try score">'+esc(scoreText)+'</small></div></div>'+
    '<div class="game-progress" role="progressbar" aria-label="Game progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><span style="width:'+pct+'%"></span></div>'+
    '<section class="game-question-card"><div class="game-question-meta"><span>'+esc(q.subject)+'</span><b>'+esc(comeback?"Comeback":support?"Support":q.tier==="recent-review"?"Recent review":q.tier==="star-fallback"?"STAR-style practice":labels[q.questionType]||"Practice")+'</b></div>'+(teach?'<div class="game-hint-wrap teach-card"><small class="adaptive-note">Quick lesson · not scored</small><p class="game-hint">'+esc(teach.instruction)+(teach.example?' '+esc(teach.example):'')+'</p></div>':'')+'<h2>'+esc(q.prompt)+'</h2>'+visual+(canRead?'<button type="button" class="game-read-button" data-game-read>Read to me</button>':'')+'<div class="game-answer-list">'+answers+'</div>'+(g.answered?feedback:retryClue+'<div class="game-hint-wrap">'+(review?'<small class="adaptive-note">Review question · not part of the section score</small>':'')+'<button type="button" class="game-hint-button" data-game-hint>'+(g.hintOpen?'Hide hint':'Need a hint?')+'</button>'+(g.hintOpen?'<p class="game-hint">'+esc(q.hint)+'</p>':'')+'</div>')+'</section>'+
    '<p class="round-persistence-note">Leaving ends this round.</p>';
}
function goal({state}){
  const g=state?.goal||{},selected=!!state?.selected,unlocked=!!state?.unlocked,pct=Math.max(0,Math.min(100,Number(state?.percent)||0)),target=Math.max(1,Math.floor(Number(state?.target)||1)),balance=Math.max(0,Math.floor(Number(state?.balance)||0)),rawProgress=Number(state?.progress),progress=Math.min(target,Math.max(0,Math.floor(Number.isFinite(rawProgress)?rawProgress:balance)));
  if(!g.id)return "";
  return '<section class="game-question-card study-star-goal" aria-label="Dream Goal"><div class="game-question-meta"><span>DREAM GOAL</span><b>'+progress+' / '+target+' Stars</b></div><h2>★ '+esc(g.title)+'</h2><div class="game-progress" role="progressbar" aria-label="Dream Goal progress" aria-valuemin="0" aria-valuemax="'+target+'" aria-valuenow="'+progress+'"><span style="width:'+pct+'%"></span></div><p class="game-hint">'+esc(unlocked?"Goal reached! Your badge is ready.":g.copy||"Keep practicing to fill the bar.")+'</p>'+(selected?'<small class="adaptive-note">'+(unlocked?'Unlocked':'Goal selected')+'</small>':'<button type="button" class="game-hint-button" data-study-star-goal="'+esc(g.id)+'">Choose this goal</button>')+'</section>';
}

function rewardReveal({amount=0}={}){
  const raw=Number(amount),stars=Number.isFinite(raw)&&raw>0?Math.floor(raw):0;
  if(!stars)return "";
  return '<div class="study-star-reveal" data-reward-reveal data-duration-ms="1200" role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true">★</span><strong>+'+stars+' Study Stars</strong><small>Practice reward</small></div>';
}

function finish({mode,state,record,summary={},reward={}}){
  const accuracy=scoreSummary(state),sections=sectionScores(state),pct=accuracy.percent??0,stars=accuracy.answered?(pct>=90?3:pct>=70?2:pct>=40?1:0):0,strong=Math.max(0,Number(summary.strong)||0),remembered=Math.max(0,Number(summary.remembered)||0),practice=Math.max(0,Number(summary.practice)||0);
  const rewardHtml=reward.status==="pending"?'<div class="study-star-earned secondary" aria-label="Study Stars reward"><span>Study Stars</span><strong>Saving on this device…</strong></div>':reward.status==="done"?'<div class="study-star-earned secondary" aria-label="Study Stars reward"><span>Study Stars</span><strong>'+(Number(reward.awardedAmount)>0?'+'+Math.max(0,Number(reward.awardedAmount)||0)+' Study Stars':'Already saved for this round')+'</strong><small>Balance '+Math.max(0,Number(reward.balance)||0)+'</small></div>':reward.status==="error"?'<div class="study-star-earned secondary" role="status" aria-label="Study Stars reward"><strong>Study Stars could not be confirmed.</strong><small>You can keep practicing.</small></div>':"";
  const scoreText=accuracy.answered?accuracy.correct+' / '+accuracy.answered+' correct on the first try · '+pct+'%':'Not attempted';
  const scoreDetails=accuracy.answered?'First-try correct: '+accuracy.correct+' · First-try misses: '+accuracy.incorrect+' · Corrected on retry: '+accuracy.corrected+' · Hints used: '+accuracy.hinted:'No scored answers were submitted.';
  const sectionsHtml='<div class="game-section-scores" aria-label="Section scores"><h3>Section scores</h3>'+(sections.length?sections.map(row=>'<div><span>'+esc(row.subject)+'</span><strong>'+row.correct+' / '+row.answered+' · '+row.percent+'%</strong></div>').join(""):'<p>Not attempted</p>')+'</div>';
  const legacy=record?.plays?'<small class="legacy-record">Best solved '+Math.max(0,Number(record.best)||0)+' of '+state.questions.length+' · legacy solved-after-retries record</small>':'';
  const starsHtml='<div class="game-finish-stars" aria-label="'+stars+' practice stars">'+[0,1,2].map(i=>'<span class="'+(i<stars?'earned':'')+'">★</span>').join("")+'</div>';
  return '<section class="game-finish learning-first"><p>'+esc(mode.title.toUpperCase())+'</p><h2>Your score</h2><div class="game-score-summary" aria-label="First-try accuracy"><strong>'+esc(scoreText)+'</strong><span>'+esc(scoreDetails)+'</span></div>'+sectionsHtml+'<h3 class="learning-heading">What you learned</h3><div class="learning-summary" aria-label="Round learning summary"><div><strong>'+strong+'</strong><span>Skills answered independently</span></div><div><strong>'+remembered+'</strong><span>Skills recalled later</span></div><div><strong>'+practice+'</strong><span>Skills to revisit</span></div></div><p class="learning-summary-note">These learning counts are skills, not questions. One round does not prove mastery or predict a STAR score.</p>'+legacy+starsHtml+rewardHtml+'<div class="game-finish-actions"><button type="button" class="primary" data-game-start="'+esc(mode.id)+'">Play again</button><button type="button" data-game-home>All study games</button></div></section>';
}
window.ABVMStudyGameView=Object.freeze({icon,play,goal,rewardReveal,finish,recordAttempt,scoreSummary,sectionScores});
})();
