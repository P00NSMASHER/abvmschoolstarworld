import {assessDailySchoolSources} from './source-freshness-recovery.mjs';

// Homework is published independently of the teacher study pack. A green
// study-pack comparison must not conceal a stale or modified Homework feed.
export function liveHomeworkUrl(studyPackUrl) {
  const url=new URL(studyPackUrl);
  if(!url.pathname.endsWith('/data/study-pack.json')){
    throw new Error('Expected the public study-pack.json endpoint for companion Homework verification.');
  }
  url.pathname=url.pathname.slice(0,-'study-pack.json'.length)+'homework-current.json';
  url.search='';
  url.hash='';
  return url.href;
}

export function homeworkPublicationErrors(expected, published, now) {
  const availability=published!==null && published!==undefined;
  const result=assessDailySchoolSources({
    now,homework:expected,publishedHomework:published,
    curriculumLiveAvailable:false,homeworkLiveAvailable:availability
  });
  const errors=[];
  if(!result.homeworkFresh)errors.push('repository Homework source is stale or invalid');
  if(result.homeworkLiveMatches!==true){
    errors.push(availability
      ? 'deployed Homework does not match the complete verified repository posting'
      : 'deployed Homework is unavailable');
  }
  return errors;
}
