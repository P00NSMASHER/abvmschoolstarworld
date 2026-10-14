import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createStudyMaterials } from "../pages/study-materials.mjs";
import { questionsForTest } from "../pages/study-hub-core.mjs";
import { buildStarBank } from "../pages/star-practice.mjs";
import { balancedTestRound } from "../pages/study-model.mjs";
test("announced short-i spelling test does not receive short-a questions", () => {
  const bank = buildStarBank();
  const q = questionsForTest(
    { label: "Spelling (short i / long i) / Handwriting" },
    bank,
  );
  assert.equal(q.length, 8);
  assert(q.every((x) => x.skill === "long-short-i"));
});
test("Religion Ch. test stays bound to exact chapter evidence", () => {
  const questions = [
    { id: "chapter3-synthetic", subject: "Religion", skill: "religion-chapter-3" },
    {
      id: "chapter3-exact",
      subject: "Religion",
      skill: "religion-original-sin",
      sourceLineage: {
        matchedEvidence: ["Chapter 3: original sin, faith, sacraments, and Baptism"],
      },
    },
    {
      id: "chapter2-exact",
      subject: "Religion",
      skill: "religion-jesus-savior",
      sourceLineage: {
        matchedEvidence: ["Chapter 2: Jesus is God's Best Gift"],
      },
    },
    { id: "other-religion", subject: "Religion", skill: "religion-gifts-choices" },
  ];
  for (const label of ["Religion Ch. 3", "Religion Chapter 3"]) {
    assert.deepEqual(
      questionsForTest({ label }, questions).map((q) => q.id),
      ["chapter3-synthetic", "chapter3-exact"],
    );
  }
});

test("real browser catalog supports only source-backed Religion Chapter 3 questions", () => {
  const env = JSON.parse(fs.readFileSync(new URL("../pages/data/study-pack.json", import.meta.url)));
  const pack = env.pack || env;
  const context = { window: {}, localStorage: {getItem: () => null, setItem: () => {}} };
  for (const name of ["study-practice", "study-games"]) {
    vm.runInNewContext(
      fs.readFileSync(new URL("../pages/" + name + ".js", import.meta.url), "utf8"),
      context,
    );
  }
  const catalog = context.window.ABVMStudyGames.buildCatalog(pack, {sourceKey:pack.sourceHash});
  const approved = new Set((pack.contentPipeline?.questions || [])
    .filter(q => q.subject === "Religion" &&
      q.sourceLineage?.quality === "page-exact" &&
      q.sourceLineage.matchedEvidence?.some(value =>
        typeof value === "string" && /^\\s*Chapter\\s+3\\s*:/i.test(value)))
    .map(q => q.id));
  assert(approved.size >= 10, "governed Chapter 3 material must be present");
  const scoped = questionsForTest({label:"Religion Ch. 3"}, catalog.questions);
  assert(scoped.length > 0, "browser test must offer Chapter 3 questions");
  assert(scoped.every(q => approved.has(q.id) && q.reviewedChapters?.includes("3")),
    "no unrelated or unreviewed Religion content can enter the named test");
  const model = createStudyMaterials({
    pack, catalog, events:[{date:"2026-10-15",label:"Religion Ch. 3",kind:"test"}],
    now:() => Date.parse("2026-10-14T12:00:00-04:00"),
  });
  assert(model.tests().supported.some(row => row.label === "Religion Ch. 3" && row.count > 0),
    "the actual dated Study UI must offer the assessment");
  const round = model.testRound({index:0,seed:"religion-chapter-3"});
  assert(round.questions.length > 0, "the user must receive an answerable round");
  assert(round.questions.every(q => approved.has(q.id)),
    "test-round rotation must stay inside the governed Chapter 3 bank");
});

test("all uploaded schoolwork answers have one correct choice and safe source mapping", () => {
  const data = JSON.parse(
    fs.readFileSync(new URL("../pages/data/schoolwork.json", import.meta.url)),
  );
  assert.equal(data.sourceManifest.length, data.uploadedPhotoCount);
  assert(data.sourceManifest.length >= 20, 'existing evidence must not be lost');
  assert(data.lessons.length >= 12, 'existing reviewed lessons must not be lost');
  for (const l of data.lessons)
    for (const q of l.questions) {
      assert.equal(new Set(q.choices).size, q.choices.length);
      assert.equal(q.choices.filter((c) => c === q.answer).length, 1);
      assert(q.explanation);
      assert(q.prompt);
    }
  const chapter = data.lessons.find((l) => l.chapter === 2);
  assert.equal(chapter.questions.length, 10);
  const grammar = questionsForTest(
    { label: "Grammar (subject & predicate)" },
    data.lessons.flatMap((l) => l.questions),
  );
  assert.equal(grammar.length, 4);
  const spelling = questionsForTest(
    { label: "Spelling (short i / long i)" },
    buildStarBank(),
  );
  const round = balancedTestRound([grammar, spelling], 8, 7);
  assert.equal(round.length, 8);
  assert.equal(round.filter((q) => q.skill === "subject-predicate").length, 4);
});
test("schoolwork integration stays outside the child-facing app", () => {
  const source = fs.readFileSync(
    new URL("../pages/study-hub-core.mjs", import.meta.url),
    "utf8",
  );
  assert(!source.includes("mountImporter"));
  assert(!source.includes('type="file"'));
  assert(!source.includes("Tesseract"));
});
