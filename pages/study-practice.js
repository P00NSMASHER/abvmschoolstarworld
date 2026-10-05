(()=>{
"use strict";
const esc=s=>String(s??"").replace(/[&<>"\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "\'":"&#39;"}[c]));
const SUBJECT_PRACTICE=Object.freeze({
  math:{mode:"math",label:"Math Dash",focus:"Build number sense",notes:["Place value: 462 has 4 hundreds, 6 tens, and 2 ones. The 6 is worth 60.","Add by making a ten: 38 + 7 = 38 + 2 + 5 = 45.","Subtract in parts: 52 − 18 = 52 − 10 − 8 = 34. Check: 34 + 18 = 52.","Read a word problem twice. Decide what changes, then label your answer."],question:"A class has 24 pencils, gets 13 more, then uses 8. How many are left?",answer:"29 pencils. First 24 + 13 = 37. Then 37 − 8 = 29."},
  reading:{mode:"words",label:"Word Power",focus:"Find clues in the text",notes:["Tell who the passage is about and what happens first, next, and last.","Find the main idea: what are most of the sentences telling you?", "Use a detail from the passage to explain your answer."],question:"Mia put on boots and opened her umbrella before going outside. What is the weather probably like?",answer:"It is probably raining. The boots and umbrella are clues; the passage does not say it directly."},
  spelling:{mode:"words",label:"Word Power",focus:"Listen, build, and read",notes:["Compare cap and cape: final silent e changes the vowel sound.","Read play, played, and playing. The ending changes when the action happens.","Say a word slowly, write its sounds, then read it back in a sentence."],question:"Which word has the same long-a sound as cake: cap, rain, or cat?",answer:"Rain. Both rain and cake have the long-a sound, even though it is spelled differently."},
  sight:{mode:"words",label:"Word Power",focus:"Read words in a sentence",notes:["Practice: because, before, after, could, would, and should.","Read: Before we play, we should put our books away.","Say a new sentence using because. Explain why something happens."],question:"Fill the gap: I wore a coat ___ it was cold. Choose before, because, or after.",answer:"Because. It connects wearing the coat with the reason: it was cold."},
  vocabulary:{mode:"words",label:"Word Power",focus:"Use context clues",notes:["Look at the words around an unfamiliar word for clues to its meaning.","Compare words: tiny and small mean nearly the same thing; tiny and huge are opposites.","Try your meaning in the sentence to check that it makes sense."],question:"The puppy was drowsy. It yawned and curled up to sleep. What does drowsy mean?",answer:"Sleepy. Yawning and getting ready to sleep help you work out the meaning."},
  religion:{mode:"words",label:"Word Power",focus:"Reading practice while you wait",notes:["No current Religion notes are posted. Use this short reading activity to build comprehension.","Read: Leo saw a new child sitting alone. He invited her to join his game. Soon they were both smiling.","Retell the beginning, middle, and end. Use a detail to explain how the characters feel."],question:"What did Leo do that helped the new child feel welcome?",answer:"He invited her to join his game. Their smiles are a clue that they enjoyed playing together."}
});
function studyNotes(subject){
  return [...(Array.isArray(subject?.topics)?subject.topics:[]),...(Array.isArray(subject?.studyNotes)?subject.studyNotes:[])]
    .filter(n=>typeof n==="string"&&n.trim()).map(n=>n.trim());
}
function subjectPracticeHtml(key){
  const p=SUBJECT_PRACTICE[key]||SUBJECT_PRACTICE.reading;
  return '<div class="subject-practice"><p class="practice-origin">'+(key==="religion"?'Reading enrichment':'Grade 2 STAR-style practice')+'</p><h3>'+esc(p.focus)+'</h3><ul>'+p.notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul><div class="practice-example"><strong>Try it together</strong><p>'+esc(p.question)+'</p><details class="practice-answer"><summary>Show answer & explanation</summary><p>'+esc(p.answer)+'</p></details></div><button type="button" data-subject-practice="'+p.mode+'">Practice with '+p.label+' <span aria-hidden="true">›</span></button><p class="practice-source-note">Original skill practice, not a teacher assignment or an official STAR test item.</p></div>';
}
window.ABVMStudyPractice=Object.freeze({notes:studyNotes,html:subjectPracticeHtml});
})();
