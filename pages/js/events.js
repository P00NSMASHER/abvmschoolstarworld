export function kindClass(item){
  const k=(item?.kind||"").toLowerCase(),l=(item?.label||"").toLowerCase();
  if(/no school|school closed|closed|holiday/.test(l)||/holiday|closed/.test(k))return"closed";
  if(/12:00|noon|early dismissal|half day/.test(l)||/schedule change/.test(k))return"halfday";
  if(/picture day|school picture|portraits?/.test(l))return"picture";
  if(/dress down|dress-down/.test(l))return"dress";
  if(/conference/.test(k)||/conference/.test(l))return"conference";
  if(/progress report|report card/.test(l))return"report";
  if(/test|assessment/.test(k)||/test|star reading|star testing/.test(l))return"test";
  if(/mass|relig|faith/.test(k)||/mass|church/.test(l))return"faith";
  if(/deadline|due/.test(k)||/due|money|order|rsvp/.test(l))return"due";
  if(/club/.test(k)||/lego/.test(l))return"club";
  if(/party|dance|santa workshop|movie night|family night|s’more|smore/.test(l))return"celebration";
  if(/meeting/.test(k)||/meeting/.test(l))return"meeting";
  return"school";
}

export function eventIconName(item){
  const k=kindClass(item),l=(item?.label||"").toLowerCase();
  if(k==="picture")return"camera";
  if(k==="halfday")return"clock";
  if(k==="closed")return"ban";
  if(k==="conference"||k==="meeting")return"users";
  if(k==="dress")return"shirt";
  if(k==="report")return"report";
  if(k==="celebration")return"party";
  if(/reading/.test(l))return"book";
  if(/spelling|handwriting/.test(l))return"pencil";
  if(/math|addition|subtraction/.test(l))return"math";
  if(k==="faith")return"cross";
  if(k==="due")return"pin";
  if(k==="test")return"document";
  return"calendar";
}

export function specialIconName(name){
  const s=String(name||"").toLowerCase();
  if(/mass|church/.test(s))return"cross";
  if(/gym/.test(s))return"gym";
  if(/art/.test(s))return"palette";
  if(/music/.test(s))return"music";
  if(/computer/.test(s))return"computer";
  if(/library/.test(s))return"library";
  return"star";
}

export function calendarLabel(item){
  const k=kindClass(item),raw=String(item?.label||"School event");
  if(k==="halfday")return"Half Day";
  if(k==="closed")return"No School";
  if(k==="conference")return"Conference";
  if(k==="report")return"Progress Reports";
  if(k==="picture")return"Picture Day";
  if(k==="dress")return"Dress";
  if(k==="test")return /star/i.test(raw)?"STAR Testing":"Test";
  if(k==="due")return"Due";
  if(k==="meeting")return"Meeting";
  if(k==="club")return"Lego Club";
  if(k==="celebration"){
    if(/halloween/i.test(raw))return"Halloween";
    if(/dance/i.test(raw))return"Dance";
    if(/movie/i.test(raw))return"Movie Night";
    return"Special Event";
  }
  if(k==="faith")return"Mass";
  if(/catholic schools week/i.test(raw))return"Catholic Schools";
  if(/santa workshop/i.test(raw))return"Santa Workshop";
  if(/last day/i.test(raw))return"Last Day";
  if(/weather makeup/i.test(raw))return"Weather Day";
  return raw.length>18?raw.slice(0,16).trim()+"…":raw;
}

export function primaryCalendarEvent(events){
  const rank={closed:0,halfday:1,picture:2,dress:3,conference:4,report:5,test:6,due:7,celebration:8,faith:9,club:10,meeting:11,school:12};
  return [...events].sort((a,b)=>(rank[kindClass(a)]??99)-(rank[kindClass(b)]??99))[0]||null;
}

export function calendarScheduleEvent(events){
  return events.find(e=>kindClass(e)==="closed")||events.find(e=>kindClass(e)==="halfday")||null;
}

export function scheduleSecondaryEvents(item){
  if(!item||kindClass(item)!=="halfday")return[];
  const label=String(item.label||"");
  const lower=label.toLowerCase(),out=[];
  if(/progress report/.test(lower)){
    const progressLabel=(label.match(/[^;]*progress reports?/i)||["Progress Reports"])[0].trim();
    out.push({...item,label:progressLabel,kind:"school"});
  }
  if(/articulation meeting/.test(lower))out.push({...item,label:"Articulation Meeting",kind:"meeting"});
  if(/last day/.test(lower))out.push({...item,label:"Last Day of School",kind:"school event"});
  return out;
}

export function calendarContentEvents(events){
  const out=[];
  for(const e of events){
    const k=kindClass(e);
    if(k==="closed"||k==="halfday")out.push(...scheduleSecondaryEvents(e));
    else out.push(e);
  }
  return out;
}

export function scheduleStatusText(item){
  if(!item)return"";
  return kindClass(item)==="closed"?"No School":"Half Day";
}
export function scheduleStatusDetail(item){
  if(!item)return"";
  return kindClass(item)==="closed"?"School is closed":"Dismissal at 12:00 PM";
}

export function normalizedCalendarDetail(value){
  return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
export function sameCalendarDetail(a,b){
  const left=normalizedCalendarDetail(a),right=normalizedCalendarDetail(b);
  if(!left||!right)return false;
  if(left===right)return true;
  const single=right.split(" ").length===1?right:(left.split(" ").length===1?left:"");
  const full=single===right?left:right;
  return Boolean(single&&single.length>=3&&new RegExp("(?:^|\\s)"+single+"(?:$|\\s)").test(full));
}
export function calendarDetailKicker(item){
  const k=kindClass(item);
  if(k==="test")return"TEST / ASSESSMENT";
  if(k==="due")return"REMINDER";
  if(k==="club")return"CLUB";
  if(k==="meeting")return"SCHOOL MEETING";
  if(k==="conference")return"CONFERENCE";
  if(k==="report")return"SCHOOL UPDATE";
  if(k==="picture")return"PICTURE DAY";
  if(k==="dress")return"DRESS DOWN";
  if(k==="faith")return"FAITH";
  return"SCHOOL EVENT";
}
export function taskIconName(item){
  const s=((item?.subject||"")+" "+(item?.task||"")).toLowerCase();
  if(/read/.test(s))return"book";
  if(/spell/.test(s))return"pencil";
  if(/math/.test(s))return"math";
  if(/folder/.test(s))return"folder";
  if(/form|cover/.test(s))return"document";
  return"check";
}
export function calendarCellLabel(item,special){
  if(!item){
    const s=String(special||"").split(",")[0].trim();
    if(/computer/i.test(s))return"Comp.";
    if(/music/i.test(s))return"Music";
    if(/mass/i.test(s))return"Mass";
    if(/gym/i.test(s))return"Gym";
    if(/library/i.test(s))return"Library";
    return s.length>12?s.slice(0,11).trim()+"…":s;
  }
  const k=kindClass(item),p=String(item.label||"");
  if(/star/i.test(p))return"STAR";
  if(k==="dress")return"Dress Down";
  if(k==="picture")return"Picture Day";
  if(k==="test")return"Test";
  if(k==="due")return"Due";
  if(k==="club")return"Club";
  if(k==="meeting")return"Meeting";
  if(k==="conference")return"Conference";
  if(k==="report")return"Progress";
  if(k==="faith"||/mass/i.test(p))return"Mass";
  if(k==="celebration")return"Event";
  const label=calendarLabel(item);
  return label.split(/\s+/).slice(0,2).join(" ");
}
