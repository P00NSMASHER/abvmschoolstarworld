import assert from 'node:assert/strict';

const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Compare the actual printed prompts and numbered key to independent source rows.
export function assertFocusedWorksheet(html,bank,expectedCount=Math.min(6,bank.length)){
  const [student,key]=html.split('<section class="sheet adult-key">');
  const printed=[...student.matchAll(/<p class="prompt"><span class="number">(\d+)\.<\/span> (.*?)<\/p>/g)];
  const answers=[...key.matchAll(/<li><b>(\d+)\.<\/b> (.*?)(?:<small |<\/li>)/g)];
  assert.equal(printed.length,expectedCount);
  assert.equal(answers.length,expectedCount);
  assert.equal(new Set(printed.map(match=>match[2])).size,expectedCount);
  return printed.map((match,index)=>{
    assert.equal(Number(match[1]),index+1);
    assert.equal(Number(answers[index][1]),index+1);
    const handwriting=match[2]==='Listen to the practice word. Write it on the lines.';
    const row=handwriting?bank.find(row=>escape(row.answer)===answers[index][2]&&/which (?:of these )?word/i.test(row.prompt))
      :bank.find(row=>escape(row.prompt)===match[2]);
    assert.ok(row,'printed prompt must belong to the assessed bank: '+match[2]);
    const letter=String.fromCharCode(65+(row.choices||[]).indexOf(row.answer));
    assert.ok([escape(row.answer),letter+'. '+escape(row.answer)].includes(answers[index][2]),row.prompt);
    return row;
  });
}
