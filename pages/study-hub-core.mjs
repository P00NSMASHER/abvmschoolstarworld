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
    const date = /^\d{4}-\d{2}-\d{2}$/.test(test.date || '') ? test.date : null;
    return questions
      .filter(
        (q) =>
          /Spelling|phonics/i.test(q.subject) ||
          /long-short|short-i-long-i|consonant-blend|suffix/.test(q.skill),
      )
      .filter((q) => {
        // A photo-confirmed weekly list stays bound to its own dated test.
        // The extra long-a and high-frequency homework words are not erased
        // just because the teacher's Test page mentions short-i / long-i.
        const scoped = String(q.sourceFact || '').match(/^Photo-confirmed weekly spelling words for (\d{4}-\d{2}-\d{2})$/);
        if (scoped) return date === scoped[1];
        return !focus || focus.test(q.skill + ' ' + q.sourceFact + ' ' + q.prompt);
      });
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
