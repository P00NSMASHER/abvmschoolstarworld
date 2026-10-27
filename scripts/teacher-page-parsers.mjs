const VERIFIED_ASSIGNMENT_SUBJECTS = new Set(['Spelling', 'Math', 'Reading', 'Religion']);
const TEACHER_NAVIGATION_LABELS = new Set([
  'home',
  'reading work',
  'weekly spelling list',
  'homework',
  'tests',
  'religion',
  'more home',
]);


// Follow redirects only when they preserve the exact six teacher-page paths.
// A lookalike or unrelated Google Sites page cannot establish current homework.
export function assertExpectedTeacherPageUrl(actualUrl, expectedUrl) {
  const actual = new URL(actualUrl);
  const expected = new URL(expectedUrl);
  const path = url => url.pathname.replace(/\/+$/, '');
  if (actual.origin !== expected.origin || actual.protocol !== 'https:' ||
      path(actual) !== path(expected) || actual.username || actual.password) {
    throw new Error('Official teacher page redirected outside its expected source URL.');
  }
  return true;
}

export function decodeHtml(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, entity => ({
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ',
    })[entity.toLowerCase()] || entity);
}

export function pageLines(html) {
  const withoutScripts = String(html || '').replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const lines = [
    ...withoutScripts.matchAll(
      /<(?:p|h[1-3]|li|td|th)\b[^>]*>([\s\S]*?)<\/(?:p|h[1-3]|li|td|th)>/gi
    ),
  ]
    .map(match => decodeHtml(match[1].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return [...new Set(lines)];
}

// Google Sites renders the teacher's spelling table as <small><span> text,
// not the paragraphs and table cells used by the other teacher pages.
// Keep this extraction scoped to the visible spelling block so that "home"
// (an actual spelling word) is never mistaken for a navigation label.
export function parseGoogleSitesSpellingList(html) {
  const withoutScripts = String(html || '').replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const tokens = [];
  for (const small of withoutScripts.matchAll(/<small\b([^>]*)>([\s\S]*?)<\/small>/gi)) {
    if (!/\bzfr3Q\b/i.test(small[1]) || !/\bTMjjoe\b/i.test(small[1])) continue;
    for (const span of small[2].matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)) {
      if (!/\bC9DxTc\b/.test(span[1])) continue;
      const text = decodeHtml(span[2].replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
      if (text) tokens.push(text);
    }
  }

  const basicStart = tokens.findIndex(line => /^Basic Words\s*:?$/i.test(line));
  const skill = tokens.find(line => /^Skill\s*:/i.test(line)) || '';
  if (basicStart < 0) return { skill, words: [] };

  const words = [];
  for (const line of tokens.slice(basicStart + 1)) {
    if (/^(?:Basic|Review|High Frequency)\s+Words\s*:?$/i.test(line)) continue;
    if (/^(?:Google Sites|Report abuse)$/i.test(line)) break;
    if (/^[a-z]+(?:['-][a-z]+)*$/i.test(line)) words.push(line.toLowerCase());
  }
  if (words.length > 40) throw new Error('Implausibly large teacher spelling list; inspect source layout.');
  return { skill, words: [...new Set(words)] };
}

export function cleanTeacherText(value) {
  const cleaned = String(value || '')
    .replace(/Handwrititng/gi, 'Handwriting')
    .replace(/\bdioalogue\b/gi, 'dialogue')
    .replace(/\b2 letter\b/gi, '2-letter')
    .replace(/--/g, ' — ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\b(\d+)\s+\/\s+(\d+)\b/g, '$1/$2')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : cleaned;
}

function assignment(day, subject, task, due = 'Current posting') {
  return { day, subject, task: cleanTeacherText(task), due };
}

function subjectHeader(line) {
  const normalized = String(line || '').trim();
  if (/^(?:Spelling|Word Study|Phonics)\s*:?\s*$/i.test(normalized)) return 'Spelling';
  if (/^(?:Math|Mathematics)\s*:?\s*$/i.test(normalized)) return 'Math';
  if (/^(?:Reading|Read|ELA)\s*:?\s*$/i.test(normalized)) return 'Reading';
  return null;
}

function inlineAcademicAssignment(line) {
  const normalized = String(line || '').trim();
  let match = normalized.match(/^(?:Spelling|Word Study|Phonics)\s*(?::|-|—)\s*(.+)$/i);
  if (!match) match = normalized.match(/^(?:Spelling|Word Study|Phonics)\s+(.+)$/i);
  if (match) return ['Spelling', 'Spelling ' + match[1]];

  match = normalized.match(/^(?:Math|Mathematics)\s*(?::|-|—)\s*(.+)$/i);
  if (!match) match = normalized.match(/^(?:Math|Mathematics)\s+(p(?:g|age)\.?\s*\d+\b.*|work(?:sheet|book)\b.*|paper\b.*|packet\b.*|sheet\b.*)$/i);
  if (match) {
    const raw = match[1];
    const task = /^p(?:g|age)\.?\s*(\d+)/i.test(raw)
      ? raw.replace(/^p(?:g|age)\.?/i, 'Page')
      : /^paper\b/i.test(raw) ? 'Math ' + raw : raw;
    return ['Math', task];
  }

  match = normalized.match(/^(?:Reading|Read|ELA)\s*(?::|-|—)\s*(.+)$/i);
  if (match) return ['Reading', match[1]];
  if (/^Read$/i.test(normalized)) return ['Reading', 'Read'];
  return null;
}

export function teacherContentLines(lines, pageTitle = '') {
  const title = String(pageTitle || '').trim().toLowerCase();
  return [...new Set((Array.isArray(lines) ? lines : [])
    .map(line => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean))]
    .filter(line => {
      const normalized = line.toLowerCase();
      return normalized !== title && !TEACHER_NAVIGATION_LABELS.has(normalized);
    });
}

function trimUnmatchedTrailingDelimiters(value) {
  let text = String(value || '').trim();
  const pairs = [['(', ')'], ['[', ']'], ['{', '}']];

  // The source hash still binds the teacher's exact wording. This normalization
  // only prevents a stray trailing closer from becoming part of a public title.
  while (text) {
    const pair = pairs.find(([open, close]) =>
      text.endsWith(close)
      && [...text].filter(char => char === close).length > [...text].filter(char => char === open).length
    );
    if (!pair) break;
    text = text.slice(0, -1).trimEnd();
  }
  return text;
}

export function parseStoryTitles(value) {
  const normalized = String(value || '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const quoted = [...normalized.matchAll(/["']([^"']+?)["']/g)]
    .map(match => trimUnmatchedTrailingDelimiters(match[1]))
    .filter(Boolean);
  if (quoted.length >= 2) return [...new Set(quoted)];

  const cleaned = trimUnmatchedTrailingDelimiters(
    normalized.replace(/^["']+|["']+$/g, '').trim()
  );
  const pieces = cleaned
    .split(/["']+\s+["']?(?=[A-Z])/)
    .map(part => trimUnmatchedTrailingDelimiters(
      part.replace(/^["']+|["']+$/g, '').trim()
    ))
    .filter(Boolean);
  return [...new Set(pieces.length ? pieces : [cleaned].filter(Boolean))];
}

export function parseHomework(lines) {
  const source = [...new Set((Array.isArray(lines) ? lines : [])
    .map(line => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean))]
    .filter(line => !/^Homework\s*:?\s*$/i.test(line));

  const day = 'Current Homework posting';
  // A reference to a different day or an exception is not proof that today's
  // posting has no assignments. Unclear wording must fail closed.
  const explicitNoHomework = source.some(line =>
    /^(?:(?:there\s+(?:is|are)|there['’]s)\s+)?(?:no\s+homework|no\s+assignments?|none)(?:\s+(?:assigned|today|tonight|for\s+(?:today|tonight)))?[.!]?$/i.test(line)
  );

  const entries = [];
  let pendingSubject = null;

  for (const line of source) {
    const inline = inlineAcademicAssignment(line);
    if (inline) {
      entries.push(assignment(day, inline[0], inline[1]));
      pendingSubject = null;
      continue;
    }

    // Do not silently drop unfamiliar Math lines while accepting other subjects.
    // An incomplete assignment list is less trustworthy than a source-warning state.
    if (/^(?:Math|Mathematics)\s+\S/i.test(line)) {
      throw new Error('Unrecognized Math assignment on Homework page: ' + line.slice(0, 150));
    }

    const header = subjectHeader(line);
    if (header) { pendingSubject = header; continue; }

    if (pendingSubject) {
      if (!/^(?:none|n\/a|no homework|no assignment)(?:\s*[.!])?$/i.test(line)) {
        const task = pendingSubject === 'Spelling'
          ? 'Spelling ' + line
          : pendingSubject === 'Math' && /^p(?:g|age)\.?\s*(\d+)/i.test(line)
            ? line.replace(/^p(?:g|age)\.?/i, 'Page')
            : line;
        entries.push(assignment(day, pendingSubject, task));
      }
      pendingSubject = null;
      continue;
    }

    let match;
    if (/^Attend Mass(?:\s*[.!])?$/i.test(line)) {
      entries.push(assignment(day, 'Religion', 'Attend Mass'));
    } else if ((match = line.match(/^Parents?\s*(?::|-|—)\s*(.+)$/i))) {
      entries.push(assignment(day, 'Parent', match[1]));
    } else if (/^Reading log/i.test(line)) {
      entries.push(assignment(day, 'Reading', 'Keep Reading Log and Behavior Chart in the HW folder', 'Ongoing'));
    } else if (/everything should be returned/i.test(line)) {
      entries.push(assignment(day, 'Homework Folder', 'Return everything in the HW folder', 'Next school day'));
    }
  }

  const academicEntries = entries.filter(entry => VERIFIED_ASSIGNMENT_SUBJECTS.has(entry.subject));
  if (academicEntries.length === 0 && explicitNoHomework) {
    return [assignment(day, 'Homework', 'No homework assigned')];
  }

  if (academicEntries.length === 0) {
    const sample = source.slice(0, 8).join(' | ');
    throw new Error(
      'Homework page did not contain a verifiable academic assignment or an explicit no-homework state.' +
      (sample ? ' Parsed lines: ' + sample : '')
    );
  }

  return entries;
}
