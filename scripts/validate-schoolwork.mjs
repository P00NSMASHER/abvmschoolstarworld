import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function isDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
const text = value => typeof value === 'string' && value.trim().length > 0;
const ROOT_KEYS = new Set(['schemaVersion','uploadedPhotoCount','distinctWorksheetNote','lessons','sourceManifest']);
const LESSON_KEYS = new Set(['id','title','subject','sources','skills','notes','studiedOn','weekOf','addedOn','dateStatus','chapter','questions']);
const QUESTION_KEYS = new Set(['id','subject','skill','prompt','answer','choices','explanation','hint','sourceFact','tier','questionType','difficulty','dok','domain','standards','provenance']);
const SOURCE_KEYS = new Set(['id','sha256','status','duplicateOf','reason']);
function allowedKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`);
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length) throw new Error(`${label}: unknown field ${unknown[0]}`);
}
function unique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label}`);
}
export function validateSchoolwork(pack, {requireManifest = false} = {}) {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  allowedKeys(pack, ROOT_KEYS, 'schoolwork root');
  check(pack?.schemaVersion === 1 && Array.isArray(pack.lessons), 'Unsupported schoolwork schema');
  check(Number.isInteger(pack.uploadedPhotoCount) && pack.uploadedPhotoCount >= 0, 'Invalid uploadedPhotoCount');
  check(pack.distinctWorksheetNote === undefined || text(pack.distinctWorksheetNote), 'Invalid distinctWorksheetNote');
  unique(pack.lessons.map(l => l.id), 'lesson IDs');
  const questionIds = [], prompts = [], referenced = new Set();
  for (const lesson of pack.lessons) {
    allowedKeys(lesson, LESSON_KEYS, `lesson ${lesson?.id || '<unknown>'}`);
    check(text(lesson.id) && /^[a-z0-9][a-z0-9-]*$/i.test(lesson.id), 'Invalid lesson ID');
    for (const key of ['title','subject','dateStatus']) check(text(lesson[key]), `${lesson.id}: missing ${key}`);
    check(Array.isArray(lesson.sources) && lesson.sources.length && lesson.sources.every(text), `${lesson.id}: missing sources`);
    unique(lesson.sources, `${lesson.id} sources`);
    lesson.sources.forEach(s => referenced.add(s));
    check(Array.isArray(lesson.skills) && lesson.skills.length && lesson.skills.every(text), `${lesson.id}: missing skills`);
    unique(lesson.skills, `${lesson.id} skills`);
    check(Array.isArray(lesson.notes) && lesson.notes.length && lesson.notes.every(text), `${lesson.id}: missing notes`);
    check(lesson.studiedOn === null || isDate(lesson.studiedOn), `${lesson.id}: invalid studiedOn`);
    // A verified school week is evidence of weekly relevance, not an invented day.
    if (lesson.weekOf !== undefined) {
      check(isDate(lesson.weekOf), `${lesson.id}: invalid weekOf`);
      check(new Date(lesson.weekOf + 'T12:00:00Z').getUTCDay() === 1, `${lesson.id}: weekOf must be a Monday`);
      if (lesson.studiedOn) {
        const end = new Date(lesson.weekOf + 'T12:00:00Z');
        end.setUTCDate(end.getUTCDate() + 6);
        check(lesson.studiedOn >= lesson.weekOf && lesson.studiedOn <= end.toISOString().slice(0,10),
          `${lesson.id}: studiedOn conflicts with verified week`);
      }
    }
    check(isDate(lesson.addedOn), `${lesson.id}: invalid addedOn`);
    check(lesson.studiedOn !== null || /undated|unknown/i.test(lesson.dateStatus), `${lesson.id}: unknown study date must remain labeled undated`);
    check(lesson.chapter === undefined || (Number.isInteger(lesson.chapter) && lesson.chapter >= 1 && lesson.chapter <= 99), `${lesson.id}: invalid chapter`);
    check(Array.isArray(lesson.questions), `${lesson.id}: missing questions array`);
    for (const q of lesson.questions) {
      allowedKeys(q, QUESTION_KEYS, `question ${q?.id || '<unknown>'}`);
      for (const key of ['id','subject','skill','prompt','answer','explanation','sourceFact','provenance']) check(text(q[key]), `${lesson.id}: question missing ${key}`);
      check(lesson.skills.includes(q.skill), `${q.id}: question skill is not in lesson`);
      check(q.hint === undefined || text(q.hint), `${q.id}: invalid hint`);
      for (const key of ['tier','questionType','domain']) check(q[key] === undefined || text(q[key]), `${q.id}: invalid ${key}`);
      check(q.difficulty === undefined || (Number.isInteger(q.difficulty) && q.difficulty >= 1 && q.difficulty <= 5), `${q.id}: invalid difficulty`);
      check(q.dok === undefined || (Number.isInteger(q.dok) && q.dok >= 1 && q.dok <= 4), `${q.id}: invalid dok`);
      check(q.standards === undefined || (Array.isArray(q.standards) && q.standards.every(text)), `${q.id}: invalid standards`);
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
    const hashes = new Map(), integratedHashes = new Map();
    for (const source of manifest) {
      allowedKeys(source, SOURCE_KEYS, `source ${source?.id || '<unknown>'}`);
      check(text(source.id) && /^[a-zA-Z0-9_.-]+$/.test(source.id), 'Invalid non-identifying source ID');
      check(/^[a-f0-9]{64}$/.test(source.sha256), `${source.id}: missing SHA-256`);
      check(['integrated','duplicate','held'].includes(source.status), `${source.id}: invalid source status`);
      check(source.duplicateOf === undefined || text(source.duplicateOf), `${source.id}: invalid duplicateOf`);
      check(source.reason === undefined || text(source.reason), `${source.id}: invalid reason`);
      // A held photo is accounted for, but never authorizes publishing a lesson.
      check(source.status !== 'held' || !referenced.has(source.id),
        `${source.id}: held source cannot support published lessons`);
      check(source.status === 'duplicate' || source.duplicateOf === undefined,
        `${source.id}: duplicateOf is only valid for duplicate sources`);
      // Order-independent SHA identity: one canonical integrated record per image.
      if (source.status === 'integrated') {
        check(!integratedHashes.has(source.sha256),
          `${source.id}: SHA-256 already integrated as ${integratedHashes.get(source.sha256)}`);
        integratedHashes.set(source.sha256,source.id);
      }
      if (source.status === 'duplicate') {
        const canonical=byId.get(source.duplicateOf);
        check(canonical && canonical.id !== source.id && canonical.status === 'integrated', `${source.id}: invalid duplicateOf`);
        check(canonical.sha256 === source.sha256 || text(source.reason), `${source.id}: semantic duplicate requires a reason`);
        // Rephotographs are provenance on the same reviewed lesson, not an
        // independent authorization to generate different academic content.
        for (const lesson of pack.lessons) {
          if (lesson.sources.includes(source.id)) {
            check(lesson.sources.includes(canonical.id),
              `${lesson.id}: duplicate ${source.id} must share its lesson with ${canonical.id}`);
          }
        }
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
