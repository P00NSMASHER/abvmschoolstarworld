import test from "node:test";
import assert from "node:assert/strict";
import { buildStarBank } from "../pages/star-practice.mjs";
const bank = buildStarBank();
test("original bank covers math and reading with unique complete items", () => {
  assert.ok(bank.length >= 150);
  assert.ok(bank.filter((q) => q.subject === "Reading / ELA").length >= 50);
  assert.equal(new Set(bank.map((q) => q.id)).size, bank.length);
  assert.equal(new Set(bank.map((q) => q.prompt)).size, bank.length);
  const positions = [0, 0, 0, 0];
  for (const q of bank) {
    assert.equal(q.choices.length, 4, q.id);
    assert.equal(new Set(q.choices).size, 4, q.id);
    assert.equal(q.choices.filter((c) => c === q.answer).length, 1, q.id);
    assert.ok(q.explanation && q.hint && q.skill, q.id);
    assert.equal(q.sourceFact, "Original Grade 2 STAR-style practice");
    positions[q.choices.indexOf(q.answer)]++;
  }
  assert.ok(Math.max(...positions) - Math.min(...positions) <= 1);
});
test("all generated arithmetic and place-value answer keys are correct", () => {
  for (const q of bank) {
    if (q.skill === "Addition" || q.skill === "Subtraction") {
      const [, a, op, b] = q.prompt.match(/What is (\d+) ([+−]) (\d+)/);
      assert.equal(
        Number(q.answer),
        op === "+" ? Number(a) + Number(b) : Number(a) - Number(b),
      );
    }
    if (q.skill === "Place value") {
      const [, digit, n] = q.prompt.match(/digit (\d) in (\d+)/);
      assert.equal(Number(digit), Math.floor(Number(n) / 10) % 10);
      assert.equal(Number(q.answer), Number(digit) * 10);
    }
    if (q.skill === "Data") {
      const [, cats, dogs, birds] = q.prompt
        .match(/cats (\d+), dogs (\d+), birds (\d+)/)
        .map(Number);
      assert.equal(
        Number(q.answer),
        q.prompt.includes("altogether") ? cats + dogs + birds : cats - dogs,
      );
    }
  }
});
test("passage questions retain source passage and varied reading skills", () => {
  const reading = bank.filter((q) => q.subject === "Reading / ELA");
  assert.equal(
    reading.filter((q) => q.prompt.startsWith("Read the passage:")).length,
    40,
  );
  for (const skill of [
    "Main idea",
    "Inference",
    "Evidence",
    "Vocabulary",
    "Sequence",
    "Phonics",
    "Context clues",
  ])
    assert.ok(
      reading.some((q) => q.skill === skill),
      skill,
    );
  for (const skill of ["Time", "Money", "Geometry", "Measurement", "Data"])
    assert.ok(
      bank.some((q) => q.skill === skill),
      skill,
    );
  assert.deepEqual(buildStarBank(), bank);
});
