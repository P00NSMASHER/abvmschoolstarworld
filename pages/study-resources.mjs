/** Validate collection payloads before caching them. Failed reads remain retryable. */
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const list = (value, predicate) => Array.isArray(value) && value.every(predicate);
const date = value => value == null || (text(value) && Number.isFinite(Date.parse(value)));
const question = q => object(q) && text(q.prompt) && text(q.answer) &&
  text(q.subject) && text(q.skill) && list(q.choices, text) && q.choices.length > 1 &&
  new Set(q.choices).size === q.choices.length && q.choices.includes(q.answer);
const stamps = row => object(row) && date(row.firstSeenAt) && date(row.lastSeenAt) &&
  (row.provenance == null || list(row.provenance, p => object(p) && date(p.capturedAt)));

export function validStudyResource(name, value) {
  if (!object(value)) return false;
  if (name === 'schoolwork.json') return list(value.lessons, l => object(l) &&
    text(l.title) && text(l.subject) && date(l.studiedOn) &&
    (l.notes == null || list(l.notes, text)) &&
    (l.questions == null || list(l.questions, question)));
  if (name === 'study-archive.json') return ['notes', 'vocabulary', 'questions'].every(key =>
    list(value[key], row => stamps(row) &&
      (key === 'questions' ? question(row) : key === 'notes' ? text(row.text) && text(row.subject) : text(row.term))));
  if (name === 'religion-sources.json') return object(value.chapters) ||
    list(value.chapters, row => object(row) && Number.isInteger(row.chapter) && text(row.url));
  return false;
}

/** Coalesce simultaneous reads; abort stalled requests without retaining bad data. */
export function createStudyResourceLoader(fetcher, timeoutMs = 12000) {
  const cache = new Map();
  return async function resource(name) {
    if (cache.has(name)) return cache.get(name);
    const controller = new AbortController();
    let timer;
    const pending = Promise.race([
      Promise.resolve().then(() => fetcher('./data/' + name, {signal: controller.signal}))
        .then(response => {
          if (!response.ok) throw new Error('Study materials could not load.');
          return response.json();
        })
        .then(value => {
          if (!validStudyResource(name, value)) throw new Error('Study materials could not be validated.');
          return value;
        }),
      new Promise((_, reject) => { timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Study materials took too long to load.'));
      }, timeoutMs); }),
    ]).catch(error => {
      if (cache.get(name) === pending) cache.delete(name);
      throw error;
    }).finally(() => clearTimeout(timer));
    cache.set(name, pending);
    return pending;
  };
}
