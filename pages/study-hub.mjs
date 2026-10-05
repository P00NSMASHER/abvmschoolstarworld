import {
  schoolDay,
  weekBounds,
  nextTests,
  balancedRound,
  balancedTestRound,
  visibleArchive,
  weeklyArchive,
} from "./study-model.mjs";
import { buildStarBank } from "./star-practice.mjs";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const unique = (rows) => [
  ...new Map(rows.map((q) => [q.prompt + "|" + q.answer, q])).values(),
];
const safeQuestion = (q) =>
  q &&
  typeof q.prompt === "string" &&
  Array.isArray(q.choices) &&
  q.choices.length > 1 &&
  q.choices.every((x) => typeof x === "string") &&
  new Set(q.choices).size === q.choices.length &&
  q.choices.includes(q.answer);
const names = {
  weekly: "This week",
  cumulative: "Cumulative",
  star: "STAR practice",
  games: "Study games",
};
const resourceCache = new Map();
async function resource(name) {
  if (!resourceCache.has(name))
    resourceCache.set(
      name,
      fetch("./data/" + name)
        .then((r) => {
          if (!r.ok) throw Error("Study materials could not load.");
          return r.json();
        })
        .catch((e) => {
          resourceCache.delete(name);
          throw e;
        }),
    );
  return resourceCache.get(name);
}
export function questionsForTest(test, questions) {
  const label = test.label.toLowerCase();
  if (/grammar|predicate|subject &/.test(label))
    return questions.filter((q) => q.skill === "subject-predicate");
  if (/spelling|handwriting/.test(label)) {
    const vowel = label.match(/short\s+([aeiou])/);
    const focus = vowel
      ? new RegExp("(?:long|short)[ -]" + vowel[1] + "|" + vowel[1] + "_e", "i")
      : null;
    return questions
      .filter(
        (q) =>
          /Spelling|phonics/i.test(q.subject) ||
          /long-short|consonant-blend|suffix/.test(q.skill),
      )
      .filter(
        (q) =>
          !focus || focus.test(q.skill + " " + q.sourceFact + " " + q.prompt),
      );
  }
  if (/religion|faith/.test(label)) {
    const c = label.match(/chapter\s*(\d+)/);
    return questions.filter(
      (q) =>
        q.subject === "Religion" &&
        (!c || q.skill === "religion-chapter-" + c[1]),
    );
  }
  if (/math/.test(label)) return questions.filter((q) => q.subject === "Math");
  if (/reading|ela/.test(label))
    return questions.filter(
      (q) =>
        q.subject === "Reading / ELA" &&
        !/subject-predicate|sentence-types|long-short|possessive/.test(q.skill),
    );
  return [];
}
function getSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
function lessonHtml(lesson) {
  return (
    '<details class="hub-lesson"><summary>' +
    escape(lesson.title) +
    '</summary><p class="hub-caption">' +
    escape(lesson.subject) +
    " · " +
    escape(
      lesson.studiedOn
        ? new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(lesson.studiedOn + "T12:00:00Z"))
        : "Saved schoolwork",
    ) +
    "</p><ul>" +
    (lesson.notes || []).map((n) => "<li>" + escape(n) + "</li>").join("") +
    "</ul></details>"
  );
}
export async function mountStudyHub(
  host,
  { pack, catalog, events, engine, now = () => Date.now() } = {},
) {
  if (!host.isConnected) return;
  if (!document.querySelector("link[data-study-hub]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./study-hub.css";
    link.dataset.studyHub = "true";
    document.head.append(link);
  }
  events = Array.isArray(events) ? events : [];
  const savedDone = getSaved("abvm-completed-tests", []),
    done = Array.isArray(savedDone) ? savedDone : [];
  events = events.filter((t) => !done.includes(t.date + "|" + t.label));
  const loadingTests = nextTests(events, now());
  const loadingDate = loadingTests.length
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(loadingTests[0].date + "T12:00:00Z"))
    : "";
  host.dataset.studyState = "loading";
  host.innerHTML =
    '<div class="study-hub hub-loading" aria-busy="true"><nav class="hub-tabs hub-tabs-loading" aria-label="Study sections">' +
    Object.values(names).map((n) => '<span>' + escape(n) + '</span>').join("") +
    '</nav><div class="hub-content"><section class="hub-card hub-prep"><div class="hub-prep-heading"><span class="hub-symbol" aria-hidden="true">✦</span><p class="hub-eyebrow">' +
    (loadingTests.length ? "NEXT TEST" + (loadingTests.length > 1 ? "S" : "") : "THIS WEEK") +
    '</p></div>' +
    (loadingTests.length
      ? '<time class="hub-date" datetime="' + escape(loadingTests[0].date) + '">' + escape(loadingDate) + '</time><h3>' +
        loadingTests.map((t) => escape(t.label)).join('<span class="hub-test-divider"> & </span>') +
        '</h3><p class="hub-prep-description">' +
        (loadingTests.length > 1 ? "A little practice for each subject, shared equally." : "A short practice round to feel ready.") +
        '</p>'
      : '<h3>Small steps. Big discoveries.</h3><p>No upcoming test is listed. Your weekly lessons are ready below.</p>') +
    '<div class="hub-prep-actions hub-loading-action"><p role="status">Opening your study collection…</p></div></section></div></div>';
  let schoolwork, archive;
  try {
    [schoolwork, archive] = await Promise.all([
      resource("schoolwork.json"),
      resource("study-archive.json"),
    ]);
  } catch {
    if (host.isConnected) {
      host.dataset.studyState = "error";
      host.innerHTML =
        '<div class="study-hub"><section class="hub-card hub-error"><p class="hub-eyebrow">STUDY COLLECTION</p><h3>Couldn’t open the full collection</h3><p role="status">Your current subject notes are still below. Check your connection and try again when you’re ready.</p><button class="hub-primary" type="button" data-retry>Try again</button></section></div>';
      host.querySelector("[data-retry]").onclick = () =>
        mountStudyHub(host, { pack, catalog, events, engine, now });
    }
    return;
  }
  if (!host.isConnected) return;
  // The publisher belongs beside its subject notes, not in the weekly hero.
  resource("religion-sources.json")
    .then((religion) => {
      if (!host.isConnected) return;
      const subject = host.parentElement.querySelector("#study-religion");
      if (!subject || subject.querySelector("[data-religion-review]")) return;
      const topics =
        (pack.subjects || []).find((s) => s.subject === "Religion")?.topics ||
        [];
      const chapter = Number(topics.join(" ").match(/Chapter\s+(\d+)/i)?.[1]);
      const chapters = Array.isArray(religion.chapters)
        ? religion.chapters
        : Object.values(religion.chapters || {});
      const verified = chapters.find(
        (c) => c.chapter === chapter && c.available && c.status === "verified",
      );
      if (!verified) return;
      const footer = document.createElement("div");
      footer.dataset.religionReview = "true";
      footer.innerHTML =
        '<a href="' +
        escape(verified.url) +
        '" target="_blank" rel="noopener">Chapter ' +
        chapter +
        ' online review <span aria-hidden="true">↗</span></a>';
      subject.append(footer);
    })
    .catch(() => {
      /* Subject notes remain usable offline. */
    });
  let tab = "weekly",
    round = null,
    index = 0,
    revealed = false,
    selected = null,
    hinted = false,
    score = 0,
    format = "quiz";
  let picks = new Set(["weekly"]);
  const star = unique([
    ...(catalog.questions || []).filter((q) => q.tier === "star-fallback"),
    ...buildStarBank().map((q) => ({
      ...q,
      skill:
        {
          Addition: "addition-within-100",
          Subtraction: "subtraction-within-100",
          "Place value": "place-value",
          "Compare numbers": "compare-numbers",
          Time: "time",
          Measurement: "measurement",
          Data: "data-interpretation",
          Inference: "inference",
          Evidence: "text-evidence",
          Purpose: "author-purpose",
          "Cause and effect": "cause-effect",
          Vocabulary: "vocabulary-in-context",
        }[q.skill] || q.skill.toLowerCase().replace(/ /g, "-"),
    })),
  ]).filter(safeQuestion);
  const current = () =>
    unique(
      (catalog.questions || []).filter((q) => q.tier === "material"),
    ).filter(safeQuestion);
  const allLessons = () =>
    schoolwork.lessons.filter(
      (l) => !l.studiedOn || l.studiedOn <= schoolDay(now()),
    );
  const cumulative = () =>
    unique([
      ...visibleArchive(archive, now()).questions,
      ...allLessons().flatMap((l) => l.questions || []),
      ...current(),
    ]).filter(safeQuestion);
  const weekly = () => {
    const bounds = weekBounds(now());
    const added = allLessons().filter(
      (l) =>
        l.studiedOn && l.studiedOn >= bounds.start && l.studiedOn <= bounds.end,
    );
    return unique([
      ...current(),
      ...weeklyArchive(archive, now()).questions,
      ...added.flatMap((l) => l.questions || []),
    ]).filter(safeQuestion);
  };
  const bank = (source) =>
    source === "star"
      ? star
      : source === "cumulative"
        ? cumulative()
        : weekly();
  function start(groups, title, strict = false) {
    const oldSeed = Number(getSaved("abvm-hub-round", 0));
    const seed = String((Number.isFinite(oldSeed) ? oldSeed : 0) + 1);
    save("abvm-hub-round", Number(seed));
    round = {
      questions: (strict ? balancedTestRound : balancedRound)(
        groups,
        Math.max(8, groups.length * 4),
        seed,
      ),
      title,
    };
    index = 0;
    revealed = false;
    selected = null;
    hinted = false;
    score = 0;
    render();
    host.querySelector("h3")?.focus();
  }
  function renderRound() {
    if (!round.questions.length)
      return '<div class="hub-card"><h3>No verified questions match yet</h3><p>The study guide is still available. Add schoolwork to expand practice.</p><button data-end>Back to study</button></div>';
    if (index >= round.questions.length)
      return (
        '<section class="hub-card hub-finish"><p class="hub-eyebrow">ROUND COMPLETE</p><h3 tabindex="-1">A little stronger, one question at a time.</h3><p>' +
        (format === "quiz"
          ? score +
            " of " +
            round.questions.length +
            " correct on the first try."
          : round.questions.length + " cards explored.") +
        '</p><p>Keep practicing at your own pace. No timer.</p><button class="hub-primary" data-end>Back to study</button></section>'
      );
    const q = round.questions[index];
    return (
      '<section class="hub-card hub-round"><div class="hub-row"><span>' +
      escape(round.title) +
      '</span><button data-end aria-label="Close practice">Close</button></div><progress max="' +
      round.questions.length +
      '" value="' +
      index +
      '" aria-label="Round progress"></progress><p class="hub-caption">' +
      (index + 1) +
      " of " +
      round.questions.length +
      " · " +
      escape(q.subject) +
      '</p><h3 tabindex="-1">' +
      escape(q.prompt) +
      "</h3>" +
      (format === "quiz"
        ? '<div class="hub-answers">' +
          q.choices
            .map(
              (a, i) =>
                '<button data-answer="' +
                i +
                '" ' +
                (revealed ? "disabled" : "") +
                ' class="' +
                (revealed && a === q.answer
                  ? "hub-correct"
                  : revealed && i === selected
                    ? "hub-incorrect"
                    : "") +
                '">' +
                escape(a) +
                "</button>",
            )
            .join("") +
          "</div>"
        : '<button class="hub-primary" data-reveal>Turn card over</button>') +
      (!revealed
        ? "<button data-hint>Show a hint</button>" +
          (hinted
            ? "<p>" +
              escape(
                q.hint || "Think through the example one step at a time.",
              ) +
              "</p>"
            : "")
        : '<div class="hub-feedback" role="status"><strong>' +
          escape(q.answer) +
          "</strong><p>" +
          escape(q.explanation) +
          '</p></div><button class="hub-primary" data-next>' +
          (index + 1 === round.questions.length
            ? "Finish round"
            : "Next question") +
          "</button>") +
      "</section>"
    );
  }
  function render() {
    if (!host.isConnected) return;
    const old = host.parentElement.querySelector("[data-study-legacy]");
    if (old) old.hidden = tab !== "weekly" || !!round;
    const bounds = weekBounds(now()),
      tests = nextTests(events, now());
    const groups = tests.map((t) => {
      // Current class material leads. Only an explicit chapter/grammar focus
      // makes undated matching worksheets relevant to this test.
      const focused = /chapter\s*\d+|grammar|predicate/i.test(t.label)
        ? allLessons().flatMap((l) => l.questions || [])
        : [];
      const primary = questionsForTest(t, unique([...weekly(), ...focused]));
      return primary.length ? primary : questionsForTest(t, star);
    });
    const missing = tests.filter((t, i) => !groups[i].length);
    let content = "";
    if (round) content = renderRound();
    else if (tab === "weekly") {
      const dated = allLessons().filter(
        (l) =>
          l.studiedOn &&
          l.studiedOn >= bounds.start &&
          l.studiedOn <= bounds.end,
      );
      const dateLabel = tests.length
        ? new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(tests[0].date + "T12:00:00Z"))
        : "";
      content =
        '<section class="hub-card hub-prep"><div class="hub-prep-heading"><span class="hub-symbol" aria-hidden="true">✦</span><p class="hub-eyebrow">' +
        (tests.length
          ? "NEXT TEST" + (tests.length > 1 ? "S" : "")
          : "THIS WEEK") +
        "</p></div>" +
        (tests.length
          ? '<time class="hub-date" datetime="' +
            escape(tests[0].date) +
            '">' +
            escape(dateLabel) +
            "</time><h3>" +
            tests
              .map((t) => escape(t.label))
              .join('<span class="hub-test-divider"> & </span>') +
            '</h3><p class="hub-prep-description">' +
            (tests.length > 1
              ? "A little practice for each subject, shared equally."
              : "A short practice round to feel ready.") +
            "</p>" +
            '<div class="hub-prep-actions">' +
            (missing.length
              ? '<p class="hub-caption">Review the teacher notes below for ' +
                missing.map((t) => escape(t.label)).join(", ") +
                ".</p>"
              : '<button class="hub-primary" data-test>Start test practice <span aria-hidden="true">→</span></button>') +
            '<button class="hub-text-button" data-complete-test>' +
            (tests.length > 1
              ? "Mark these tests finished"
              : "Mark test finished") +
            "</button></div>"
          : "<h3>Small steps. Big discoveries.</h3><p>No upcoming test is listed. Your weekly lessons are ready below.</p>") +
        "</section>" +
        (dated.length
          ? '<details class="hub-card"><summary>This week’s schoolwork <span class="hub-count">' +
            dated.length +
            "</span></summary>" +
            dated.map(lessonHtml).join("") +
            "</details>"
          : "");
    } else if (tab === "cumulative") {
      const a = visibleArchive(archive, now());
      content =
        '<section class="hub-card hub-collection"><p class="hub-eyebrow">YOUR GROWING COLLECTION</p><h3>Everything learned, kept together</h3><p>' +
        cumulative().length +
        " questions · " +
        schoolwork.uploadedPhotoCount +
        ' schoolwork photos reviewed</p><p class="hub-caption">Revisit favorite lessons and keep earlier skills fresh.</p><button class="hub-primary" data-practice="cumulative">Practice the collection</button></section>' +
        allLessons().map(lessonHtml).join("") +
        [...new Set(a.notes.map((n) => n.subject))]
          .map(
            (s) =>
              '<details class="hub-lesson"><summary>' +
              escape(s) +
              " · earlier study notes</summary><ul>" +
              a.notes
                .filter((n) => n.subject === s)
                .map((n) => "<li>" + escape(n.text) + "</li>")
                .join("") +
              "</ul></details>",
          )
          .join("") +
        (a.vocabulary.length
          ? '<details class="hub-lesson"><summary>Vocabulary collection</summary><ul>' +
            a.vocabulary
              .map(
                (v) =>
                  "<li><strong>" +
                  escape(v.term) +
                  "</strong> " +
                  escape(v.meaning || v.definition || "") +
                  "</li>",
              )
              .join("") +
            "</ul></details>"
          : "");
    } else if (tab === "star") {
      content =
        '<section class="hub-card hub-star"><p class="hub-eyebrow">CONFIDENCE THROUGH PRACTICE</p><h3>A little practice. A lot of confidence.</h3><p>' +
        star.length +
        ' original Grade 2 questions with hints and explanations.</p><div class="hub-actions"><button class="hub-subject-button hub-math" data-star="Math"><span aria-hidden="true">＋</span>Practice math</button><button class="hub-subject-button hub-reading" data-star="Reading / ELA"><span aria-hidden="true">Aa</span>Practice reading</button><button data-practice="star">Mix math & reading</button></div><small>STAR-style skill practice. These are not official STAR test questions and do not predict a STAR score.</small></section><div class="hub-card"><h3>Skills to explore</h3><p>Number sense, operations, shapes, measurement, time, money and data. Reading clues, vocabulary, phonics, sequence and comprehension.</p></div>';
    } else {
      content =
        '<section class="hub-card hub-games"><p class="hub-eyebrow">MAKE IT YOURS</p><h3>Choose what to play</h3><fieldset><legend>Study material</legend>' +
        ["weekly", "cumulative", "star"]
          .map(
            (k) =>
              '<label class="hub-choice"><input type="checkbox" data-pick="' +
              k +
              '" ' +
              (picks.has(k) ? "checked" : "") +
              "><span>" +
              names[k] +
              "</span></label>",
          )
          .join("") +
        '</fieldset><fieldset><legend>How to practice</legend><label class="hub-choice"><input type="radio" name="hub-format" value="quiz" ' +
        (format === "quiz" ? "checked" : "") +
        '>Quick quiz</label><label class="hub-choice"><input type="radio" name="hub-format" value="cards" ' +
        (format === "cards" ? "checked" : "") +
        '>Flip cards</label></fieldset><p>Selected sections get equal turns. Questions do not repeat within a round.</p><button class="hub-primary" data-play ' +
        (!picks.size ? "disabled" : "") +
        '>Let’s play</button></section><a href="#games" class="hub-chapter">More subject games →</a>';
    }
    host.dataset.studyState = "ready";
    host.innerHTML =
      '<div class="study-hub"><nav class="hub-tabs" aria-label="Study sections">' +
      Object.entries(names)
        .map(
          ([k, n]) =>
            '<button data-tab="' +
            k +
            '" aria-pressed="' +
            (tab === k) +
            '">' +
            n +
            "</button>",
        )
        .join("") +
      '</nav><div class="hub-content">' +
      content +
      "</div></div>";
    host.querySelectorAll("[data-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          tab = b.dataset.tab;
          round = null;
          render();
        }),
    );
    host.querySelectorAll("[data-practice]").forEach(
      (b) =>
        (b.onclick = () => {
          format = "quiz";
          const source = b.dataset.practice;
          start(
            source === "star"
              ? ["Math", "Reading / ELA"].map((s) =>
                  star.filter((q) => q.subject === s),
                )
              : [bank(source)],
            names[source],
          );
        }),
    );
    host.querySelectorAll("[data-star]").forEach(
      (b) =>
        (b.onclick = () => {
          format = "quiz";
          start(
            [star.filter((q) => q.subject === b.dataset.star)],
            b.textContent,
          );
        }),
    );
    host.querySelector("[data-test]")?.addEventListener("click", () => {
      format = "quiz";
      start(groups, "Test prep", true);
    });
    host
      .querySelector("[data-complete-test]")
      ?.addEventListener("click", () => {
        const savedDone = getSaved("abvm-completed-tests", []),
          done = Array.isArray(savedDone) ? savedDone : [];
        for (const t of tests) done.push(t.date + "|" + t.label);
        if (!save("abvm-completed-tests", [...new Set(done)]))
          return alert("Could not save on this device. Please try again.");
        events = events.filter((t) => !done.includes(t.date + "|" + t.label));
        render();
      });
    host.querySelectorAll("[data-pick]").forEach(
      (b) =>
        (b.onchange = () => {
          b.checked ? picks.add(b.dataset.pick) : picks.delete(b.dataset.pick);
          host.querySelector("[data-play]").disabled = !picks.size;
        }),
    );
    host.querySelectorAll('[name="hub-format"]').forEach(
      (b) =>
        (b.onchange = () => {
          format = b.value;
        }),
    );
    host
      .querySelector("[data-play]")
      ?.addEventListener("click", () =>
        start([...picks].map(bank), "Study mix"),
      );
    host.querySelector("[data-end]")?.addEventListener("click", () => {
      round = null;
      render();
    });
    host.querySelector("[data-hint]")?.addEventListener("click", () => {
      hinted = true;
      render();
    });
    host.querySelector("[data-reveal]")?.addEventListener("click", () => {
      revealed = true;
      render();
    });
    host.querySelectorAll("[data-answer]").forEach(
      (b) =>
        (b.onclick = () => {
          if (revealed) return;
          selected = Number(b.dataset.answer);
          revealed = true;
          const q = round.questions[index],
            correct = q.choices[selected] === q.answer;
          if (correct) score++;
          engine.recordLearning?.(q, correct, {
            attemptCount: 1,
            incorrectCount: correct ? 0 : 1,
            hintCount: hinted ? 1 : 0,
          });
          render();
        }),
    );
    host.querySelector("[data-next]")?.addEventListener("click", () => {
      index++;
      revealed = false;
      selected = null;
      hinted = false;
      render();
      host.querySelector(".hub-round h3,.hub-finish h3")?.focus();
    });
  }
  render();
  // Recompute date-dependent cards when returning from the publisher, and across midnight.
  let lastDay = schoolDay(now()),
    lastTests = JSON.stringify(nextTests(events, now()));
  const refresh = () => {
    if (!host.isConnected) {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
      return;
    }
    if (!round) {
      lastDay = schoolDay(now());
      lastTests = JSON.stringify(nextTests(events, now()));
      render();
    }
  };
  const timer = setInterval(() => {
    if (
      schoolDay(now()) !== lastDay ||
      JSON.stringify(nextTests(events, now())) !== lastTests
    )
      refresh();
  }, 60000);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) refresh();
    },
    {
      signal: (() => {
        const c = new AbortController();
        const observer = new MutationObserver(() => {
          if (!host.isConnected) {
            c.abort();
            observer.disconnect();
            clearInterval(timer);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return c.signal;
      })(),
    },
  );
}
