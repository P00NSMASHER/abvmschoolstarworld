import {createHash} from 'node:crypto';

const cleanFocus=value=>String(value??'').toLowerCase()
  .replace(/\b(?:spelling|handwriting|grammar|phonics|test|assessment|and)\b/g,' ')
  .replace(/\bthree\b/g,'3')
  .replace(/[^a-z0-9]+/g,' ').trim();
const containsFocus=(haystack,needle)=>Boolean(needle)&&(' '+haystack+' ').includes(' '+needle+' ');

// A printable word-list check must bind to the exact current school week,
// matching teacher skill and source-content hash; a cached older list cannot pass.
export function verifiedSpellingDictationWords(pack,date,label) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||
     !/\bspelling\b/i.test(String(label||'')))return [];
  const when=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(when.getTime())||when.toISOString().slice(0,10)!==date)return [];
  const monday=new Date(when);
  monday.setUTCDate(when.getUTCDate()-(when.getUTCDay()+6)%7);
  const week='Week of '+new Intl.DateTimeFormat('en-US',{
    month:'long',day:'numeric',year:'numeric',timeZone:'UTC',
  }).format(monday);
  const provenance=pack?.spellingListProvenance;
  if(provenance?.weekLabel!==week||
     provenance?.sourceUrl!=='https://sites.google.com/view/abvmgr2/weekly-spelling-list'||
     !/^[a-f0-9]{64}$/i.test(String(provenance?.wordsHash||'')))return [];
  const spelling=Array.isArray(pack?.subjects)
    ?pack.subjects.find(row=>row?.subject==='Spelling / Handwriting'):null;
  const notes=Array.isArray(spelling?.studyNotes)?spelling.studyNotes:[];
  const focus=cleanFocus(label);
  const named=notes.filter(note=>/^Skill:\s*\S/i.test(String(note)))
    .map(note=>cleanFocus(String(note).replace(/^Skill:\s*/i,'')));
  if(!named.some(item=>containsFocus(focus,item)||containsFocus(item,focus)))return [];
  const note=notes.find(value=>/^(?:Weekly spelling words|Spelling words|Teacher spelling words|Teacher-posted spelling words(?: \(page undated\))?|Verified spelling words|Words for spelling test)\s*:/i.test(String(value)));
  if(!note)return [];
  const words=String(note).slice(String(note).indexOf(':')+1).split(',')
    .map(word=>word.replace(/[.\s]+$/,'').trim())
    .filter(word=>/^[a-z][a-z'-]*$/i.test(word));
  if(!words.length||words.length>30||new Set(words.map(x=>x.toLowerCase())).size!==words.length)return [];
  const hash=createHash('sha256').update(JSON.stringify(words)).digest('hex');
  return hash===provenance.wordsHash?words:[];
}
