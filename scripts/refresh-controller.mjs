// Read-only scheduling decisions for the school-data pipeline.
const zone='America/New_York';
const clock=new Intl.DateTimeFormat('en-US',{
  timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23',
});
export const REFRESH_SCHEDULES=Object.freeze({
  curriculum:Object.freeze([377,587,797,947]),
  homework:Object.freeze(Array.from({length:18},(_,i)=>[(i+6)*60+7,(i+6)*60+37]).flat()),
});
function localTime(value){
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const p=Object.fromEntries(clock.formatToParts(date).map(x=>[x.type,x.value]));
  return {day:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
}
export function easternSchoolDay(value){return localTime(value)?.day??null;}
function previousDay(day){
  const [year,month,date]=day.split('-').map(Number);
  return new Date(Date.UTC(year,month-1,date-1)).toISOString().slice(0,10);
}
export function scheduledSourceDue({kind,now,checkedAt}={}){
  const slots=REFRESH_SCHEDULES[kind];
  if(!slots)throw new TypeError('Unknown source kind: '+kind);
  const current=Date.parse(now||'');
  if(!Number.isFinite(current))return {due:false,reason:'invalid-clock',expectedSchoolDate:null,expectedLocalTime:null};
  const anchor=localTime(current-90*60000);
  const eligible=slots.filter(minute=>minute<=anchor.minute);
  const expectedSchoolDate=eligible.length?anchor.day:previousDay(anchor.day);
  const minute=eligible.length?eligible.at(-1):slots.at(-1);
  const expectedLocalTime=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
  const metadata={expectedSchoolDate,expectedLocalTime,graceMinutes:90,timeZone:zone};
  const checked=Date.parse(checkedAt||'');
  if(!Number.isFinite(checked))return {...metadata,due:true,reason:'missing-or-invalid-check'};
  if(checked-current>15*60000)return {...metadata,due:true,reason:'future-check'};
  const observed=localTime(checked);
  const due=observed.day<expectedSchoolDate||(observed.day===expectedSchoolDate&&observed.minute<minute);
  return {...metadata,due,reason:due?'scheduled-check-overdue':'schedule-satisfied'};
}
export function reconcileScheduledSources(assessment,{now,checkedAt={}}={}){
  const caution=[...(assessment?.caution||[])];
  if(!Number.isFinite(Date.parse(now||''))){
    return {...assessment,controllerVersion:2,phase:'evidence-incomplete',
      refreshCurriculum:false,refreshHomework:false,redeploy:false,
      caution:[...caution,'invalid-controller-clock']};
  }
  const schedule={
    curriculum:scheduledSourceDue({kind:'curriculum',now,checkedAt:checkedAt.curriculum}),
    homework:scheduledSourceDue({kind:'homework',now,checkedAt:checkedAt.homework}),
  };
  const refreshCurriculum=assessment.refreshCurriculum||schedule.curriculum.due;
  const refreshHomework=assessment.refreshHomework||schedule.homework.due;
  const phase=refreshCurriculum||refreshHomework||assessment.refreshReviewedLunch?'refresh-required':assessment.redeploy?
    'publish-required':caution.length?'evidence-incomplete':'current';
  return {...assessment,controllerVersion:2,observedAt:now,phase,schedule,
    refreshCurriculum,refreshHomework,caution};
}
