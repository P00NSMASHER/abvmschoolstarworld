import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
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
