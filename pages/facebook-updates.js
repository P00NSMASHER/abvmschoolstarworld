/* Facebook announcements are a separately reviewed, source-preserving feed.
 * They are never school-pack, homework, spelling-list, or curriculum inputs. */
(()=>{'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const trustedIds=new Set(['ABVM_SCHOOL_FACEBOOK','ABVM_HSA_FACEBOOK']);
  const labels={
    ABVM_SCHOOL_FACEBOOK:'ABVM school Facebook',
    ABVM_HSA_FACEBOOK:'ABVM HSA Facebook'
  };
  let feed=null;
  const ymd=(date)=>{
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
      year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=part=>parts.find(p=>p.type===part)?.value||'';
    return get('year')+'-'+get('month')+'-'+get('day');
  };
  const shift=(day,amount)=>{
    const date=new Date(day+'T12:00:00.000Z');
    date.setUTCDate(date.getUTCDate()+amount);
    return date.toISOString().slice(0,10);
  };
  const monday=day=>{
    const date=new Date(day+'T12:00:00.000Z');
    return shift(day,-((date.getUTCDay()+6)%7));
  };
  function verifiedLink(value){
    try{
      const url=new URL(value);
      if(url.protocol==='https:'&&['facebook.com','www.facebook.com','m.facebook.com'].includes(url.hostname)
        &&!url.username&&!url.password)return url.href;
    }catch{}
    return null;
  }
  function current(item,view,weekStart,now){
    const dates=Array.isArray(item.eventDates)?item.eventDates:[];
    const today=ymd(now);
    const publication=ymd(new Date(item.postedAt));
    if(view==='today')return dates.includes(today)||publication===today;
    if(view==='week'){
      const start=/^\d{4}-\d\d-\d\d$/.test(weekStart)?weekStart:monday(today);
      const last=shift(start,6);
      return dates.some(d=>d>=start&&d<=last)||(publication>=start&&publication<=last);
    }
    return publication>=shift(today,-14)||dates.some(d=>d>=today&&d<=shift(today,30));
  }
  function renderFor(input,view='today',weekStart='',now=new Date()){
    if(!input||input.schemaVersion!==1||!Array.isArray(input.display))return '';
    const rows=input.display.filter(item=>
      item&&Array.isArray(item.sources)&&item.sources.length>0&&
      item.sources.every(s=>trustedIds.has(s.sourceId)&&verifiedLink(s.postUrl))&&
      typeof item.summary==='string'&&item.summary.trim()&&
      Number.isFinite(Date.parse(item.postedAt))&&current(item,view,weekStart,now)).slice(0,8);
    if(rows.length===0)return '';
    const title=view==='today'?'From your school community':
      view==='week'?'School & HSA this week':'Facebook announcements';
    const cards=rows.map(item=>{
      const tags=[...new Set(item.sources.map(source=>labels[source.sourceId]))];
      const links=item.sources.map(source=>
        '<a href="'+esc(verifiedLink(source.postUrl))+'" target="_blank" rel="noopener noreferrer">'+
        esc(labels[source.sourceId])+' post</a>').join(' · ');
      const when=item.conflict?'Dates conflict · check the original posts':
        item.eventDates.length?'Event: '+item.eventDates.join(', '):
        'Posted '+ymd(new Date(item.postedAt));
      return '<article class="facebook-update-row"><div class="facebook-update-meta">'+
        '<span>'+esc(tags.join(' · '))+'</span><small>'+esc(item.category||'Community news')+'</small></div>'+
        '<p>'+esc(item.summary)+'</p><small>'+esc(when)+'</small>'+
        '<div class="facebook-update-sources">'+links+'</div></article>';
    }).join('');
    return '<section class="facebook-updates-card" aria-label="'+esc(title)+'">'+
      '<h2>'+esc(title)+'</h2><div class="facebook-updates-list">'+cards+'</div>'+
      '<p class="facebook-updates-caveat">Facebook posts are not classroom assignments. Teacher materials remain the source for studying and tests.</p></section>';
  }
  function slot(view,weekStart=''){
    const allowed=['today','week','family'].includes(view)?view:'family';
    const date=/^\d{4}-\d\d-\d\d$/.test(weekStart)?weekStart:'';
    return '<div data-facebook-feed="'+allowed+'" data-facebook-week="'+date+'">'+
      renderFor(feed,allowed,date)+'</div>';
  }
  function refreshSlots(){
    if(typeof document==='undefined')return;
    for(const element of document.querySelectorAll('[data-facebook-feed]')){
      element.innerHTML=renderFor(feed,element.dataset.facebookFeed,
        element.dataset.facebookWeek||'');
    }
  }
  async function load(){
    try{
      const response=await fetch('./data/facebook-updates.json',{cache:'no-store'});
      if(!response.ok)throw new Error('feed unavailable');
      const data=await response.json();
      if(data?.schemaVersion===1&&Array.isArray(data.display)&&Array.isArray(data.posts)){
        feed=data;
        refreshSlots();
      }
    }catch{/* A blocked or offline feed cannot mutate school or study data. */}
  }
  window.ABVMFacebookUpdates=Object.freeze({slot,refreshSlots,renderFor,load});
  load();
})();
