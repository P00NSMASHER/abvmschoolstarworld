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
    escape(lesson.studiedOn || lesson.dateStatus || "Saved schoolwork") +
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
  host.innerHTML = '<p role="status">Opening your study collection…</p>';
  let schoolwork, archive, religion;
  try {
    [schoolwork, archive, religion] = await Promise.all([
      resource("schoolwork.json"),
      resource("study-archive.json"),
      resource("religion-sources.json"),
    ]);
  } catch {
    if (host.isConnected) {
      host.innerHTML =
        '<p role="status">Your study collection could not load. Check your connection and try again.</p><button type="button" data-retry>Try again</button>';
      host.querySelector("[data-retry]").onclick = () =>
        mountStudyHub(host, { pack, catalog, events, engine, now });
    }
    return;
  }
  if (!host.isConnected) return;
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
        l.studiedOn && l.studiedOn >= bounds.start &&
        l.studiedOn <= bounds.end,
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
  const official = () => {
    const listed =
      (pack.subjects || []).find((s) => s.subject === "Religion")?.topics || [];
    const chapter = Number(
      listed.join(" ").match(/Chapter\s+(\d+)/i)?.[1] || 2,
    );
    const chapters = Array.isArray(religion.chapters)
      ? religion.chapters
      : Object.values(religion.chapters || {});
    const verified = chapters.filter(
      (c) => c.available && c.status === "verified",
    );
    if (!verified.length)
      return '<section class="hub-faith"><h3>Religion review</h3><p>The publisher review is not currently verified. Your saved Religion notes and practice remain available.</p></section>';
    const primary =
      verified.find((c) => c.chapter === chapter) ||
      verified.find((c) => c.chapter === 2) ||
      verified[0];
    return (
      '<section class="hub-faith"><p class="hub-eyebrow">RELIGION · START HERE</p><h3>Christ Our Life chapter review</h3><p>The publisher’s questions are the first choice for Religion. Your uploaded pages cover Chapter 2.</p><a class="hub-primary" href="https://isr.christourlife.com/col_g2_s' +
      primary.chapter +
      '" target="_blank" rel="noopener">Open Chapter ' +
      primary.chapter +
      " questions ↗</a>" +
      (verified.length
        ? "<details><summary>Other verified chapters</summary>" +
          verified
            .map(
              (c) =>
                '<a class="hub-chapter" target="_blank" rel="noopener" href="https://isr.christourlife.com/col_g2_s' +
                Number(c.chapter || c.number) +
                '">Chapter ' +
                Number(c.chapter || c.number) +
                "</a>",
            )
            .join("") +
          "</details>"
        : "") +
      '<button type="button" data-chapter-two>Practice the uploaded Chapter 2 pages</button><small>' +
      (primary.stale ? "Publisher availability needs rechecking. " : "") +
      "Opens the publisher’s review. In-app questions use your schoolwork; publisher scores stay on that site.</small></section>"
    );
  };
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
    const groups = tests.map((t) =>
      questionsForTest(t, unique([...weekly(), ...cumulative(), ...star])),
    );
    const missing = tests.filter((t, i) => !groups[i].length);
    let content = "";
    if (round) content = renderRound();
    else if (tab === "weekly") {
      content =
        '<section class="hub-card"><p class="hub-eyebrow">TEST PREP</p><h3>' +
        (tests.length ? escape(tests[0].date) : "Room to keep learning") +
        "</h3>" +
        (tests.length
          ? "<ul>" +
            tests.map((t) => "<li>" + escape(t.label) + "</li>").join("") +
            "</ul><p>Practice is shared equally across tests on this date.</p>" +
            (missing.length
              ? '<p class="hub-caption">More verified material is needed for: ' +
                missing.map((t) => escape(t.label)).join(", ") +
                ". Use the teacher notes below.</p>"
              : '<button class="hub-primary" data-test>Practice for ' +
                (tests.length > 1 ? "these tests" : "this test") +
                "</button>") +
            "<small>Date-only tests stay here through the school day. Mark them finished when they are over.</small><button data-complete-test>These tests are finished</button>"
          : "<p>No upcoming test is listed. Explore your current school skills below.</p>") +
        "</section>" +
        official() +
        '<details class="hub-card"><summary>Dated schoolwork this week</summary><p class="hub-caption">' +
        bounds.start +
        " through " +
        bounds.end +
        ". Undated pages stay in Cumulative until their lesson date is known.</p>" +
        allLessons()
          .filter(
            (l) =>
              l.studiedOn && l.studiedOn >= bounds.start &&
              l.studiedOn <= bounds.end,
          )
          .map(lessonHtml)
          .join("") +
        "</details>";
    } else if (tab === "cumulative") {
      const a = visibleArchive(archive, now());
      content =
        '<section class="hub-card"><p class="hub-eyebrow">YOUR GROWING COLLECTION</p><h3>Everything learned, kept together</h3><p>' +
        cumulative().length +
        " questions · " +
        schoolwork.uploadedPhotoCount +
        ' schoolwork photos reviewed</p><p class="hub-caption">Includes recoverable study material from the app’s history. Undated worksheets remain available without guessing when they were taught.</p><button class="hub-primary" data-practice="cumulative">Practice the collection</button></section>' +
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
        '<section class="hub-card hub-star"><p class="hub-eyebrow">CONFIDENCE THROUGH PRACTICE</p><h3>Math & reading, a little every day</h3><p>' +
        star.length +
        ' original Grade 2 questions with hints and explanations.</p><div class="hub-actions"><button class="hub-primary" data-star="Math">Practice math</button><button class="hub-primary" data-star="Reading / ELA">Practice reading</button><button data-practice="star">Mix math & reading</button></div><small>STAR-style skill practice. These are not official STAR test questions and do not predict a STAR score.</small></section><div class="hub-card"><h3>Skills to explore</h3><p>Number sense, operations, shapes, measurement, time, money and data. Reading clues, vocabulary, phonics, sequence and comprehension.</p></div>';
    } else {
      content =
        '<section class="hub-card"><p class="hub-eyebrow">MAKE IT YOURS</p><h3>Choose what to play</h3><fieldset><legend>Study material</legend>' +
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
        '>Question Quest</label><label class="hub-choice"><input type="radio" name="hub-format" value="cards" ' +
        (format === "cards" ? "checked" : "") +
        '>Flip & Learn</label></fieldset><p>Selected sections get equal turns. Questions do not repeat within a round.</p><button class="hub-primary" data-play ' +
        (!picks.size ? "disabled" : "") +
        '>Let’s play</button></section><a href="#games" class="hub-chapter">More subject games →</a>';
    }
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
    host.querySelector("[data-chapter-two]")?.addEventListener("click", () => {
      format = "quiz";
      start(
        [schoolwork.lessons.find((l) => l.chapter === 2)?.questions || []],
        "Chapter 2",
      );
    });
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
  const savedDone = getSaved("abvm-completed-tests", []),
    done = Array.isArray(savedDone) ? savedDone : [];
  events = events.filter((t) => !done.includes(t.date + "|" + t.label));
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
