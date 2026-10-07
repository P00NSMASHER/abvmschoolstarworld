/** Match practice to an announced test without inventing scope or altering sources. */
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
