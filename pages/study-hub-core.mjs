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
/**
 * Christ Our Life Grade 2's Chapter 4 includes the Unit 1 Review and Test.
 * A teacher shorthand such as "Religion Ch. 4" must not be treated as proof
 * that only Chapter 4 will be assessed. Explicit Unit 1 labels also qualify.
 */
export function isReligionUnitOneReviewTest(test) {
  const label=String(test?.label || '').toLowerCase();
  return /\b(?:religion|faith)\b/.test(label) &&
    (/\bunit\s*1\b/.test(label) || /\b(?:chapter|ch\.?)\s*4\b/.test(label));
}

/** Match practice to an announced test without inventing scope or altering sources. */
export function questionsForTest(test, questions) {
  const label = test.label.toLowerCase();
  // Exact singular/plural-noun exams use only their source-gated bank.
  // Fail closed when that bank is absent instead of borrowing other grammar.
  if (/singular\s*(?:&|and)\s*plural\s+nouns?/.test(label)) {
    return questions.filter(q => q.subject === 'Reading / ELA' && q.skill === 'singular-plural-nouns');
  }
  // Exact common/proper-noun exams must never be padded with unrelated
  // subject-predicate or sentence-type questions when their own bank is absent.
  if (/common\s*(?:&|and)\s*proper\s+nouns?/.test(label)) {
    return questions.filter(q => q.subject === 'Reading / ELA' && q.skill === 'common-proper-nouns');
  }
  if (/grammar|predicate|subject &|sentence types|punctuation/.test(label)) {
    if (/subject|predicate/.test(label)) return questions.filter(q=>q.skill==="subject-predicate");
    if (/sentence types|punctuation/.test(label)) return questions.filter(q=>q.skill==="sentence-types");
    return questions.filter(q=>["subject-predicate","sentence-types"].includes(q.skill));
  }
  if (/phonics/.test(label) && /\bshort\s+vowels?\b/.test(label)) {
    return questions.filter(q => q.subject === 'Reading / ELA' && q.skill === 'short-vowels');
  }
  if (/spelling|handwriting/.test(label)) {
    // A dated three-letter-blend test must not silently inherit prior digraphs,
    // vowel practice or suffix questions from the broad Spelling bank.
    if (/\b(?:3|three)[ -]+letter\s+(?:consonant\s+)?blends?\b/.test(label)) {
      return questions.filter(q=>q.subject==='Spelling / Handwriting'&&q.skill==='three-letter-blends');
    }
    // A test that names consonant digraphs has an exact verified scope.
    // Do not pad its guide or worksheet with prior long-vowel, soft-c/g, or
    // reading-suffix questions merely because they share a broad subject.
    if (/\bconsonant\s+digraphs?\b/.test(label)) {
      return questions.filter(q => q.skill === 'consonant-digraphs');
    }
    // The teacher page may name a new long vowel but leave a second short
    // vowel unspecified, e.g. "long o / Short )". Never reuse last week's
    // unrelated i/a practice to make this test appear ready.
    // Expand only an explicitly shared vowel, e.g. long/short u. A label
    // such as long o / Short ) still leaves the second sound unspecified.
    const focusLabel = label.replace(/\b(long|short)\s*\/\s*(long|short)\s+([aeiou])\b/g,'$1 $3 / $2 $3');
    const focus = [...focusLabel.matchAll(/\b(short|long)\s+([aeiou])\b/g)]
      .map(match => ({sound:match[1],vowel:match[2]}));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(test.date || '') ? test.date : null;
    return questions
      .filter(q => /Spelling|phonics/i.test(q.subject) ||
        /long-short|short-i-long-i|consonant-blend|suffix|long-[aeiou]/.test(q.skill))
      .filter(q => {
        const photographed = String(q.sourceFact || '')
          .match(/^Photo-confirmed weekly spelling words for (\d{4}-\d{2}-\d{2})$/);
        if (photographed) return date === photographed[1];
        if (!focus.length) return !/\b(?:short|long)\s*\)/.test(label);
        const evidence = String(q.skill || '') + ' ' + String(q.sourceFact || '');
        return focus.some(({sound,vowel}) => {
          const pairConfirmed = focus.some(row => row.vowel === vowel && row.sound !== sound);
          const solo = new RegExp('\\b' + sound + '[- ]' + vowel + '\\b','i').test(evidence);
          const pair = pairConfirmed && new RegExp('\\b(?:long-short-' + vowel + '|short-' + vowel + '-long-' + vowel + ')\\b','i').test(evidence);
          return solo && !/\blong-short-|\bshort-[aeiou]-long-/.test(String(q.skill || '')) || pair;
        });
      });
  }
  if (/religion|faith/.test(label)) {
    const chapter = label.match(/\b(?:chapter|ch\.?)\s*([1-9]\d*)\b/);
    if (isReligionUnitOneReviewTest(test)) {
      // Chapter 4 is a Unit 1 assessment boundary in the publisher's Grade 2
      // guide. Retain all current Chapter 4 questions and one checked item
      // per earlier chapter skill, rather than a huge, repetitive question bank.
      // Never pull in unscoped/unknown chapters merely to fill the worksheet.
      const currentChapter=[], reviewBySkill=new Map();
      for (const q of questions) {
        if (q.subject !== 'Religion') continue;
        const scopes=religionChapterScopes(q);
        const bySkill=/^religion-chapter-([1-9]\d*)$/.exec(String(q.skill || ''));
        if (bySkill) scopes.push(Number(bySkill[1]));
        if (scopes.includes(4)) currentChapter.push(q);
        else if (scopes.some(n=>n>=1&&n<=3) && !reviewBySkill.has(q.skill))
          reviewBySkill.set(q.skill,q);
      }
      return [...currentChapter,...reviewBySkill.values()];
    }
    return questions.filter(q => {
      if (q.subject !== "Religion") return false;
      if (!chapter) return true;
      const number = Number(chapter[1]);
      return q.skill === "religion-chapter-" + number ||
        religionChapterScopes(q).includes(number);
    });
  }
  if (/math/.test(label)) {
    const operations = [...label.matchAll(/\b(addition|subtraction)\b/g)].map(match => match[1]);
    return questions.filter(q => q.subject === 'Math' &&
      (!operations.length || operations.some(operation => String(q.skill || '').includes(operation))));
  }
  if (/reading|ela/.test(label)) {
    // A text-set assessment needs exact verified linkage. Generic Reading
    // exercises may still be used in Reading Games, but never as evidence
    // that a specific announced text set is covered by Test Prep.
    const announced = label.match(/\bunit\s*(\d+)\s*text\s*set\s*(\d+)\b/i);
    if (announced) {
      return questions.filter(q => q.subject === "Reading / ELA" &&
        (Array.isArray(q.sourceTestScopes) ? q.sourceTestScopes : []).some(scope => {
          const matched = String(scope).match(/\bunit\s*(\d+)\s*text\s*set\s*(\d+)\b/i);
          return matched && Number(matched[1]) === Number(announced[1]) &&
            Number(matched[2]) === Number(announced[2]);
        }));
    }
    return questions.filter(q => q.subject === "Reading / ELA" &&
      (q.skill === 'reading-long-short-o' ||
        !/subject-predicate|sentence-types|long-short|possessive/.test(q.skill)));
  }
  return [];
}
