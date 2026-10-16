import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { TRAY_STYLE_ID, trayMenuSpec, trayMenuContents } from './lunch-art-style.mjs';
import { catalogMeals, CATALOG } from './lunch-publication.mjs';

export function mealSignature(meal) {
  return JSON.stringify([meal.sourceId, meal.items]);
}
export function hasLunch(meal) {
  return Boolean(meal) && (!meal.status || meal.status === 'meal') && Array.isArray(meal.items) && meal.items.length > 0 &&
    meal.items.every(item => typeof item === 'string' && item.trim()) &&
    !meal.items.some(item => /no lunch|no school|not available|unavailable|not yet|pending/i.test(item));
}
export function approvedArtwork(meals, registry) {
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.artworks)) throw new Error('Invalid lunch art registry');
  const result = {};
  for (const art of registry.artworks) {
    if (art.status !== 'reviewed') continue;
    if (!/^[a-z0-9-]+$/.test(art.id) || !/^assets\/lunch-art\/[a-z0-9-]+\.(webp|png|avif)$/.test(art.src) ||
        !art.alt?.trim() || !art.reviewedAt || Number.isNaN(Date.parse(art.reviewedAt)) || !art.reviewNotes?.trim() ||
        !Array.isArray(art.approvedMenus) || art.approvedMenus.length === 0) throw new Error('Invalid reviewed lunch artwork');
    for (const menu of art.approvedMenus) {
      const key = mealSignature(menu);
      if (!hasLunch(menu) || !meals.some(meal => mealSignature(meal) === key && hasLunch(meal))) throw new Error('Artwork approval references an unknown menu');
      if (result[key]) throw new Error('Duplicate artwork approval');
      const tray=art.styleId===TRAY_STYLE_ID;
      if(art.styleId&&!tray)throw new Error('Unknown reviewed artwork style');
      if(tray&&(!Number.isInteger(art.width)||art.width<1200||art.width>1600||!Number.isInteger(art.height)||art.height<800||art.height>1100||Math.abs(art.width/art.height-1.5)>.02||!/^[a-f0-9]{64}$/.test(art.sha256||'')||art.omissionNote!==trayMenuSpec(menu).omissionNote))throw new Error('Invalid reviewed tray artwork metadata');
      result[key] = { src: art.src, alt: art.alt, label: 'Meal illustration', ...(tray?{styleId:art.styleId,width:art.width,height:art.height,omissionNote:art.omissionNote}:{}) };
    }
  }
  return result;
}
export function buildArtPlan(catalog, registry) {
  const meals = catalogMeals(catalog);
  const approved = approvedArtwork(meals, registry);
  const groups = new Map();
  for (const meal of meals.filter(hasLunch)) {
    const key = mealSignature(meal);
    if (!groups.has(key)) groups.set(key, { sourceId: meal.sourceId, items: meal.items, dates: [], artwork: approved[key]?.src || null });
    groups.get(key).dates.push(meal.date);
  }
  return {
    schemaVersion: 1,
    policy: 'Reviewed photorealistic maroon-tray illustrations of verified menu components. Exact menu text remains authoritative. Disclose unpictured unspecified fruit, sauce or taco filling; never infer ingredients or actual portions.',
    targetStyleId: TRAY_STYLE_ID,
    months: [...new Set(meals.map(meal => meal.date.slice(0, 7)))].sort(),
    menus: [...groups.values()].map(menu => {
      const styleId=approved[mealSignature(menu)]?.styleId||null;
      return {...menu,styleId,status:menu.artwork?'ready':'needs-art-review',
        ...(!menu.artwork||styleId!==TRAY_STYLE_ID?{prompt:trayMenuSpec(menu).prompt,omissionNote:trayMenuSpec(menu).omissionNote}:{})};
    })
  };
}
export function pendingArtMenus(plan, month, { styleId = plan.targetStyleId } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) throw new Error('Invalid artwork queue month');
  return plan.menus.filter(menu => (!menu.artwork || (styleId && menu.styleId !== styleId)) && menu.dates.some(date => date.slice(0, 7) >= month));
}
export function renderLunchArtwork(meal, approved) {
  if (!hasLunch(meal)) return '';
  const art = approved[mealSignature(meal)];
  if (!art) return '';
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  return `<figure class="lunch-art${art.styleId?' lunch-art-tray':''}"><img src="${escape(art.src)}" alt="${escape(art.alt)}" width="${art.width||320}" height="${art.height||320}" loading="lazy" decoding="async"></figure>`;
}
// Keep a fast reviewed map at startup and refresh it independently of app code.
export function installLunchArtwork(initial,host,styleId='abvm-maroon-tray-v1') {
  let approved=initial,inFlight=null,lastAttempt=0,onChange=null;
  function validate(data){
    if(data?.schemaVersion!==1||!data.approved||typeof data.approved!=="object"||Array.isArray(data.approved))throw Error("Invalid lunch artwork update");
    const next={};
    for(const [key,art] of Object.entries(data.approved)){
      const [sourceId,items]=JSON.parse(key);
      if(typeof sourceId!=="string"||!sourceId||!hasLunch({items})||mealSignature({sourceId,items})!==key||
        !/^assets\/lunch-art\/[a-z0-9-]+\.webp$/.test(art?.src||'')||typeof art.alt!=="string"||!art.alt||art.alt.length>1000||
        art.styleId!==styleId||art.label!=="Meal illustration"||!Number.isInteger(art.width)||art.width<1200||art.width>1600||
        !Number.isInteger(art.height)||art.height<800||art.height>1100||Math.abs(art.width/art.height-1.5)>.02||
        art.omissionNote!==trayMenuContents({items}).omissionNote)throw Error("Unreviewed lunch artwork update");
      next[key]={src:art.src,alt:art.alt,label:art.label,styleId:art.styleId,width:art.width,height:art.height,omissionNote:art.omissionNote};
    }
    return next;
  }
  function refresh(changed){
    if(typeof changed==="function")onChange=changed;
    if(inFlight)return inFlight;
    const now=Date.now(),age=now-lastAttempt;
    if(lastAttempt&&age>=0&&age<300000)return Promise.resolve(false);
    lastAttempt=now;
    inFlight=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
      try{
        const response=await host.fetch('./data/lunch-art-current.json',{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('Lunch artwork update unavailable');
        const next=validate(await response.json());
        if(JSON.stringify(next)===JSON.stringify(approved))return false;
        approved=next;onChange?.();return true;
      }catch{return false}finally{clearTimeout(timer)}
    })().finally(()=>{inFlight=null});
    return inFlight;
  }
  host.document?.addEventListener("error",event=>{if(event.target?.matches?.(".lunch-art img"))event.target.closest(".lunch-art")?.remove()},true);
  host.ABVMLunchArt=Object.freeze({html:meal=>renderLunchArtwork(meal,approved),refresh});
}
export function buildLunchArt() {
  const registry = JSON.parse(readFileSync(new URL('../pages/data/lunch-art-registry.json', import.meta.url), 'utf8'));
  const approved = approvedArtwork(catalogMeals(), registry);
  for (const art of Object.values(approved)) {
    const asset=new URL('../pages/' + art.src, import.meta.url);
    if (!existsSync(asset)) throw new Error('Reviewed artwork file is missing: ' + art.src);
    const entry=registry.artworks.find(row=>row.src===art.src);
    if(art.styleId){const bytes=readFileSync(asset);if(bytes.length>256*1024||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Tray artwork digest or size mismatch: '+art.src)}
  }
  const plan = buildArtPlan(CATALOG, registry);
  writeFileSync(new URL('../pages/data/lunch-art-plan.json', import.meta.url), JSON.stringify(plan, null, 2) + '\n');
  writeFileSync(new URL('../pages/data/lunch-art-current.json',import.meta.url),JSON.stringify({schemaVersion:1,approved},null,2)+'\n');
  writeFileSync(new URL('../pages/lunch-art.js', import.meta.url), `// Generated by scripts/build-lunch-art-plan.mjs. Edit the reviewed registry instead.\n(() => {\n${mealSignature.toString()}\n${hasLunch.toString()}\n${renderLunchArtwork.toString()}\n${trayMenuContents.toString()}\n${installLunchArtwork.toString()}\ninstallLunchArtwork(${JSON.stringify(approved)},globalThis);\n})();\n`);
  return plan;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = buildLunchArt();
  console.log(`Lunch art: ${plan.menus.filter(menu => menu.artwork).length}/${plan.menus.length} reviewed menus illustrated`);
}
