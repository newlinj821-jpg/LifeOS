/* Pure LifeOS calendar sharing and iCalendar serialization; does not access private browser records. */
export const ID_PATTERN=/^[a-zA-Z0-9_-]{24,64}$/;
export const UTC_PATTERN=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MS=86400000;
export function cleanCalendarEvents(input){
 const seen=new Set(),out=[];
 for(const x of Array.isArray(input)?input.slice(0,1200):[]){
  if(!x||typeof x!=='object'||typeof x.uid!=='string'||!/^[a-zA-Z0-9:_-]{5,140}$/.test(x.uid)||seen.has(x.uid))continue;
  const start=String(x.start||''),end=String(x.end||'');
  if(!UTC_PATTERN.test(start)||!UTC_PATTERN.test(end))continue;
  const a=Date.parse(start),b=Date.parse(end);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>7*DAY_MS)continue;
  const valid=s=>typeof s==='string'?s.slice(0,180).replace(/[\u0000-\u001f\u007f]/g,' ').trim():'';
  const title=valid(x.title)||'Busy',location=valid(x.location||'');
  seen.add(x.uid);out.push({uid:x.uid,start:new Date(a).toISOString(),end:new Date(b).toISOString(),title,location});
  if(out.length>=750)break;
 }
 return out.sort((a,b)=>a.start.localeCompare(b.start));
}
export function escapeICSText(text){
 return String(text??'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
}
export function foldICSLine(line){
 // RFC 5545: 75 octets maximum per physical content line, with CRLF and one space at continuation.
 let lines=[''],used=0;
 for(const char of String(line)){
  const len=Buffer.byteLength(char,'utf8');
  if(used+len>75){lines.push(' ');used=1;}
  lines[lines.length-1]+=char;used+=len;
 }
 return lines.join('\r\n');
}
const stamp=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function generateICS(events,{name='LifeOS Calendar',calendarId='lifeos',updatedAt=Date.now()}={}){
 const safeName=String(name).slice(0,80).replace(/[\r\n]/g,' ');
 const lines=[
  'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LifeOS//Calendar Share//EN','CALSCALE:GREGORIAN',
  'METHOD:PUBLISH','X-WR-CALNAME:'+escapeICSText(safeName),
  'X-PUBLISHED-TTL:PT6H','REFRESH-INTERVAL;VALUE=DURATION:PT6H'
 ];
 for(const e of cleanCalendarEvents(events)){
  const uid=e.uid+'@calendar.lifeos.local';
  lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+stamp(updatedAt),
   'DTSTART:'+stamp(e.start),'DTEND:'+stamp(e.end),
   'SUMMARY:'+escapeICSText(e.title));
  if(e.location)lines.push('LOCATION:'+escapeICSText(e.location));
  lines.push('STATUS:CONFIRMED','TRANSP:OPAQUE','END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 return lines.map(foldICSLine).join('\r\n')+'\r\n';
}
export function calendarPreview(input,{shareNames=false,shareLocations=false}={}){
 return cleanCalendarEvents(input).map(e=>({...e,title:shareNames?e.title:'Busy',location:shareNames&&shareLocations?e.location:''}));
}
