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
test('October 16 partial long-o test never reuses last week short-i/a bank', () => {
  const pool = [
    {id:'old-i',subject:'Spelling / Handwriting',skill:'short-i-long-i',sourceFact:'Short i / long i'},
    {id:'old-a',subject:'Spelling / Handwriting',skill:'long-short-a',sourceFact:'Short a / long a'},
    {id:'current-o',subject:'Spelling / Handwriting',skill:'long-o',sourceFact:'Original Grade 2 long o practice'},
    {id:'unconfirmed-short-o',subject:'Spelling / Handwriting',skill:'long-short-o',sourceFact:'Short o sound'},
  ];
  assert.deepEqual(
    questionsForTest({label:'Spelling (long o / Short ) / Handwriting',date:'2026-10-16'},pool).map(q=>q.id),
    ['current-o','unconfirmed-short-o'].filter(x=>x==='current-o'),
  );
  assert.deepEqual(
    questionsForTest({label:'Spelling (short i / long i)'},pool).map(q=>q.id),
    ['old-i'],
  );
});

test('Phonics short-vowel and Math subtraction tests do not absorb unrelated skills', () => {
  const pool = [
    {id:'vowels',subject:'Reading / ELA',skill:'short-vowels'},
    {id:'grammar',subject:'Reading / ELA',skill:'subject-predicate'},
    {id:'addition',subject:'Math',skill:'math-addition'},
    {id:'subtraction',subject:'Math',skill:'math-subtraction'},
  ];
  assert.deepEqual(questionsForTest({label:'Phonics (short vowels)'},pool).map(q=>q.id),['vowels']);
  assert.deepEqual(questionsForTest({label:'Math (subtraction)'},pool).map(q=>q.id),['subtraction']);
  assert.deepEqual(questionsForTest({label:'Math'},pool).map(q=>q.id),['addition','subtraction']);
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
    { id: "chapter2-cross-reference", subject: "Religion", skill: "religion-future",
      sourceLineage:{matchedEvidence:["Chapter 2: preview Chapter 3: Baptism later"]} },
    { id: "prose-reference", subject: "Religion", skill: "religion-future",
      sourceLineage:{matchedEvidence:["Review note may refer to Chapter 3: without a chapter header"]} },
    { id: "chapter30", subject: "Religion", skill: "religion-future",
      sourceLineage:{matchedEvidence:["Chapter 30: unrelated lesson"]} },
    { id: "safe-runtime-encoded", subject: "Religion", skill: "religion-baptism-grace",
      sourceChapters:[3] },
  ];
  for (const label of ["Religion Ch. 3", "Religion Chapter 3"]) {
    assert.deepEqual(
      questionsForTest({ label }, questions).map((q) => q.id),
      ["chapter3-synthetic", "chapter3-exact", "safe-runtime-encoded"],
    );
  }
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

test('named reading text sets accept only verified exact-scope questions',()=>{
  const pool=[
    {id:'general-reading',subject:'Reading / ELA',skill:'main-idea-details'},
    {id:'phonics',subject:'Reading / ELA',skill:'long-i-i-e-and-short-i'},
    {id:'text3',subject:'Reading / ELA',skill:'main-idea-details',sourceTestScopes:['Unit 1 Text Set 3']},
    {id:'text30',subject:'Reading / ELA',skill:'reading-charts',sourceTestScopes:['Unit 1 Text Set 30']},
    {id:'text4',subject:'Reading / ELA',skill:'reading-charts',sourceTestScopes:['Unit 1 Text Set 4']},
  ];
  assert.deepEqual(questionsForTest({label:'Reading (Unit 1 Text Set 3)'},pool).map(q=>q.id),['text3']);
  assert.deepEqual(questionsForTest({label:'Reading (Unit 2 Text Set 3)'},pool),[]);
  assert.equal(questionsForTest({label:'Reading (Unit 1 Text Set 3)'},pool.slice(0,2)).length,0);
});

test('specific common/proper-noun exam excludes unrelated grammar and fails closed',()=>{
  const pool=[
    {id:'nouns',subject:'Reading / ELA',skill:'common-proper-nouns'},
    {id:'predicate',subject:'Reading / ELA',skill:'subject-predicate'},
    {id:'sentences',subject:'Reading / ELA',skill:'sentence-types'},
    {id:'spelling',subject:'Spelling / Handwriting',skill:'long-short-a'},
  ];
  assert.deepEqual(questionsForTest({label:'Grammar (common & proper nouns)',date:'2026-10-29'},pool).map(q=>q.id),['nouns']);
  assert.deepEqual(questionsForTest({label:'Grammar (common and proper nouns)'},pool).map(q=>q.id),['nouns']);
  assert.deepEqual(questionsForTest({label:'Grammar (common & proper nouns)'},pool.slice(1)),[],
    'unavailable noun lessons must not be replaced with a subject/predicate exercise');
});
