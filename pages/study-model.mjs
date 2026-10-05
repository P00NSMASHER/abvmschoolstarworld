/** Calendar and sampling rules shared by every Study surface. */
const zone = 'America/New_York';
export function schoolDay(now = new Date()) {
  if (typeof now === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(now)) return now;
  const d = new Date(now);
  if (!Number.isFinite(d.getTime())) throw new TypeError('Invalid study date');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
function shift(day,n) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export function weekBounds(now = new Date()) {
  const day=schoolDay(now), weekday=new Date(`${day}T12:00:00Z`).getUTCDay();
  const start=shift(day,-((weekday+6)%7)); return {start,end:shift(start,6)};
}
export function nextTests(events = [], now = new Date()) {
  const day=schoolDay(now), instant=new Date(now).getTime();
  const eligible=events.filter(e=> /^\d{4}-\d{2}-\d{2}$/.test(e.date||'') && e.date>=day && (!e.endsAt || !Number.isFinite(Date.parse(e.endsAt)) || Date.parse(e.endsAt)>instant));
  const first=eligible.map(e=>e.date).sort()[0];
  const seen=new Set();
  return eligible.filter(e=>e.date===first).filter(e=>{const key=`${e.date}|${e.label}`;if(seen.has(key))return false;seen.add(key);return true;});
}
function identity(item) { return typeof item === 'object' && item ? JSON.stringify([item.prompt||item.text||item.id||JSON.stringify(item),item.answer||'']) : String(item); }
function random(seed) { let s=2166136261;for(const c of String(seed))s=Math.imul(s^c.charCodeAt(0),16777619);return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return (s>>>0)/4294967296;}; }
/** Round robin keeps represented test subjects within one item until a pool is exhausted. */
export function balancedRound(groups = [], count = 12, seed = 0) {
  const rng=random(seed), pools=(Array.isArray(groups)?groups:Object.values(groups)).map(g=>[...(Array.isArray(g)?g:g.questions||[])]);
  for(const pool of pools)for(let i=pool.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const seen=new Set(),result=[];const limit=Math.max(0,Math.floor(Number(count)||0));
  let progress=true;
  while(result.length<limit&&progress){progress=false;for(const pool of pools){while(pool.length){const item=pool.pop(),key=identity(item);if(seen.has(key))continue;seen.add(key);result.push(item);progress=true;break;}if(result.length===limit)break;}}
  return result;
}
export function visibleArchive(archive = {}, now = new Date()) {
  const day=schoolDay(now);
  return Object.fromEntries(['notes','vocabulary','questions'].map(key=>[key,(archive[key]||[]).filter(item=>item.firstSeenAt && schoolDay(item.firstSeenAt)<=day)]));
}
export function weeklyArchive(archive = {}, now = new Date()) {
  const {start,end}=weekBounds(now),day=schoolDay(now),visible=visibleArchive(archive,now);
  return Object.fromEntries(Object.entries(visible).map(([key,items])=>[key,items.filter(item=>(item.provenance||[]).some(p=>{const date=schoolDay(p.capturedAt);return date>=start&&date<=end&&date<=day;}))]));
}
/** Strict test coverage: complete equal quotas only, including overlapping banks. */
export function balancedTestRound(groups = [], count = 12, seed = 0) {
  const values=Array.isArray(groups)?groups:Object.values(groups);
  const pools=values.map(g=>balancedRound([Array.isArray(g)?g:g.questions||[]],Number.MAX_SAFE_INTEGER,seed));
  if(!pools.length||pools.some(p=>!p.length))return [];
  const maximum=Math.min(Math.floor(Math.max(0,Number(count)||0)/pools.length),...pools.map(p=>p.length));
  // A matching assigns each distinct question to one subject slot; greedy allocation
  // would incorrectly starve a small bank when another bank shares its questions.
  for(let quota=maximum;quota>0;quota--){
    const slots=Array.from({length:quota},()=>pools.map((_,i)=>i)).flat();
    const owners=new Map(),assigned=new Map();
    function assign(slot,visited){
      for(const item of pools[slots[slot]]){
        const key=identity(item);if(visited.has(key))continue;visited.add(key);
        const previous=owners.get(key);
        if(previous===undefined||assign(previous,visited)){owners.set(key,slot);assigned.set(slot,item);return true;}
      }
      return false;
    }
    if(slots.every((_,i)=>assign(i,new Set())))return slots.map((_,i)=>assigned.get(i));
  }
  return [];
}
