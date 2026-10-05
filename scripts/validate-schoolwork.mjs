import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
const text = value => typeof value === 'string' && value.trim().length > 0;
function unique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}
const allowedKeys = {
  root: new Set(['schemaVersion','uploadedPhotoCount','distinctWorksheetNote','lessons','sourceManifest']),
  lesson: new Set(['id','title','subject','sources','skills','notes','studiedOn','addedOn','dateStatus','questions','chapter']),
  question: new Set(['id','subject','skill','prompt','answer','choices','explanation','hint','sourceFact','tier','questionType','difficulty','dok','domain','standards','provenance']),
  source: new Set(['id','sha256','status','duplicateOf','reason'])
};
function assertAllowedKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${label}: unknown key ${key}`);
  }
}
export function validateSchoolwork(pack, {requireManifest = false} = {}) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  assertAllowedKeys(pack, allowedKeys.root, 'Schoolwork root');
  check(pack.schemaVersion === 1 && Array.isArray(pack.lessons), 'Unsupported schoolwork schema');
  check(Number.isInteger(pack.uploadedPhotoCount) && pack.uploadedPhotoCount >= 0, 'Invalid uploadedPhotoCount');
  unique(pack.lessons.map(l => l.id), 'lesson IDs');
  const questionIds = [], prompts = [], referenced = new Set();
  for (const lesson of pack.lessons) {
    assertAllowedKeys(lesson, allowedKeys.lesson, 'Lesson');
    check(text(lesson.id) && /^[a-z0-9][a-z0-9-]*$/i.test(lesson.id), 'Invalid lesson ID');
    for (const key of ['title','subject','dateStatus']) check(text(lesson[key]), `${lesson.id}: missing ${key}`);
    check(Array.isArray(lesson.sources) && lesson.sources.length && lesson.sources.every(text), `${lesson.id}: missing sources`);
    unique(lesson.sources, `${lesson.id} sources`);
    lesson.sources.forEach(s => referenced.add(s));
    check(Array.isArray(lesson.skills) && lesson.skills.length && lesson.skills.every(text), `${lesson.id}: missing skills`);
    unique(lesson.skills, `${lesson.id} skills`);
    check(Array.isArray(lesson.notes) && lesson.notes.length && lesson.notes.every(text), `${lesson.id}: missing notes`);
    check(lesson.studiedOn === null || isDate(lesson.studiedOn), `${lesson.id}: invalid studiedOn`);
    check(isDate(lesson.addedOn), `${lesson.id}: invalid addedOn`);
    check(lesson.studiedOn !== null || /undated|unknown/i.test(lesson.dateStatus), `${lesson.id}: unknown study date must remain labeled undated`);
    check(lesson.chapter === undefined || (Number.isInteger(lesson.chapter) && lesson.chapter >= 1 && lesson.chapter <= 99), `${lesson.id}: invalid chapter`);
    check(Array.isArray(lesson.questions), `${lesson.id}: missing questions array`);
    for (const q of lesson.questions) {
      assertAllowedKeys(q, allowedKeys.question, `${lesson.id} question`);
      for (const key of ['id','subject','skill','prompt','answer','explanation','sourceFact','provenance']) check(text(q[key]), `${lesson.id}: question missing ${key}`);
      check(lesson.skills.includes(q.skill), `${q.id}: question skill is not in lesson`);
      check(Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.length <= 6 && q.choices.every(text), `${q.id}: invalid choices`);
      unique(q.choices.map(c=>c.trim()), `${q.id} choices`);
      check(q.choices.filter(c=>c === q.answer).length === 1, `${q.id}: answer must occur exactly once in choices`);
      questionIds.push(q.id); prompts.push(normalize(q.prompt));
    }
  }
  unique(questionIds,'question IDs'); unique(prompts,'question prompts');
  const manifest = pack.sourceManifest;
  check(!requireManifest || Array.isArray(manifest), 'Reviewed intake requires a sourceManifest');
  if (manifest !== undefined) {
    check(Array.isArray(manifest), 'sourceManifest must be an array');
    unique(manifest.map(s=>s.id),'source IDs');
    check(pack.uploadedPhotoCount === manifest.length, 'uploadedPhotoCount must account for every manifest photo');
    const byId = new Map(manifest.map(s=>[s.id,s]));
    const hashes = new Map();
    for (const source of manifest) {
      assertAllowedKeys(source, allowedKeys.source, 'Manifest source');
      check(text(source.id) && /^[a-zA-Z0-9_.-]+$/.test(source.id), 'Invalid non-identifying source ID');
      check(/^[a-f0-9]{64}$/.test(source.sha256), `${source.id}: missing SHA-256`);
      check(['integrated','duplicate','held'].includes(source.status), `${source.id}: invalid source status`);
      if (source.status === 'duplicate') {
        const canonical=byId.get(source.duplicateOf);
        check(canonical && canonical.id !== source.id && canonical.status !== 'duplicate', `${source.id}: invalid duplicateOf`);
        check(canonical.sha256 === source.sha256 || text(source.reason), `${source.id}: semantic duplicate requires a reason`);
      }
      if (hashes.has(source.sha256)) check(source.status === 'duplicate' || hashes.get(source.sha256).status === 'duplicate', `${source.id}: repeated hash must be recorded as a duplicate`);
      else hashes.set(source.sha256,source);
      check(source.status === 'held' || referenced.has(source.id), `${source.id}: photo is not accounted for by a lesson`);
      if (source.status === 'held') check(text(source.reason), `${source.id}: held source requires reason`);
    }
    for (const id of referenced) check(byId.has(id), `${id}: lesson references missing source manifest entry`);
  } else check(referenced.size === pack.uploadedPhotoCount, 'All uploaded photos must be accounted for in lesson sources');
  const forbidden = /^(studentName|studentId|birthDate|gradeReceived|scoreReceived|rawImage|imageBase64|imageBytes|ocrText|handwrittenAnswers)$/i;
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key,item] of Object.entries(value)) {
      check(!forbidden.test(key), `Do not publish private field ${key}`);
      if (typeof item === 'string') check(!/^data:image\//.test(item), 'Do not publish raw image data');
      else inspect(item);
    }
  }
  inspect(pack);
  return {lessons:pack.lessons.length,questions:questionIds.length,photos:pack.uploadedPhotoCount};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path=process.argv[2] || 'pages/data/schoolwork.json';
  try { console.log(JSON.stringify(validateSchoolwork(JSON.parse(await readFile(path,'utf8'))))); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
