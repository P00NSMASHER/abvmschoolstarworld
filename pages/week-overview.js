(() => {
  const WEEKDAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  window.weeklyOverviewHtml=function(days){
    const lunchRows=days.map(date=>{
      const events=eventItemsForDate(date),lunch=lunchForDate(date);
      const closed=events.some(item=>kindClass(item)==="closed")||lunch?.status==="no-school";
      const meal=closed?"No school lunch":lunch?(lunchText(lunch)||"Lunch menu not yet verified."):lunchUnavailableText(date);
      return '<div class="weekly-overview-row"><time datetime="'+isoDateKey(date)+'">'+esc(WEEKDAY[date.getDay()]+" "+date.getDate())+'</time><p>'+esc(meal)+'</p></div>';
    }).join("");
    const testGroups=days.map(date=>({
      date,
      items:eventItemsForDate(date).filter(item=>kindClass(item)==="test")
    })).filter(group=>group.items.length);
    const tests=testGroups.length
      ?testGroups.map(group=>'<div class="weekly-overview-row"><time datetime="'+isoDateKey(group.date)+'">'+esc(WEEKDAY[group.date.getDay()]+" "+group.date.getDate())+'</time><ul>'+group.items.map(item=>'<li>'+esc(item.label)+'</li>').join("")+'</ul></div>').join("")
      :'<p class="weekly-overview-empty">No tests are currently listed for this week.</p>';
    return '<section class="weekly-overview" aria-labelledby="weekly-overview-title"><div class="weekly-overview-head"><p>WEEKLY SUMMARY</p><h2 id="weekly-overview-title">This week at a glance</h2></div><div class="weekly-overview-grid"><section class="weekly-overview-card weekly-lunches" aria-labelledby="weekly-lunches-title"><div class="weekly-overview-card-title"><span aria-hidden="true">🍎</span><h3 id="weekly-lunches-title">Lunches this week</h3></div>'+lunchRows+'</section><section class="weekly-overview-card weekly-tests" aria-labelledby="weekly-tests-title"><div class="weekly-overview-card-title"><span aria-hidden="true">✓</span><h3 id="weekly-tests-title">Tests this week</h3></div>'+tests+'</section></div></section>';
  };
})();
