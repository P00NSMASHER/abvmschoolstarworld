(()=>{"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
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
    const h=Math.floor(number/100),t=Math.floor(number/10)%10,o=number%10;
    return '<figure class="game-rich-content rich-place-value" role="img" aria-label="'+esc(label)+'"><div><span><small>Hundreds</small><b>'+h+'</b></span><span><small>Tens</small><b>'+t+'</b></span><span><small>Ones</small><b>'+o+'</b></span></div><figcaption>'+esc("Build "+number+" by place")+'</figcaption></figure>';
  }
  if(kind==="bar-chart"){
    const entries=Array.isArray(raw.entries)?raw.entries:[],clean=entries.map(row=>({label:String(row?.label||"").trim(),value:Number(row?.value)}));
    if(clean.length<2||clean.length>5||clean.some(row=>!row.label||!Number.isInteger(row.value)||row.value<0||row.value>99))return "";
    const max=Math.max(1,...clean.map(row=>row.value));
    return '<figure class="game-rich-content rich-bar-chart" role="img" aria-label="'+esc(label)+'"><div>'+clean.map(row=>'<span><small>'+esc(row.label)+'</small><i style="width:'+Math.round((row.value/max)*100)+'%"></i><b>'+row.value+'</b></span>').join("")+'</div><figcaption>'+esc("Use the chart to compare the values")+'</figcaption></figure>';
  }
  return "";
}

function play({g,mode,q,teach,retryInstruction,labels}){
  if(!q)return '<section class="game-empty"><h2>No questions are ready for this game yet.</h2><button type="button" data-game-home>Back to games</button></section>';
  const support=g.supportMode,comeback=g.comebackMode,progress=g.index+1,total=g.questions.length,pct=Math.round((progress/Math.max(1,total))*100),chosen=g.selectedIndex,visual=richVisual(q.richContent);
  const answers=q.choices.map((choice,index)=>{
    let klass="";
    if(g.answered){
      if(choice===q.answer)klass=" correct";
      else if(index===chosen||index===g.lastWrong)klass=" wrong";
    }else if(g.retry&&index===g.lastWrong)klass=" wrong";
    return '<button type="button" class="game-answer'+klass+'" data-game-answer="'+index+'" '+(g.answered?'disabled':'')+'><span>'+String.fromCharCode(65+index)+'</span><strong>'+esc(choice)+'</strong></button>';
  }).join("");
  const selected=chosen===null?null:q.choices[chosen],correct=selected===q.answer,targeted=!correct&&selected?q.choiceDiagnostics?.[selected]?.feedback:null;
  const adaptive=!support&&!comeback&&!correct&&(g.learningRow?.ConsecutiveWrong||0)>=2?'<small class="adaptive-note">A smaller same-skill support step is next. It does not count toward your score.</small>':'';
  const retryClue=!support&&!comeback&&!g.answered&&g.retry?'<section class="game-feedback retry" aria-live="polite"><span>↻</span><div><strong>'+(g.retry===1?'Not yet — use this clue.':'Try once more with a stronger clue.')+'</strong><p>'+esc(g.retry===1?q.hint:(retryInstruction||targeted||q.hint))+'</p></div></section>':'';
  const feedback=g.answered?'<section class="game-feedback '+(correct?'correct':'retry')+'" aria-live="polite"><span>'+(correct?'✓':'↻')+'</span><div><strong>'+(comeback?(correct?'Remembered later!':'Good review — here’s the answer.'):(support?(correct?'Good — keep going!':'Here is the smaller-step answer.'):(correct?(g.misses?'You worked it out!':'Nice work!'):'Here’s the model answer.')))+'</strong><p>'+esc(correct?q.explanation:(targeted||q.explanation))+'</p>'+adaptive+'</div></section><button type="button" class="game-next" data-game-next>'+(support||comeback?'Continue':progress===total?'See my score':'Next question')+' <span>›</span></button>':retryClue+'<div class="game-hint-wrap">'+(comeback?'<small class="adaptive-note">Comeback · same skill · not scored</small>':support?'<small class="adaptive-note">Support step · same skill · not scored</small>':'')+'<button type="button" class="game-hint-button" data-game-hint>'+(g.hintOpen?'Hide hint':'Need a hint?')+'</button>'+(g.hintOpen?'<p class="game-hint">'+esc(q.hint)+'</p>':'')+'</div>';
  return '<div class="game-topbar"><button type="button" data-game-home aria-label="Back to study games">‹</button><div><span>'+esc(comeback?"Comeback":support?"Support step":mode.title)+'</span><strong>'+(comeback?'Remember this skill later':support?'Same skill · smaller step':progress+' of '+total)+'</strong></div><b>★ '+g.score+'</b></div>'+
    '<div class="game-progress" aria-label="Game progress"><span style="width:'+pct+'%"></span></div>'+
    '<section class="game-question-card"><div class="game-question-meta"><span>'+esc(q.subject)+'</span><b>'+esc(comeback?"Comeback":support?"Support":labels[q.questionType]||"Practice")+'</b></div>'+(teach?'<div class="game-hint-wrap teach-card"><small class="adaptive-note">Quick lesson · not scored</small><p class="game-hint">'+esc(teach.instruction)+(teach.example?' '+esc(teach.example):'')+'</p></div>':'')+'<h2>'+esc(q.prompt)+'</h2>'+visual+'<div class="game-answer-list">'+answers+'</div>'+feedback+'</section>'+
    '<div class="game-streak"><span>Streak <b>'+g.streak+'</b></span><span>Best this round <b>'+g.bestStreak+'</b></span></div>';
}
function goal({state}){
  const g=state?.goal||{},selected=!!state?.selected,unlocked=!!state?.unlocked,pct=Math.max(0,Math.min(100,Number(state?.percent)||0));
  if(!g.id)return "";
  return '<section class="study-star-goal" aria-label="Dream Goal"><div class="study-star-goal-head"><span>★</span><div><small>DREAM GOAL</small><strong>'+esc(g.title)+'</strong></div><b>'+Math.max(0,Number(state?.balance)||0)+' / '+Math.max(1,Number(state?.target)||1)+' Stars</b></div><div class="study-star-goal-progress" role="progressbar" aria-label="Dream Goal progress" aria-valuemin="0" aria-valuemax="'+Math.max(1,Number(state?.target)||1)+'" aria-valuenow="'+Math.max(0,Number(state?.balance)||0)+'"><span style="width:'+pct+'%"></span></div><p>'+esc(unlocked?"Goal reached! Your badge is ready.":g.copy||"Keep practicing to fill the bar.")+'</p>'+(selected?'<small class="study-star-goal-selected">'+(unlocked?'Unlocked':'Goal selected')+'</small>':'<button type="button" data-study-star-goal="'+esc(g.id)+'">Choose this goal</button>')+'</section>';
}

function finish({mode,state,record}){
  const total=state.questions.length,pct=total?Math.round((state.score/total)*100):0,stars=pct>=90?3:pct>=70?2:pct>=40?1:0;
  return '<section class="game-finish"><div class="game-finish-stars" aria-label="'+stars+' stars">'+[0,1,2].map(i=>'<span class="'+(i<stars?'earned':'')+'">★</span>').join("")+'</div><p>'+esc(mode.title.toUpperCase())+'</p><h2>'+state.score+' out of '+total+'</h2><strong>'+pct+'%</strong><span>'+(pct>=90?'Fantastic work!':pct>=70?'Great job — one more round can make it even stronger.':pct>=40?'Good practice. Try another round to build the skill.':'Keep practicing — every round helps.')+'</span><div class="game-finish-actions"><button type="button" class="primary" data-game-start="'+esc(mode.id)+'">Play again</button><button type="button" data-game-home>All study games</button></div><small>Best score on this material: '+record.best+' / '+total+'</small></section>';
}
window.ABVMStudyGameView=Object.freeze({play,goal,finish});
})();