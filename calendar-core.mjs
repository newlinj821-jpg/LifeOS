/* LifeOS calendar interoperability: pure helpers, safe for browser and Netlify. */
const isoOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s));
const dateOk=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'));
const clean=s=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(Number(n))?Number(n):a));
const stableId=s=>clean(s).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,90);
export const calendarLimits=Object.freeze({maxEvents:250,maxTitle:140,maxDescription:500,maxBytes:1250000});
export function localCalendarEntries(items,{includeTasks=false,details=false,busyOnly=false}={}){
 const accepted=new Set(includeTasks?['event','task','chore']:['event']);
 return (Array.isArray(items)?items:[]).filter(x=>x&&accepted.has(x.kind)&&x.dueAt&&!x.done).map(x=>{
  if(typeof x.dueAt!=='string')return null;
  const allDay=Boolean(x.allDay)&&/^\d{4}-\d{2}-\d{2}/.test(x.dueAt);
  const start=new Date(x.dueAt);
  if(!Number.isFinite(+start)||start.getFullYear()<1990||start.getFullYear()>2100)return null;
  const duration=clamp(x.duration||60,5,1440);
  const end=new Date(start.getTime()+duration*60000);
  const id=stableId(x.id);
  if(!id)return null;
  const name=busyOnly?'Busy':clean(x.title||'Untitled event').slice(0,calendarLimits.maxTitle);
  return {id,title:name||'Busy',startUTC:start.toISOString(),endUTC:end.toISOString(),
   allDay,day:allDay?x.dueAt.slice(0,10):undefined,kind:x.kind,
   description:details&&!busyOnly?clean(x.details||x.notes||'').slice(0,calendarLimits.maxDescription):'',
   location:details&&!busyOnly?clean(x.location||'').slice(0,120):'',
   repeat:['daily','weekly','monthly','yearly'].includes(x.repeat)?x.repeat:'none'};
 }).filter(Boolean).slice(0,calendarLimits.maxEvents);
}
export function validatePublished(input){
 const used=new Set();
 return (Array.isArray(input)?input:[]).slice(0,calendarLimits.maxEvents).map(x=>{
  if(!x||!stableId(x.id)||!isoOk(x.startUTC)||!isoOk(x.endUTC))return null;
  const start=Date.parse(x.startUTC),end=Date.parse(x.endUTC);
  if(end<=start||end-start>7*86400000||new Date(start).getUTCFullYear()>2100||new Date(start).getUTCFullYear()<1990)return null;
  const id=stableId(x.id);if(used.has(id))return null;used.add(id);
  const allDay=!!x.allDay&&dateOk(x.day);
  return {id,title:clean(x.title||'Busy').slice(0,calendarLimits.maxTitle)||'Busy',
   startUTC:new Date(start).toISOString(),endUTC:new Date(end).toISOString(),
   allDay,day:allDay?x.day:undefined,description:clean(x.description).slice(0,calendarLimits.maxDescription),
   location:clean(x.location).slice(0,120),
   repeat:['daily','weekly','monthly','yearly'].includes(x.repeat)?x.repeat:'none'};
 }).filter(Boolean);
}
const esc=v=>String(v??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const unesc=v=>String(v??'').replace(/\\([nN,;\\])/g,(_,x)=>/[nN]/.test(x)?'\n':x);
const stamp=iso=>new Date(iso).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const dayStamp=date=>date.replaceAll('-','');
const dayAfter=date=>new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
function fold(line){
 let out='',bytes=0;
 for(const ch of line){
  const amount=new TextEncoder().encode(ch).length;
  if(bytes+amount>72){out+='\r\n ';bytes=1;}
  out+=ch;bytes+=amount;
 }
 return out;
}
export function makeICS(records,{name='LifeOS Shared Calendar',now=new Date().toISOString()}={}){
 const data=validatePublished(records);
 let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LifeOS//Personal Calendar 1.0//EN','CALSCALE:GREGORIAN',
  'METHOD:PUBLISH','X-WR-CALNAME:'+esc(clean(name).slice(0,80)),'REFRESH-INTERVAL;VALUE=DURATION:PT6H'];
 const at=stamp(now);
 for(const e of data){
  const start=e.allDay?'DTSTART;VALUE=DATE:'+dayStamp(e.day):'DTSTART:'+stamp(e.startUTC);
  const finish=e.allDay?'DTEND;VALUE=DATE:'+dayStamp(dayAfter(e.day)):'DTEND:'+stamp(e.endUTC);
  lines.push('BEGIN:VEVENT','UID:lifeos-'+e.id+'@lifeos','DTSTAMP:'+at,start,finish,
   'SUMMARY:'+esc(e.title),'STATUS:CONFIRMED','TRANSP:OPAQUE');
  if(e.description)lines.push('DESCRIPTION:'+esc(e.description));
  if(e.location)lines.push('LOCATION:'+esc(e.location));
  if(e.repeat!=='none')lines.push('RRULE:FREQ='+e.repeat.toUpperCase());
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return lines.map(fold).join('\r\n')+'\r\n';
}
function parseTime(value,params=''){
 const str=String(value||'').trim();
 if(/^\d{8}$/.test(str)){
  const date=str.slice(0,4)+'-'+str.slice(4,6)+'-'+str.slice(6,8);
  return dateOk(date)?{date:date+'T09:00',allDay:true,day:date,epoch:Date.parse(date+'T09:00:00')}:null;
 }
 if(!/^\d{8}T\d{6}Z?$/.test(str))return null;
 const year=+str.slice(0,4),mon=+str.slice(4,6),day=+str.slice(6,8),h=+str.slice(9,11),m=+str.slice(11,13),sec=+str.slice(13,15);
 if(mon<1||mon>12||day<1||day>31||h>23||m>59||sec>59)return null;
 let valueDate;
 if(str.endsWith('Z'))valueDate=new Date(Date.UTC(year,mon-1,day,h,m,sec));
 else {
  const tzMatch=String(params).match(/TZID=([^;:]+)/i);
  if(tzMatch){
   const tz=tzMatch[1];
   try{
    const guessed=Date.UTC(year,mon-1,day,h,m,sec);
    const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const parts=Object.fromEntries(formatter.formatToParts(new Date(guessed)).map(x=>[x.type,x.value]));
    const actual=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second);
    valueDate=new Date(guessed-(actual-guessed));
   }catch{return null;}
  }else valueDate=new Date(year,mon-1,day,h,m,sec);
 }
 if(!Number.isFinite(+valueDate)||valueDate.getFullYear()<1990||valueDate.getFullYear()>2100)return null;
 const local=valueDate.getFullYear()+'-'+String(valueDate.getMonth()+1).padStart(2,'0')+'-'+String(valueDate.getDate()).padStart(2,'0')+
  'T'+String(valueDate.getHours()).padStart(2,'0')+':'+String(valueDate.getMinutes()).padStart(2,'0');
 return {date:local,allDay:false,epoch:+valueDate};
}
export function parseICS(ics,{max=calendarLimits.maxEvents}={}){
 if(typeof ics!=='string'||ics.length>calendarLimits.maxBytes||!/BEGIN:VCALENDAR/i.test(ics))throw Error('Choose a valid .ics calendar file (maximum 1.25 MB).');
 const lines=ics.replace(/\r\n[ \t]|\n[ \t]/g,'').split(/\r?\n/);
 const results=[];let current=null;
 for(const raw of lines){
  if(raw==='BEGIN:VEVENT'){current={};continue;}
  if(raw==='END:VEVENT'){
   if(current&&current.start&&current.title){
    const end=current.end;
    const minutes=end&&!current.start.allDay?clamp(Math.round((end.epoch-current.start.epoch)/60000),5,1440):60;
    const freq=/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(?:;|$)/i.exec(current.rrule||'');
    const interval=/INTERVAL=(\d+)/i.exec(current.rrule||'');
    results.push({title:current.title.slice(0,calendarLimits.maxTitle),dueAt:current.start.date,
     allDay:current.start.allDay,duration:minutes,
     location:current.location||'',details:current.description||'',
     repeat:freq&&(!interval||+interval[1]===1)?freq[1].toLowerCase():'none',
     externalUID:current.uid||''});
    if(results.length>=Math.min(max,calendarLimits.maxEvents))break;
   }
   current=null;continue;
  }
  if(!current)continue;
  const j=raw.indexOf(':');if(j<=0)continue;
  const head=raw.slice(0,j),val=raw.slice(j+1),name=head.split(';')[0].toUpperCase();
  if(name==='SUMMARY')current.title=clean(unesc(val));
  if(name==='UID')current.uid=clean(val).slice(0,160);
  if(name==='DTSTART')current.start=parseTime(val,head);
  if(name==='DTEND')current.end=parseTime(val,head);
  if(name==='DESCRIPTION')current.description=unesc(val).slice(0,calendarLimits.maxDescription);
  if(name==='LOCATION')current.location=clean(unesc(val)).slice(0,120);
  if(name==='RRULE')current.rrule=val;
 }
 return results;
}
