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
  const route = (tab, label, klass = "text-button") =>
    '<button class="' +
    klass +
    '" type="button" data-route="' +
    tab +
    '">' +
    esc(label) +
    icon("arrow") +
    "</button>";
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
      '</p><h2>Hi, Emma!</h2><p>Your school day, all together.</p></div><img class="hero-photo" src="./assets/school/abvm-school-hero.webp" width="1024" height="683" fetchpriority="high" alt="Assumption BVM School in Pottsville"><span class="photo-caption">OUR ABVM</span><img class="today-school-seal" src="./assets/abvm-app-icon-192.png" width="48" height="48" alt="Assumption BVM Catholic School logo"></section>' +
      '<div class="today-primary">' +
      '<button class="study-invitation" type="button" data-route="study"><img src="./assets/illustrations/reading.webp" width="72" height="72" alt=""><span><strong>Start studying</strong><small>A little practice. A little more confidence.</small></span>' +
      icon("arrow") +
      "</button>" + nextHtml + "</div>" +
      lunchHtml +
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
      (reminders.length
        ? '<section class="today-updates-card">' +
          sectionHead("Worth remembering", route("family", "All updates")) +
          reminders
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
      overview +
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
      "</div><h3>Homework & routines</h3>" +
      (tasks.length
        ? tasks.map(({ item, index }) => taskHtml(item, index)).join("")
        : '<p class="week-empty">No checklist is verified for this week yet.</p>') +
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
  window.ABVMProductView = Object.freeze({ today, week, progress, icon });
})();
