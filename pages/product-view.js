/* ABVM presentation only. All dates, source decisions and learning evidence are
 * supplied by the existing controllers; this layer never manufactures data. */
(() => {
  "use strict";
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const paths = {
    arrow: "M5 12h14m-6-6 6 6-6 6",
    book: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5",
    calendar:
      "M8 3v4m8-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2Zm2 8h2m4 0h2m-8 4h2",
    lunch: "M6 3v7m-3-7v4c0 4 6 4 6 0V3M6 11v10M16 3v18m0-18c4 1 5 4 5 8h-5",
    check: "m5 12 4 4L19 6",
    bell: "M18 8a6 6 0 0 0-12 0c0 6-3 7-3 9h18c0-2-3-3-3-9Zm-9 12h6",
    chart: "M4 19h16M7 15v-4m5 4V5m5 10V9",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3",
  };
  const icon = (name) =>
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
    (paths[name] || paths.book) +
    '"/></svg>';
  const sectionHead = (title, action = "") =>
    '<div class="section-heading"><h2>' +
    esc(title) +
    "</h2>" +
    action +
    "</div>";
  const route = (tab, label, klass = "text-button", accessibleLabel = "") =>
    '<button class="' +
    klass +
    '" type="button" data-route="' +
    tab +
    '"' + (accessibleLabel ? ' aria-label="' + esc(accessibleLabel) + '"' : "") +
    '>' +
    esc(label) +
    icon("arrow") +
    "</button>";
  // The Today lunch is above the fold on phones. Render its reviewed image
  // eagerly while leaving Week/Calendar lunch artwork lazy-loaded.
  const eagerTodayLunchArt = (markup) =>
    markup.replace('loading="lazy"', 'loading="eager"');
  function today(c) {
    const {
      d,
      events,
      tasks,
      next,
      reminders,
      header,
      freshness,
      taskHtml,
      lunchHtml,
      kindClass,
      fmtDate,
      fmtShort,
    } = c;
    const closed = events.some((e) => kindClass(e) === "closed");
    // Suppress only equivalent date-prefixed notices already in today's timeline.
    // Keep the full data intact; a price, deadline detail or added instruction
    // makes the notice distinct and therefore remains visible.
    const comparableNotice = (value) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^:]{0,45}:\s*/i, "")
        .replace(/\b(?:is|are|was|were)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const listedEvents = new Set(events.map(e => comparableNotice(e.label)));
    const visibleReminders = reminders.filter(x => !listedEvents.has(comparableNotice(x)));
    const nextHtml = next
      ? '<section class="priority-card"><div class="date-tile"><strong>' +
        esc(fmtShort(next.d).split(" ")[0]) +
        "</strong><span>" +
        next.d.getDate() +
        "</span></div><div><p>" +
        (kindClass(next.x) === "due" ? "NEXT DEADLINE" : "NEXT TEST") +
        "</p><h3>" +
        esc(next.x.label) +
        "</h3><span>" +
        esc(fmtDate(next.d)) +
        "</span></div>" +
        route(
          kindClass(next.x) === "due" ? "week" : "study",
          "Open",
          "icon-button",
          (kindClass(next.x) === "due" ? "View school week for " : "Open Study for ") + next.x.label,
        ) +
        "</section>"
      : '<section class="priority-card quiet"><span class="feature-icon">' +
        icon("check") +
        "</span><div><h3>A little practice goes a long way.</h3><span>No upcoming test is listed.</span></div></section>";
    const rows = events.length
      ? events
          .map(
            (e) =>
              '<div class="timeline-row"><span class="timeline-pin ' +
              kindClass(e) +
              '" aria-hidden="true"></span><div><small>' +
              esc(e.kind || "School") +
              "</small><strong>" +
              esc(e.label) +
              "</strong></div></div>",
          )
          .join("")
      : '<p class="empty-copy">No special school events are listed for today.</p>';
    return (
      '<div class="screen today-screen" role="region" aria-label="Today">' +
      '<h1 class="visually-hidden" tabindex="-1">Today</h1><section class="hero-card school-photo-hero"><div class="hero-copy"><p class="eyebrow">' +
      esc(fmtDate(d)) +
      '</p><h2>Ready for today?</h2><p>Your school day, all together.</p></div><img class="hero-photo" src="./assets/school/abvm-school-hero.webp" width="1024" height="683" fetchpriority="high" alt="Assumption BVM School in Pottsville"><span class="photo-caption">OUR ABVM</span><img class="today-school-seal" src="./assets/abvm-app-icon-192.png" width="48" height="48" alt="Assumption BVM Catholic School logo"></section>' +
      c.homeworkHtml + '<figure class="school-sign-card"><img class="school-sign-photo" src="./assets/school/abvm-school-sign.webp" width="420" height="280" loading="eager" decoding="async" alt="Original photograph of the Assumption BVM school sign on Howard Avenue"><figcaption><strong>Our school sign</strong><span>Assumption BVM · Howard Avenue</span></figcaption></figure>' +
      '<div class="today-primary">' + nextHtml +
      '<button class="study-invitation" type="button" data-route="study"><img src="./assets/illustrations/reading.webp" width="72" height="72" alt=""><span><strong>Start studying</strong><small>A little practice. A little more confidence.</small></span>' +
      icon("arrow") +
      "</button></div>" +
      eagerTodayLunchArt(lunchHtml) +
      '<section class="today-panel">' +
      sectionHead(closed ? "Today’s plan" : "At school today") +
      '<div class="timeline">' +
      rows +
      "</div>" +
      (tasks.length
        ? '<div class="task-list">' +
          tasks.map(({ item, index }) => taskHtml(item, index)).join("") +
          "</div>"
        : "") +
      "</section>" +
      (visibleReminders.length
        ? '<section class="today-updates-card">' +
          sectionHead("Worth remembering", route("family", "All updates")) +
          visibleReminders
            .map(
              (x) =>
                '<div class="reminder-line"><span aria-hidden="true">' +
                icon("bell") +
                "</span><p>" +
                c.linkedTextHtml(x) +
                "</p></div>",
            )
            .join("") +
          "</section>"
        : "") +
      freshness() +
      "</div>"
    );
  }
  function homeworkCard({state,items=[],compact=false,taskHtml,isToday=true}) {
    const status=state?.state||"unverified";
    const stamp=state?.checkedAt?new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(state.checkedAt)):"";
    const live=status==="assignments"||status==="no-homework"||status==="no-specific-posting";
    const text=status==="assignments"?"Current teacher posting · checked "+stamp+" ET · no date shown on page"
      :status==="no-homework"?"Teacher explicitly posted no homework · checked "+stamp+" ET"
      :status==="no-specific-posting"?"No specific assignment is currently listed · checked "+stamp+" ET"
      :status==="other-day"?"The teacher does not date assignments; only today's verified posting is shown."
      :status==="outdated"?"Homework needs today's teacher verification. Last checked "+stamp+" ET."
      :"Today's homework is not yet verified in the app.";
    const rows=status==="assignments"
      ?'<div class="homework-task-list">'+items.map(({item,index})=>taskHtml(item,index)).join("")+'</div>'
      :'<p class="homework-empty">'+esc(text)+'</p>';
    const heading='<div class="homework-heading"><div><span class="homework-eyebrow">ASSIGNMENTS TO COMPLETE</span><h2>Homework</h2></div><a href="https://sites.google.com/view/abvmgr2/homework" target="_blank" rel="noopener noreferrer" aria-label="View the official Grade 2 teacher Homework page">Teacher page ↗</a></div>';
    return '<section class="'+(compact?'week-homework-card':'today-homework')+(live?' is-verified':' needs-verification')+'" aria-labelledby="'+(compact?'week-homework-heading':'today-homework-heading')+'">'+heading.replace('<h2>Homework</h2>','<h2 id="'+(compact?'week-homework-heading':'today-homework-heading')+'">Homework</h2>')+rows+(status==="assignments"?'<p class="homework-source">'+esc(text)+'</p>':'')+'</section>';
  }
  function week(c) {
    const {
      days,
      selectedDay,
      offset,
      events,
      tasks,
      lunchHtml,
      header,
      freshness,
      taskHtml,
      kindClass,
      fmtDate,
      fmtShort,
      weekRangeLabel,
      overview,
    } = c;
    const picker = days
      .map(
        (d) =>
          '<button type="button" class="' +
          (+d === +selectedDay ? "active" : "") +
          '" data-day="' +
          d.toISOString() +
          '" aria-label="' +
          esc(fmtDate(d)) +
          '" aria-pressed="' +
          (+d === +selectedDay) +
          '"><span>' +
          esc(fmtShort(d).split(" ")[0]) +
          "</span><strong>" +
          d.getDate() +
          '</strong><i aria-hidden="true" class="' +
          (c.eventItemsForDate(d).some((e) => kindClass(e) === "test")
            ? "has-test"
            : "") +
          '"></i></button>',
      )
      .join("");
    return (
      '<div class="screen week-screen" role="region" aria-label="This week">' +
      header("THE SCHOOL PLAN", "This week") +
      c.segments +
      window.ABVMSchoolUpdates.officialCalendarLink() +
      '<div class="week-toolbar"><nav class="week-nav" aria-label="Change displayed week"><button type="button" data-week-step="-1" aria-label="Previous week">‹</button><div aria-live="polite"><span>' +
      (offset === 0 ? "THIS SCHOOL WEEK" : "VIEWING WEEK") +
      "</span><strong>" +
      esc(weekRangeLabel(days)) +
      '</strong></div><button type="button" data-week-step="1" aria-label="Next week">›</button></nav>' +
      "</div>" +
      (offset !== 0
        ? '<button class="week-today-jump text-button" type="button" data-week-today>Back to this week</button>'
        : "") +
      '<div class="day-picker">' +
      picker +
      "</div>" +
      '<div class="week-main"><section class="day-detail"><div class="day-detail-title"><div><p class="eyebrow">DAY BY DAY</p><h2>' +
      esc(fmtDate(selectedDay)) +
      "</h2></div><span>" +
      (events.some((e) => kindClass(e) === "closed")
        ? "No school"
        : "School day") +
      '</span></div><div class="event-stack">' +
      (events.length
        ? events
            .map(
              (e) =>
                '<div class="event-row"><span class="event-label ' +
                kindClass(e) +
                '">' +
                esc(e.kind || "School") +
                "</span><strong>" +
                esc(e.label) +
                "</strong></div>",
            )
            .join("")
        : '<p class="empty-copy">No special events are listed for this day.</p>') +
      "</div>" + c.homeworkHtml +
      (tasks.length
        ? '<section class="week-school-actions" aria-label="Other school actions"><h3>Other school actions</h3><div class="task-list">' +
          tasks.map(({item,index})=>taskHtml(item,index)).join("") +
          '</div></section>'
        : "") +
      '</section><div class="week-rail">' +
      lunchHtml +
      (c.reminder
        ? '<section class="reminder-strip"><span class="feature-icon">' +
          icon("bell") +
          "</span><p><strong>Don’t forget</strong>" +
          esc(c.reminder) +
          "</p></section>"
        : "") +
      '<section class="future-card"><h3>Coming soon</h3>' +
      c.future
        .map(
          (o) =>
            "<div><time>" +
            esc(fmtShort(o.d)) +
            "</time><p>" +
            esc(o.x.label) +
            "</p></div>",
        )
        .join("") +
      "</section></div></div>" +
      overview +
      freshness() +
      "</div>"
    );
  }
  function progress(c) {
    const {
      pack,
      header,
      freshness,
      learning,
      actions,
      notices,
      linkedTextHtml,
    } = c;
    const snapshot = window.ABVMWeeklyLearning.snapshot({ pack, learning });
    const hasEvidence =
      [...snapshot.strong, ...snapshot.remembered, ...snapshot.practice]
        .length > 0;
    const subjects = (pack.subjects || []).filter(
      (s) => s.subject !== "Specials",
    );
    const learningHtml = hasEvidence
      ? window.ABVMWeeklyLearning.render({ pack, learning })
      : '<section class="progress-empty"><span class="progress-orbit" aria-hidden="true">' +
        icon("chart") +
        '</span><div><p class="eyebrow">ONE SMALL STEP AT A TIME</p><h2>Watch learning grow.</h2><p>After a few practice rounds, see what’s clicking and what deserves another look.</p>' +
        route("study", "Start a practice round", "primary-button") +
        "</div></section>";
    return (
      '<div class="screen family-screen progress-screen" role="region" aria-label="Learning progress">' +
      header("THE BIGGER PICTURE", "Progress") +
      '<section class="family-hero"><div><h2>Growing every week.</h2><p>Small steps. A little more confidence.</p></div><img src="./assets/illustrations/reading.webp" width="112" height="112" alt=""></section>' +
      learningHtml +
      '<section class="learning-library">' +
      sectionHead("In class right now", route("study?notes", "Study notes")) +
      '<div class="learning-subjects">' +
      subjects
        .map(
          (s) =>
            '<article class="learning-subject"><span class="feature-icon ' +
            (/math/i.test(s.subject)
              ? "math"
              : /religion/i.test(s.subject)
                ? "religion"
                : /spell|handwriting|grammar/i.test(s.subject)
                  ? "spelling"
                  : "reading") +
            '">' +
            '<img src="./assets/illustrations/' + (/math/i.test(s.subject) ? "math" : /religion/i.test(s.subject) ? "religion" : /spell|handwriting|grammar/i.test(s.subject) ? "spelling" : "reading") + '.webp" width="64" height="64" loading="lazy" alt="">' +
            "</span><div><h3>" +
            esc(s.subject) +
            "</h3><p>" +
            esc(
              (s.topics || []).slice(0, 2).join(" · ") ||
                "No new lesson has been verified yet.",
            ) +
            "</p></div></article>",
        )
        .join("") +
      '</div><p class="device-note">Practice insights stay on this device. They are not school grades or a measure of mastery.</p></section>' +
      '<section class="school-work-history">' +
      sectionHead("Your learning library") +
      "<p>Class notes, reviewed schoolwork and earlier lessons stay available for practice.</p>" +
      route("study?notes", "Explore notes & guides") +
      "</section>" +
      '<details class="school-details" open><summary><span>' +
      icon("bell") +
      'School & family updates</span><b aria-hidden="true">⌄</b></summary><div class="family-updates">' +
      (actions.length
        ? '<section class="parent-card family-actions-card"><h3>Family actions</h3><ul>' +
          actions.map((x) => "<li>" + esc(x) + "</li>").join("") +
          "</ul></section>"
        : "") +
      window.ABVMSchoolUpdates.noticesCard(notices, linkedTextHtml) +
      (window.ABVMWeeklyLearning.renderChanges(pack.schoolChangeFeed) || "") +
      "</div></details>" +
      freshness() +
      '<p class="unofficial-note">Your family companion for ABVM Grade 2.</p></div>'
    );
  }
  // UI-only date navigation: a weekend maps to its Mon-Fri school week.
  // Compare UTC day ordinals so daylight-saving changes cannot offset a week.
  // Presentation only: every row and label comes from the governed controller.
  // Calendar presentation uses civil days, never UTC-parsed date-only strings.
  const calendarKey = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const calendarMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const calendarKinds = {closed:'No school',test:'Test',faith:'Faith',due:'Due',family:'School event',lunch:'Lunch'};
  const calendarKind = kind => Object.hasOwn(calendarKinds,kind) ? kind : 'family';
  function calendarDate(value) {
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const [year,month,day]=value.split('-').map(Number);
    if(year<100||month<1||month>12||day<1||day>31)return null;
    const d=new Date(year,month-1,day,12);
    return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?d:null;
  }
  function calendarShift(date,amount) {
    const target=new Date(date.getFullYear(),date.getMonth()+amount,1,12);
    target.setDate(Math.min(date.getDate(),new Date(target.getFullYear(),target.getMonth()+1,0,12).getDate()));
    return target;
  }
  function calendarBrief(events,kindClass) {
    if(!events.length)return '';
    if(events.some(e=>kindClass(e)==='closed'))return 'No school';
    const tests=events.filter(e=>kindClass(e)==='test').length;
    if(tests)return tests===1?'Test':tests+' tests';
    const names=[[/progress report/i,'Reports'],[/dress.down/i,'Dress down'],[/uniform/i,'Uniforms'],[/conference/i,'Conference'],[/mass/i,'Mass'],[/lego/i,'LEGO'],[/chick.fil/i,'Chick-fil-A'],[/picture/i,'Pictures'],[/communication folder/i,'Folder']];
    for(const [pattern,label] of names)if(events.some(e=>pattern.test(e.label)))return label;
    return kindClass(events[0])==='family'?'Event':calendarKinds[calendarKind(kindClass(events[0]))];
  }
  function calendarGrid({year,month,now,selected,eventItemsForDate,kindClass,fmtDate}) {
    const first=new Date(year,month,1,12),count=new Date(year,month+1,0,12).getDate();
    const length=Math.ceil((first.getDay()+count)/7)*7;
    const selectedKey=calendarKey(selected),todayKey=calendarKey(now);
    return Array.from({length},(_,i)=>{
      const d=new Date(year,month,i-first.getDay()+1,12),key=calendarKey(d),inside=d.getMonth()===month;
      const events=eventItemsForDate(d),on=key===selectedKey,current=key===todayKey;
      const mainKind=events.some(e=>kindClass(e)==='closed')?'closed':events.some(e=>kindClass(e)==='test')?'test':calendarKind(kindClass(events[0]||{}));
      const extra=events.length>2?'<span class="cal-overflow">+'+(events.length-2)+' more</span>':'';
      const classes=[!inside?'outside':'',[0,6].includes(d.getDay())?'weekend':'',mainKind==='closed'?'closed':'',on?'active':'',current?'is-today':''].filter(Boolean).join(' ');
      return '<button type="button" class="'+classes+'" '+(inside?'data-cal-day':'data-cal-jump')+'="'+key+'" tabindex="'+(on?'0':'-1')+'" aria-pressed="'+on+'"'+(current?' aria-current="date"':'')+' aria-label="'+esc(fmtDate(d)+(events.length?': '+events.map(e=>e.label).join(', '):'')+(inside?'':' · adjacent month'))+'"><strong>'+d.getDate()+'</strong><span class="cal-cell-note '+mainKind+'" aria-hidden="true">'+esc(calendarBrief(events,kindClass))+'</span><span class="cal-cell-count" aria-hidden="true">'+(events.length>1?'+'+(events.length-1):'')+'</span><span class="cal-cell-events" aria-hidden="true">'+events.slice(0,2).map(e=>'<span class="cal-event-preview '+calendarKind(kindClass(e))+'">'+esc(e.label)+'</span>').join('')+extra+'</span></button>';
    }).join('');
  }
  function calendarEvent(event,kind) {
    kind=calendarKind(kind);
    const source=event.source==='uploaded-notice'?'Reviewed school notice':event.source==='teacher-page'?'Teacher page':'Published school information';
    const titleHasTime=/\b(?:\d{1,2}:\d{2}|\d{1,2}\s*[ap]\.?m\.?|noon)\b/i.test(event.label||'');
    const timing=typeof event.time==='string'&&event.time.trim()?event.time:event.allDay===true?'All day':titleHasTime?'See event title':'Time not listed';
    const sourceUrl=event.sourceUrl||event.url||'';
    const link=/^https?:\/\/[^\s"<>]+$/i.test(sourceUrl)?'<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener noreferrer">Open recorded source ↗</a>':'';
    return '<details class="cal-event '+kind+'"><summary><span class="cal-event-accent" aria-hidden="true"></span><span class="cal-event-copy"><small>'+esc(calendarKinds[kind])+'</small><strong>'+esc(event.label)+'</strong></span><span class="cal-event-chevron" aria-hidden="true">›</span></summary><div class="cal-event-provenance"><p><b>Date</b><span>'+esc(event.date||'See selected day')+'</span></p><p><b>Time</b><span>'+esc(timing)+'</span></p><p><b>Source</b><span>'+esc(source)+'</span></p>'+(event.sourceDocument?'<p><b>Record</b><span>'+esc(event.sourceDocument)+'</span></p>':'')+link+'</div></details>';
  }
  function calendarPicker(year,month) {
    return '<p class="cal-picker-label">Choose a month</p><div class="cal-month-options">'+calendarMonths.map((name,index)=>'<button type="button" data-cal-month="'+year+'-'+String(index+1).padStart(2,'0')+'-01" aria-pressed="'+(index===month)+'">'+name.slice(0,3)+'</button>').join('')+'</div><button class="cal-picker-close" type="button" data-cal-picker-close>Close month picker</button>';
  }
  function calendar(c) {
    const {year,month,selected,now,events,kindClass,fmtDate,segments,logo,lunchHtml,summaryHtml,weeklyHtml,specialsHtml,nextHtml,sourceHtml,freshnessHtml}=c;
    const closed=events.some(e=>kindClass(e)==='closed');
    return '<div class="screen calendar-screen calendar-studio" role="region" aria-label="'+calendarMonths[month]+' calendar"><header class="cal-header"><div class="cal-identity">'+logo+'<div><p>ABVM · GRADE 2</p><h1 tabindex="-1">Calendar</h1></div></div><div class="cal-header-actions">'+segments+'<button class="cal-today" type="button" data-cal-today aria-label="Jump to today">Today</button></div></header><nav class="calendar-month-nav" aria-label="Change calendar month"><button type="button" data-cal-step="-1" aria-label="Previous month">‹</button><button class="cal-month-title" type="button" data-cal-picker-toggle aria-expanded="false" aria-controls="cal-month-picker" aria-label="Choose month"><strong>'+calendarMonths[month]+' '+year+'</strong><span aria-hidden="true">⌄</span></button><button type="button" data-cal-step="1" aria-label="Next month">›</button></nav><section id="cal-month-picker" class="cal-picker" aria-label="Choose month" hidden>'+calendarPicker(year,month)+'</section><div class="calendar-layout"><section class="calendar-card" aria-label="Month dates"><div class="calendar-weekdays" aria-hidden="true">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="calendar-grid" aria-label="'+calendarMonths[month]+' '+year+' dates">'+calendarGrid({...c,now,selected})+'</div><p class="cal-grid-hint">Tap a day for the full plan<span>Swipe to change month</span></p></section><section class="calendar-day-card" aria-live="polite" aria-atomic="false" aria-label="Selected day"><div class="calendar-day-heading"><div><p>'+esc(fmtDate(selected).split(',')[0])+'</p><h2>'+calendarMonths[selected.getMonth()]+' '+selected.getDate()+'</h2></div><span class="cal-day-count '+(closed?'closed':'')+'">'+(closed?'No school':events.length===1?'1 event':events.length+' events')+'</span></div>'+(events.length?'<div class="calendar-event-list">'+events.map(e=>calendarEvent(e,kindClass(e))).join('')+'</div>':'<div class="cal-empty-state"><span aria-hidden="true">'+icon('calendar')+'</span><p class="calendar-empty">No special school events are listed for this date.</p></div>')+lunchHtml+'<button class="calendar-study-action" type="button" data-route="study">Start studying '+icon('arrow')+'</button></section></div><div class="cal-secondary">'+summaryHtml+'<details class="calendar-more" open><summary class="cal-weekly-heading"><span class="cal-section-icon" aria-hidden="true">'+icon('chart')+'</span><span class="cal-heading-copy"><strong>Weekly lunches and tests</strong><small>This week at a glance</small></span><span class="cal-open-indicator" aria-hidden="true">⌄</span></summary><div class="calendar-more-content">'+weeklyHtml+'</div></details>'+specialsHtml+nextHtml+'</div><footer class="cal-source-footer">'+sourceHtml+freshnessHtml+'</footer></div>';
  }
  // One delegated listener set survives controller redraws and cached-pack refreshes.
  function bindCalendar(root,{getDate,selectDate,shiftMonth}) {
    let gesture=null,suppressClickUntil=0;
    const closePicker=()=>{const picker=root.querySelector('#cal-month-picker'),button=root.querySelector('[data-cal-picker-toggle]');if(picker)picker.hidden=true;if(button){button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});}};
    root.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(!button?.closest('.calendar-studio'))return;
      if(Date.now()<suppressClickUntil&&button.closest('.calendar-grid')){event.preventDefault();event.stopImmediatePropagation();return;}
      const attr=button.dataset;
      if('calPickerToggle' in attr){const picker=root.querySelector('#cal-month-picker');picker.hidden=!picker.hidden;button.setAttribute('aria-expanded',String(!picker.hidden));if(!picker.hidden)picker.querySelector('[aria-pressed="true"]')?.focus({preventScroll:true});}
      else if('calPickerClose' in attr)closePicker();
      else if('calMonth' in attr){const d=calendarDate(attr.calMonth);if(d){d.setDate(Math.min(getDate().getDate(),new Date(d.getFullYear(),d.getMonth()+1,0,12).getDate()));selectDate(d,'[data-cal-picker-toggle]');}}
      else if('calOpenDate' in attr){
        const day=calendarDate(attr.calOpenDate);
        if(day){
          selectDate(day);
          const agenda=root.querySelector('.calendar-day-card');
          if(agenda){
            const title=agenda.querySelector('.calendar-day-heading h2');
            if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
            agenda.scrollIntoView({block:'start',behavior:'instant'});
          }
        }
      }
      else if('calDay' in attr||'calJump' in attr){const d=calendarDate(attr.calDay||attr.calJump);if(d)selectDate(d);}
      else if('calStep' in attr)shiftMonth(Number(attr.calStep),'[data-cal-step="'+attr.calStep+'"]');
      else return;
      event.preventDefault();event.stopImmediatePropagation();
    },true);
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&root.querySelector('#cal-month-picker:not([hidden])')){event.preventDefault();closePicker();return;}
      const button=event.target.closest('[data-cal-day],[data-cal-jump]');if(!button)return;
      const d=calendarDate(button.dataset.calDay||button.dataset.calJump);if(!d)return;
      const steps={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
      if(Object.hasOwn(steps,event.key))d.setDate(d.getDate()+steps[event.key]);
      else if(event.key==='Home')d.setDate(d.getDate()-d.getDay());
      else if(event.key==='End')d.setDate(d.getDate()+6-d.getDay());
      else if(event.key==='PageUp'||event.key==='PageDown'){event.preventDefault();selectDate(calendarShift(d,event.key==='PageUp'?-1:1));return;}
      else return;
      event.preventDefault();selectDate(d);
    });
    root.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&event.target.closest('.calendar-grid'))gesture={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now()};});
    root.addEventListener('pointercancel',()=>{gesture=null;});
    root.addEventListener('pointerup',event=>{
      const start=gesture;gesture=null;if(!start||event.pointerId!==start.id)return;
      const dx=event.clientX-start.x,dy=event.clientY-start.y;
      if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.6&&Date.now()-start.at<1000){suppressClickUntil=Date.now()+400;event.preventDefault();shiftMonth(dx<0?1:-1,'.calendar-grid button.active');}
    });
  }

  function compactMonthCard(monthName, rows, extraClass) {
    const current=extraClass==='current-month-summary';
    const intro=current?'Important dates and reminders':'Looking ahead';
    const heading='<header class="cal-card-heading"><span class="cal-section-icon" aria-hidden="true">'+icon('calendar')+'</span><div><h2>Coming in '+esc(monthName)+'</h2><p>'+intro+'</p></div></header>';
    const dates=rows.map(({date,dayKey,labels})=>{
      const valid=calendarDate(dayKey);
      const heading=valid?'<button type="button" data-cal-open-date="'+esc(dayKey)+'" aria-label="View '+esc(monthName)+' '+valid.getDate()+' agenda">'+esc(date)+'</button>':esc(date);
      return '<div class="cal-date-row"><span>'+heading+'</span><ul role="list">'+
        labels.map(label=>'<li>'+esc(label)+'</li>').join('')+'</ul></div>';
    }).join('');
    return '<section class="'+esc(extraClass)+' compact-month-card">'+heading+dates+
      (rows.length?'':'<p class="cal-empty-events">No additional school events are listed for this month.</p>')+'</section>';
  }
  function calendarSpecials(rows) {
    const heading='<header class="cal-card-heading"><span class="cal-section-icon" aria-hidden="true">'+
      icon('book')+'</span><div><p class="cal-section-eyebrow">WEEKLY ROTATION</p><h2>Specials</h2><p>Class schedule at a glance</p></div></header>';
    const list=rows.map(row=>'<div class="special-row"><span>'+esc(row.day)+'</span><strong>'+esc(row.label)+'</strong></div>').join('');
    return '<section class="specials-card">'+heading+'<div class="specials-list">'+list+'</div></section>';
  }
  function plannerDate(to,from,monthDay,weekDay,now,firstWeekDay){
    if(to==="week"&&from==="calendar"&&monthDay){
      const mon=new Date(monthDay);
      mon.setHours(12,0,0,0);
      const weekday=mon.getDay();
      mon.setDate(mon.getDate()-(weekday===0?6:weekday-1));
      const ordinal=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
      return {
        weekOffset:Math.round((ordinal(mon)-ordinal(firstWeekDay))/604800000),
        selectedDay:[0,6].includes(weekday)?mon:new Date(monthDay)
      };
    }
    if(to==="calendar"&&from==="week"&&weekDay){
      return {
        calendarOffset:(weekDay.getFullYear()-now.getFullYear())*12+weekDay.getMonth()-now.getMonth(),
        calendarDay:new Date(weekDay)
      };
    }
    return null;
  }
  // The verified teacher pack may be stale even when the public teacher site is live.
  // This is an external destination, never a new verification or publication.
  const OFFICIAL_TEACHER_HOME = "https://sites.google.com/view/abvmgr2/home";
  function teacherSourceLink(state, online) {
    if (!online || (state !== "stale" && state !== "attention")) return "";
    return '<a class="teacher-live-source" href="' + OFFICIAL_TEACHER_HOME + '" target="_blank" rel="noopener noreferrer" aria-label="View official Grade 2 teacher page in a new tab; app verification stays unchanged">View live teacher page <span aria-hidden="true">↗</span></a>';
  }
  function freshnessControl({ state, label, pending = false, online = true }) {
    const action = pending ? "Checking published school information" : "Check published school information. " + label;
    const button = '<button type="button" class="freshness ' + state + (pending ? ' is-refreshing' : '') + '" data-refresh-pack aria-label="' + esc(action) + '"' + (pending ? ' disabled' : '') + '><span aria-hidden="true"></span><strong>' + esc(label) + '</strong><b aria-hidden="true">↻</b></button>';
    return button + teacherSourceLink(state, online);
  }
  function replaceFreshness(node, markup) {
    // Replacing both siblings avoids duplicate links on stale retries and
    // clears the link when verification succeeds or the device goes offline.
    if (node.nextElementSibling?.matches(".teacher-live-source")) node.nextElementSibling.remove();
    node.outerHTML = markup;
  }
  window.ABVMProductView = Object.freeze({ today, week, homeworkCard, progress, icon, plannerDate, compactMonthCard, calendarSpecials, freshnessControl, replaceFreshness, calendar, calendarDate, calendarShift, calendarGrid, calendarEvent, bindCalendar });
})();

(()=>{"use strict";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const art=["starlight","spark","scholar","golden","eagle","champion"];
let saved=null,pending=null;
function image(b,size=96){const index=Number(b?.artIndex??b?.art),fallback=(art[index]||art[0])+".webp",name=b?.starter?"eaglet.webp":/^[a-z0-9-]+\.(?:webp|svg)$/.test(b?.artFile||"")?b.artFile:fallback;return '<img class="study-badge-art" src="./assets/badges/'+name+'" width="'+size+'" height="'+size+'" alt="" decoding="async">'}
function meter(c){const next=c.next;if(!next)return '<p class="badge-complete">Top rank reached. Look at you, legend!</p>';const progress=Math.min(next.target,Math.max(0,Number(c.progress)||0)),earned=Math.max(0,Number(c.segmentProgress)||0),gap=Math.max(1,Number(c.segmentTarget)||1),pct=Math.max(0,Math.min(100,Number(c.segmentPercent)||0));return '<div class="badge-progress-label"><span>'+progress+' / '+next.target+' stars</span><strong>'+c.remaining+' to go</strong></div><div class="badge-progress" role="progressbar" aria-label="Next rank progress" aria-valuemin="0" aria-valuemax="'+gap+'" aria-valuenow="'+earned+'"><span style="width:'+pct+'%"></span></div>'}
function date(b){if(!b?.earnedAt)return b?.migrated?'Promoted with your earlier stars':'Promoted';const d=new Date(b.earnedAt);return Number.isFinite(d.getTime())?'Promoted '+new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric'}).format(d):'Promoted'}
function render(c,kind='collection'){
  if(!c)return '<div class="badge-loading" role="status">Loading your Study Stars…</div>';
  const latest=c.latest,next=c.next,current=c.current||latest||{title:'Eaglet',starter:true},featured=next||current,total=(c.badges||[]).length+1,rank=current.starter?1:Math.max(1,(c.badges||[]).findIndex(b=>b.id===current.id)+2);
  if(kind==='today')return '<button type="button" class="study-badge-latest" data-open-badges>'+image(current,80)+'<span><small>'+'STUDY RANK · '+rank+' OF '+total+'</small><strong>'+esc(current.title)+'</strong><span>'+esc(latest?date(latest):'Every eagle starts here.')+'</span></span><b aria-hidden="true">›</b></button>';
  if(kind==='study')return '<button type="button" class="study-badge-tracker" data-open-badges>'+image(current,64)+'<span><strong>'+c.balance+' Study Stars</strong><small>'+esc(next?next.title+' · '+c.remaining+' stars to promote':'ABVM Legend · top rank')+'</small><span class="badge-mini-track" aria-hidden="true"><i style="width:'+Math.min(100,Math.max(0,c.segmentPercent??c.percent))+'%"></i></span></span><b aria-hidden="true">›</b></button>';
  const cards=(c.badges||[]).map(b=>'<li class="study-badge-card '+(b.unlocked?'is-earned':next?.id===b.id?'is-next':'is-locked')+'">'+image(b,120)+'<strong>'+esc(b.title)+'</strong><span>'+b.target+' stars</span><small>'+(b.id===current.id?'Current rank':b.unlocked?'Promoted':next?.id===b.id?'Up next':'Locked')+'</small></li>').join('');
  return '<section class="study-star-goal badge-collection" data-badge-collection aria-labelledby="badge-title"><div class="badge-collection-heading"><div><span class="badge-eyebrow">STUDY RANK JOURNEY</span><h2 id="badge-title">Your rank</h2></div><strong class="badge-balance"><span aria-hidden="true">★</span> '+c.balance+'</strong></div>'+ (kind==='finish'?'':'<div class="rank-current">'+image(current,128)+'<div><span class="badge-eyebrow">RANK '+rank+' OF '+total+'</span><h3>'+esc(current.title)+'</h3><p>'+esc(latest?date(latest):'Every eagle starts here.')+'</p></div></div>')+'<div class="study-badge-next">'+image(featured,144)+'<div><span class="badge-eyebrow">'+(next?'NEXT PROMOTION':'TOP RANK')+'</span><h3>'+esc(featured?.title||'ABVM Legend')+'</h3><p>'+esc(next?'Keep going. This one’s waiting for you.':'You’ve reached the highest ABVM rank.')+'</p></div>'+meter(c)+'</div>'+(kind==='finish'?'<button type="button" class="badge-see-all" data-open-badges>See the rank ladder <span aria-hidden="true">›</span></button>':'<p class="badge-rail-hint">Swipe to explore ranks →</p><ol class="study-badge-grid" aria-label="Rank milestones — scroll horizontally to explore" tabindex="0">'+cards+'</ol>')+'<p class="badge-rules">Finish a round: +10 stars. Correct streak: up to +10. Perfect first-try score: +25 bonus. Wrong answer: −2, down to zero. Earned ranks stay yours.</p><small class="badge-device-note">Saved on this device. Ranks celebrate practice, not school grades.</small></section>';
}
function promotion(ranks){const latest=ranks?.at(-1);if(!latest)return "";return '<section class="study-rank-promotion" role="status" aria-label="New ABVM rank earned"><span class="promotion-eyebrow">NEW RANK UNLOCKED</span>'+image(latest,150)+'<h3>'+esc(latest.title)+'</h3><p>'+esc(ranks.length>1?ranks.length+' new ranks earned this round!':'You earned your next ABVM rank!')+'</p><button type="button" data-open-badges>Explore your rank ladder <span aria-hidden="true">›</span></button></section>'}
function sync(c){const changed=JSON.stringify(saved)!==JSON.stringify(c);saved=c;if(!changed)return c;document.querySelectorAll('[data-badge-surface]').forEach(host=>{host.innerHTML=render(c,host.dataset.badgeSurface)});return c}
function surface(kind){return '<div class="study-badge-surface" data-badge-surface="'+kind+'">'+render(saved,kind)+'</div>'}
function mount(root,kind,load){const anchor=kind==='today'?(root.querySelector('.today-updates-card')||root.querySelector('.today-panel')):root.querySelector(kind==='collection'?'.family-hero':'.study-tools');if(!anchor)return;anchor.insertAdjacentHTML(kind==='collection'||kind==='today'?'afterend':'beforebegin',surface(kind));refresh(load)}
function refresh(load){if(pending)return pending;pending=Promise.resolve().then(load).then(sync).catch(()=>{saved=null;document.querySelectorAll('[data-badge-surface]').forEach(host=>{host.innerHTML='<p class="badge-storage-error" role="status">Your stars could not be loaded. Practice is still available.</p>'})}).finally(()=>{pending=null});return pending}
window.ABVMStudyBadges=Object.freeze({render,promotion,surface,mount,refresh,sync,snapshot:()=>saved});
})();
