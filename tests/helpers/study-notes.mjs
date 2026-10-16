import {expect} from '@playwright/test';

// Follow the visible subject-library navigation; all content/QA assertions stay in callers.
export async function openNoteSubject(page,subject=null){
 const notes=page.locator('[data-study-notes]');
 if(!await notes.evaluate(node=>node.open))await notes.locator(':scope > summary').click();
 const selected=notes.locator('.notes-reader:not([hidden]) [data-note-subject]:not([hidden])');
 if(await selected.count()){
  if(!subject||await selected.getAttribute('data-note-subject')===subject)return notes;
  await notes.locator('[data-notes-back]').click();
 }
 const card=subject?notes.getByRole('button',{name:subject,exact:true}):notes.locator('[data-notes-subject]').first();
 await expect(card).toBeVisible();await card.click();
 await expect(notes.locator('.notes-reader:not([hidden]) [data-note-subject]:not([hidden])')).toHaveCount(1);
 return notes;
}
