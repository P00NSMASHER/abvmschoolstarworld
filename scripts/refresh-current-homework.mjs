import {readFileSync,writeFileSync} from 'node:fs';
import {pageLines} from './teacher-page-parsers.mjs';
import {HOMEWORK_SOURCE_URL,summarizeTeacherHomework,shouldPublishHomework} from './homework-posting.mjs';

const destination=new URL('../pages/data/homework-current.json',import.meta.url);
let previous=null;
try{previous=JSON.parse(readFileSync(destination,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let html=null, lastError=null;
for(let i=0;i<3;i++){
  try{
    const response=await fetch(HOMEWORK_SOURCE_URL,{
      headers:{accept:'text/html','user-agent':'ABVM-Parent-Companion/1.0'},
      redirect:'follow',signal:AbortSignal.timeout(25000)});
    if(!response.ok || new URL(response.url).hostname==='accounts.google.com')throw Error('Teacher Homework page is not publicly available: '+response.status);
    html=await response.text();
    break;
  }catch(error){lastError=error;if(i<2)await new Promise(resolve=>setTimeout(resolve,(i+1)*1500));}
}
if(html===null)throw new Error('Unable to verify Homework page: '+lastError?.message);
const lines=pageLines(html);
const posting=summarizeTeacherHomework(lines,new Date().toISOString(),previous);
const publish=shouldPublishHomework(posting,previous);
if(process.argv.includes('--dry-run')){
  console.log(JSON.stringify({publish,posting},null,2));
}else if(publish){
  writeFileSync(destination,JSON.stringify(posting,null,2)+'\n','utf8');
  console.log('Verified official Homework posting: '+posting.status+'; '+posting.assignments.length+' specific assignment(s).');
}else{
  console.log('Homework content unchanged; source checked successfully, within 18-hour freshness interval.');
}
