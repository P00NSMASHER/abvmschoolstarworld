/** A chapter must be the heading of an individual reviewed evidence entry. */
export function religionChapterScopes(question) {
  if (question?.subject !== "Religion") return [];
  const scopes = new Set();
  const safe = question?.sourceChapters;
  if (Array.isArray(safe)) for (const chapter of safe) {
    if (Number.isInteger(chapter) && chapter >= 1 && chapter <= 99) scopes.add(chapter);
  }
  const evidence = question?.sourceLineage?.matchedEvidence;
  if (Array.isArray(evidence)) for (const entry of evidence) {
    if (typeof entry !== "string") continue;
    const match = /^\s*Chapter\s+([1-9]\d*)\s*:/i.exec(entry);
    if (match && Number(match[1]) <= 99) scopes.add(Number(match[1]));
  }
  return [...scopes].sort((a,b) => a-b);
}
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
    const chapter = label.match(/\b(?:chapter|ch\.?)\s*([1-9]\d*)\b/);
    return questions.filter(q => {
      if (q.subject !== "Religion") return false;
      if (!chapter) return true;
      const number = Number(chapter[1]);
      return q.skill === "religion-chapter-" + number ||
        religionChapterScopes(q).includes(number);
    });
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
