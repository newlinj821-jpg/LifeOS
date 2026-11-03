/* LifeOS calendar link: read-only, opt-in, designed for installable iPhone/Android PWA. */
(() => {
'use strict';
const STORAGE='lifeos.calendarShare.v1';
const endpoint='/.netlify/functions/calendar-share';
const $=sel=>document.querySelector(sel);
let share=null,busy=false,notice='',status='idle',syncTimer=0,lastFingerprint='',showInviteInfo=false;
try{const v=JSON.parse(localStorage.getItem(STORAGE));if(v&&/^[A-Za-z0-9_-]{24,64}$/.test(v.id)&&/^[a-f0-9]{64}$/.test(v.manageToken))share=v;}catch{}
const source=()=>db.items.filter(x=>x&&x.kind==='event'&&x.dueAt&&x.title);
const link=()=>share?location.origin+'/.netlify/functions/calendar-share?id='+encodeURIComponent(share.id):'';
const utc=d=>new Date(d).toISOString();
const dateEnd=(start,min)=>new Date(start.getTime()+Math.max(15,Math.min(10080,Number(min)||60))*60000);
function collect(){
 const today=new Date(),begin=new Date(today);begin.setDate(begin.getDate()-31);
 const until=new Date(today);until.setMonth(until.getMonth()+18);
 const out=[];
 for(const item of source()){
  const start=new Date(item.dueAt);if(!Number.isFinite(+start))continue;
  const frequency=String(item.repeat||'none');
  const add=d=>{
   if(d<begin||d>until||out.length>=750)return;
   out.push({uid:('item_'+item.id+(frequency==='none'?'':'_'+d.getFullYear()+'_'+(d.getMonth()+1)+'_'+d.getDate())).replace(/[^A-Za-z0-9:_-]/g,'').slice(0,130),
    start:utc(d),end:utc(dateEnd(d,item.duration)),title:String(item.title).slice(0,140),location:String(item.location||'').slice(0,140)});
  };
  if(frequency==='none'){add(start);continue;}
  let date=new Date(start),count=0;
  while(date<=until&&count<720&&out.length<750){
   if((frequency!=='weekdays'||(date.getDay()>0&&date.getDay()<6)))add(date);
   const next=new Date(date);count++;
   if(frequency==='daily'||frequency==='weekdays')next.setDate(next.getDate()+1);
   else if(frequency==='weekly')next.setDate(next.getDate()+7);
   else if(frequency==='monthly'){
    const target=start.getDate();
    next.setDate(1);next.setMonth(next.getMonth()+1);
    next.setDate(Math.min(target,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()));
   }else if(frequency==='yearly'){
    next.setDate(1);next.setFullYear(next.getFullYear()+1);
    next.setMonth(start.getMonth());
    next.setDate(Math.min(start.getDate(),new Date(next.getFullYear(),start.getMonth()+1,0).getDate()));
   }else break;
   if(+next<=+date)break;
   date=next;
  }
 }
 return out.sort((a,b)=>a.start.localeCompare(b.start)).slice(0,750);
}
function published(events,names,locations){return events.map(e=>({...e,title:names?e.title:'Busy',location:names&&locations?e.location:''}));}
function fingerprint(events){
 // This is only a local change detector. Private schedule details are not placed in logs.
 return JSON.stringify([events,share?.shareNames,share?.shareLocations]);
}
function saveShare(newData){
 share=newData;
 if(newData)localStorage.setItem(STORAGE,JSON.stringify(newData));
 else localStorage.removeItem(STORAGE);
}
async function request(action,extra={}){
 const payload={action,...extra};
 if(share&&action!=='create')Object.assign(payload,{id:share.id,manageToken:share.manageToken});
 const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 let data={};try{data=await r.json();}catch{}
 if(!r.ok){const e=new Error(data.error||'Calendar service returned '+r.status);e.code=data.code||'SERVER_ERROR';throw e;}
 return data;
}
function panel(){
 const count=source().length,shared=share!==null,sensitive=shared&&(share.shareNames||share.shareLocations);
 const toggle=shared?'':'<div class="calendar-share-privacy"><label class="toggle-line"><div><strong>Show event titles</strong><p>Off means subscribers see only “Busy.”</p></div><input type="checkbox" id="shareNames" class="toggle"></label>'+
  '<label class="toggle-line"><div><strong>Include event locations</strong><p>Only available when sharing event titles.</p></div><input type="checkbox" id="shareLocations" class="toggle" disabled></label></div>';
 const summary=shared?'<div class="calendar-share-ready"><span class="calendar-share-dot"></span><strong>Private subscription link active</strong><small>'+count+' calendar entries · '+(share.shareNames?'Titles visible':'Busy only')+(share.shareLocations?' · Locations visible':'')+'</small></div>':
 '<p class="fine">Give someone a subscription link to view your LifeOS calendar in Apple Calendar, Google Calendar, or another compatible app. They cannot edit your events.</p>';
 const controls=shared?
  '<div class="calendar-link-group"><input class="field" id="shareLinkField" readonly aria-label="Calendar subscription link" value="'+safe(link())+'"><button type="button" class="primary-btn" data-life-cal="copy">Copy link</button></div>'+
  '<div class="calendar-share-actions"><button type="button" class="outline-btn" data-life-cal="share">Share link</button>'+
  '<button type="button" class="outline-btn" data-life-cal="sync">Update shared calendar</button>'+
  '<button type="button" class="danger-btn" data-life-cal="revoke">Turn off sharing</button></div>'+
  '<p class="fine calendar-share-hint">Anyone with this link can view what you chose to share. To change what they see, turn off sharing and create a new link.</p>':
  toggle+'<div class="calendar-share-actions"><button type="button" class="primary-btn" data-life-cal="create">Create a private calendar link</button>'+
  '<button type="button" class="outline-btn" data-life-cal="download">Download .ics</button></div>';
 return '<section class="panel panel-pad calendar-share-panel"><div class="calendar-share-header"><div class="calendar-share-header-icon">▦</div><div><div class="eyebrow">CONNECT YOUR CALENDAR</div><h2>Share your schedule</h2></div></div>'+
  summary+controls+
  '<details class="calendar-share-help" '+(showInviteInfo?'open':'')+'><summary>How does someone connect?</summary>'+
  '<div class="calendar-share-instructions"><strong>iPhone / Apple Calendar</strong><p>Calendar → Calendars → Add Calendar → Add Subscription Calendar → paste the link.</p>'+
  '<strong>Google Calendar</strong><p>On a computer: Google Calendar → Other calendars → + → From URL → paste the link. It then appears on the subscriber’s devices.</p>'+
  '<p class="fine">Subscriptions are read-only and each calendar provider decides when to refresh. Changes to LifeOS events are published while this device is online and the app syncs; there is no live cloud account sync.</p></div></details>'+
  '<div class="calendar-share-tools"><button type="button" class="outline-btn" data-life-cal="import">Import .ics events</button>'+
  (shared?'<button type="button" class="outline-btn" data-life-cal="download">Download .ics</button>':'')+'</div>'+
  '<input id="lifeCalendarFile" type="file" accept=".ics,text/calendar" hidden>'+
  (notice?'<p class="calendar-share-message" role="status">'+safe(notice)+'</p>':'')+'</section>';
}
const baseCalendar=calendarPage;
calendarPage=function(){
 const html=baseCalendar();
 const point=html.indexOf('<div class="grid-two">');
 return point<0?html:html.slice(0,point)+panel()+html.slice(point);
};
function redraw(){if(currentPage==='calendar')render();}
async function create(){
 if(busy)return;
 const showNames=!!$('#shareNames')?.checked,showLocations=showNames&&!!$('#shareLocations')?.checked;
 if(!confirm('Create a read-only calendar link? Anyone who receives the link can view '+(showNames?'your event titles'+(showLocations?' and locations':''):'when you are busy')+'. You can disable it later.'))return;
 busy=true;notice='Creating your calendar link…';redraw();
 try{
  const events=published(collect(),showNames,showLocations),data=await request('create',{events,shareNames:showNames,shareLocations:showLocations});
  saveShare({id:data.id,manageToken:data.manageToken,shareNames:showNames,shareLocations:showLocations,updatedAt:data.updatedAt});
  lastFingerprint=fingerprint(events);
  notice='Your read-only link is ready to copy and share.';
 }catch(e){notice='Could not create calendar link: '+String(e.message||e);}
 finally{busy=false;redraw();}
}
async function sync(silent=true){
 if(!share||busy||!navigator.onLine)return;
 const events=published(collect(),share.shareNames,share.shareLocations),current=fingerprint(events);if(silent&&current===lastFingerprint)return;
 busy=true;
 try{
  const result=await request('sync',{events,shareNames:share.shareNames,shareLocations:share.shareLocations});
  share.updatedAt=result.updatedAt;saveShare(share);lastFingerprint=current;
  if(!silent){notice='Shared calendar updated with '+result.eventCount+' upcoming events.';redraw();}
 }catch(e){
  if(!silent||e.code==='UNAUTHORIZED'||e.code==='LINK_EXPIRED'){
   notice='Calendar sync failed: '+String(e.message||e);redraw();
  }
 }finally{busy=false;}
}
async function statusCheck(){
 if(!share||!navigator.onLine)return;
 try{const result=await request('status');if(result.ok){share.updatedAt=result.updatedAt;saveShare(share);lastFingerprint='';await sync(true);}}
 catch(e){if(e.code==='UNAUTHORIZED'||e.code==='LINK_EXPIRED'){notice='The previous calendar link cannot be managed. Create a new link after turning off the old one.';redraw();}}
}
async function revoke(){
 if(!share||busy)return;
 if(!confirm('Disable this calendar link? Everyone subscribed to it will lose access when their calendar app next refreshes.'))return;
 busy=true;
 try{await request('revoke');saveShare(null);lastFingerprint='';notice='Calendar sharing disabled. The old link no longer works.';}
 catch(e){notice='Could not revoke this link: '+String(e.message||e)+'. Sharing may still be active.';}
 finally{busy=false;redraw();}
}
async function copy(){
 if(!share)return;
 try{await navigator.clipboard.writeText(link());notice='Calendar link copied. Send it to the person you want to connect.';}
 catch{
  const input=$('#shareLinkField');if(input){input.focus();input.select();notice='The link is selected. Use Copy from the selection menu.';return;}
  else notice='Your link is ready. Use Share link to send it.';
 }
 redraw();
}
async function shareNow(){
 if(!share)return;
 if(navigator.share){
  try{await navigator.share({title:'Subscribe to my LifeOS calendar',text:'View my read-only LifeOS calendar:',url:link()});}catch(e){if(e.name!=='AbortError'){notice='Share failed. Use Copy link instead.';redraw();}}
 }else await copy();
}
function snapshotICS(){
 const events=collect(),lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//LifeOS//Calendar Export//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:LifeOS Events'];
 const text=x=>String(x||'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const stamp=x=>new Date(x).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
 for(const event of events){
  lines.push('BEGIN:VEVENT','UID:'+event.uid+'@lifeos.local','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(event.start),
   'DTEND:'+stamp(event.end),'SUMMARY:'+text(event.title));
  if(event.location)lines.push('LOCATION:'+text(event.location));
  lines.push('END:VEVENT');
 }
 lines.push('END:VCALENDAR');
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lifeos-calendar.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 notice='Downloaded a calendar snapshot. A downloaded file does not stay connected or update automatically.';redraw();
}
let originalSave=save;
save=function(){originalSave();if(share){clearTimeout(syncTimer);syncTimer=setTimeout(()=>sync(true),1800);}};
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-life-cal]');
 if(!el)return;
 const action=el.dataset.lifeCal;
 if(action==='create')await create();
 else if(action==='revoke')await revoke();
 else if(action==='sync')await sync(false);
 else if(action==='copy')await copy();
 else if(action==='share')await shareNow();
 else if(action==='download')snapshotICS();
 else if(action==='import')$('#lifeCalendarFile')?.click();
});
async function importCalendarFile(file){
 if(!file)return;
 if(file.size>1_250_000){notice='Calendar file is too large (maximum 1.25 MB).';redraw();return;}
 try{
  const {parseICS}=await import('/calendar-core.mjs');
  const imported=parseICS(await file.text());
  const keys=new Set(db.items.filter(x=>x.externalUID).map(x=>x.externalUID));
  const existing=new Set(db.items.filter(x=>x.kind==='event').map(x=>String(x.title).toLowerCase()+'|'+x.dueAt));
  const news=imported.filter(e=>{
   if(e.externalUID&&keys.has(e.externalUID))return false;
   const key=e.title.toLowerCase()+'|'+e.dueAt;
   if(existing.has(key))return false;
   existing.add(key);if(e.externalUID)keys.add(e.externalUID);return true;
  });
  if(!news.length){notice='No new calendar events found in that file.';redraw();return;}
  if(!confirm('Import '+news.length+' event'+(news.length!==1?'s':'')+' into LifeOS?'+(share?' Your active sharing link will include the new events at its selected privacy level.':'')))return;
  const importedItems=news.map(e=>({...e,id:uid(),kind:'event',priority:'Normal',alert:false,leadMinutes:0,done:false,
   createdAt:Date.now(),updatedAt:Date.now()}));
  db.items.unshift(...importedItems);save();
  notice='Imported '+news.length+' event'+(news.length!==1?'s':'')+'. Imports do not create automatic reminders.';
  redraw();
 }catch(error){notice='Calendar import failed: '+String(error.message||error);redraw();}
}
document.addEventListener('change',async e=>{
 if(e.target.id==='lifeCalendarFile'){
  const file=e.target.files?.[0];await importCalendarFile(file);return;
 }
});
document.addEventListener('change',e=>{
 if(e.target.id==='shareNames'){
  const locations=$('#shareLocations');
  if(locations){locations.disabled=!e.target.checked;if(!e.target.checked)locations.checked=false;}
 }
});
window.addEventListener('online',()=>{if(share)sync(true);});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&share)sync(true);});
setTimeout(()=>statusCheck(),1800);
window.LifeOSCalendarShare=Object.freeze({collect,hasLink:()=>!!share});
})();
