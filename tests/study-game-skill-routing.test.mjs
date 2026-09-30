import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadEngine(){
  const source=fs.readFileSync(new URL("../pages/study-games.js",import.meta.url),"utf8");
  const context={window:{}};
  vm.runInNewContext(source,context,{filename:"pages/study-games.js"});
  return context.window.ABVMStudyGames;
}

function packWithReadingSkills(skills){
  return {
    sourceHash:"fixture-"+skills.replace(/[^a-z]+/gi,"-").toLowerCase(),
    subjects:[
      {
        subject:"Reading / ELA",
        topics:["Story: Fixture Story"],
        studyNotes:["Reading comprehension: "+skills]
      },
      {
        subject:"Math",
        topics:["Subtraction to 12"],
        studyNotes:[]
      }
    ],
    vocabulary:[]
  };
}

test("current ABVM dialogue skill generates material-specific practice",()=>{
  const engine=loadEngine();
  const catalog=engine.buildCatalog(packWithReadingSkills("Visualize, theme, dialogue"),{sourceKey:"current-dialogue"});
  const material=catalog.questions.filter(question=>question.tier==="material"&&question.subject==="Reading / ELA");
  assert.ok(material.some(question=>question.skill==="visualize"));
  assert.ok(material.some(question=>question.skill==="theme"));
  const dialogue=material.filter(question=>question.skill==="dialogue");
  assert.equal(dialogue.length,3);
  assert.ok(dialogue.every(question=>/dialogue/i.test(question.sourceFact)));
  assert.ok(dialogue.every(question=>!engine.FORBIDDEN.some(pattern=>pattern.test(question.prompt))));
});

test("rotating Grade 2 comprehension skills route to original material practice",()=>{
  const engine=loadEngine();
  const catalog=engine.buildCatalog(
    packWithReadingSkills("character feelings, main character, setting, cause/effect, inference, genre"),
    {sourceKey:"rotation-fixture"}
  );
  const skills=new Set(
    catalog.questions
      .filter(question=>question.tier==="material"&&question.subject==="Reading / ELA")
      .map(question=>question.skill)
  );
  for(const expected of ["character-feelings","main-character","setting","cause-effect","inference","genre"]){
    assert.ok(skills.has(expected),"missing material skill: "+expected);
  }
});

test("material routing follows verified skills instead of labeling generic reading as current",()=>{
  const engine=loadEngine();
  const catalog=engine.buildCatalog(packWithReadingSkills("dialogue"),{sourceKey:"dialogue-only"});
  const materialReading=catalog.questions.filter(
    question=>question.tier==="material"&&question.subject==="Reading / ELA"
  );
  assert.deepEqual([...new Set(materialReading.map(question=>question.skill))],["dialogue"]);
  assert.ok(catalog.questions.some(question=>question.tier==="star-fallback"));
  assert.equal(engine.validateCatalog(catalog).length,0);
});
