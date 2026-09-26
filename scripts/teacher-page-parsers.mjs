const VERIFIED_ASSIGNMENT_SUBJECTS = new Set(['Spelling', 'Math', 'Reading', 'Religion']);

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

export function cleanTeacherText(value) {
  const cleaned = String(value || '')
    .replace(/Handwrititng/gi, 'Handwriting')
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
  if (match) return ['Spelling', 'Spelling ' + match[1]];

  match = normalized.match(/^(?:Math|Mathematics)\s*(?::|-|—)\s*(.+)$/i);
  if (match) {
    const raw = match[1];
    const task = /^p(?:g|age)\.?\s*(\d+)/i.test(raw)
      ? raw.replace(/^p(?:g|age)\.?/i, 'Page')
      : raw;
    return ['Math', task];
  }

  match = normalized.match(/^(?:Reading|Read|ELA)\s*(?::|-|—)\s*(.+)$/i);
  if (match) return ['Reading', match[1]];
  if (/^Read$/i.test(normalized)) return ['Reading', 'Read'];
  return null;
}

export function parseHomework(lines) {
  const source = [...new Set((Array.isArray(lines) ? lines : [])
    .map(line => String(line || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean))]
    .filter(line => !/^Homework\s*:?\s*$/i.test(line));

  const day = 'Current Homework posting';
  const explicitNoHomework = source.some(line =>
    /^(?:no homework|none|no assignments?)(?:\s*[.!])?$/i.test(line)
    || /\bno homework\b/i.test(line)
  );

  const entries = [];
  let pendingSubject = null;

  for (const line of source) {
    const header = subjectHeader(line);
    if (header) { pendingSubject = header; continue; }

    const inline = inlineAcademicAssignment(line);
    if (inline) {
      entries.push(assignment(day, inline[0], inline[1]));
      pendingSubject = null;
      continue;
    }

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
