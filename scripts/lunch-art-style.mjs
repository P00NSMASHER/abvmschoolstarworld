// Privacy-safe description of the tray visible in the user's two references.
// Reference originals contain people and must never enter the public repository.
export const TRAY_STYLE_ID = 'abvm-maroon-tray-v1';
export const TRAY_REFERENCE_ASSET = 'assets/lunch-art/tray-2026-10-16-v1.webp';
export const TRAY_STYLE_PROMPT = 'High-quality photorealistic food illustration, landscape 3:2. Entire burgundy/maroon molded cafeteria tray, rounded corners, thick raised rolled rim, subtle speckled plastic and shallow divided wells, on a cobalt-blue laminate table. Elevated three-quarter overhead view, soft neutral daylight, crisp natural food texture. Small plain clear unbranded side cups are permitted. No people, private reference pixels, room landmarks, text, logos, branded cartons or drinks. The white disposable bowl in the original references is not the requested tray. Illustrative appearance and portions, never an actual school-meal photograph.';
export function trayMenuContents(menu) {
  const foods=[],omitted=[];
  for(const item of menu.items||[]) {
    if(/^(?:(?:fresh|seasonal|assorted|mixed)\s+)?fruit(?:\s+cup)?$/i.test(item))omitted.push('Fruit variety not specified; fruit not pictured.');
    else if(/^dipping sauce$/i.test(item))omitted.push('Dipping sauce variety not specified; sauce not pictured.');
    else if(/^Taco Tuesday(?:\s*&\s*chips)?$/i.test(item)) {
      if(/chips/i.test(item))foods.push('Tortilla chips');
      omitted.push('Taco filling not specified; chips and named sides shown.');
    } else foods.push(item);
  }
  const omissionNote=omitted.join(' ');
  return {foods,omissionNote};
}
export function trayMenuSpec(menu){
  const {foods,omissionNote}=trayMenuContents(menu);
  return {foods,omissionNote,prompt:TRAY_STYLE_PROMPT+' Replace ALL food in the style reference with ONLY: '+foods.join('; ')+'. No unlisted foods, toppings, herbs, garnishes or condiments. '+omissionNote+' Keep ambiguous ingredients unpictured; never invent their identity. Inspect every output against this exact menu before approval, correcting any extra or missing named food. Use the approved generated reference asset for tray/camera consistency; never publish private reference photos.'};
}
