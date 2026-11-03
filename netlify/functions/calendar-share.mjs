/* Read-only LifeOS calendar subscriptions. Opt-in only; never copies journal, finances or reminders. */
import {getStore} from '@netlify/blobs';
import {randomBytes} from 'node:crypto';
import {json,digest,authorized} from '../lib/core.mjs';
import {ID_PATTERN,cleanCalendarEvents,generateICS,calendarPreview} from '../lib/calendar.mjs';
const store=()=>getStore('lifeos-calendar-shares-v1');
const makeId=()=>randomBytes(24).toString('base64url');
const makeToken=()=>randomBytes(32).toString('hex');
const now=()=>Date.now();
const error=(code,message,status)=>json({code,error:message},status);
const MAX_AGE=365*86400000;
const validatePayload=(body)=>{
 const events=cleanCalendarEvents(body.events);
 if(!Array.isArray(body.events)||body.events.length>900)throw Error('Too many calendar events. Maximum 900 per update.');
 if(JSON.stringify(events).length>190000)throw Error('Calendar data too large.');
 return {events,shareNames:body.shareNames===true,shareLocations:body.shareLocations===true,updatedAt:now()};
};
const sameOrigin=(request)=>{
 const origin=request.headers.get('origin'),host=new URL(request.url).origin;
 return origin===host;
};
const feedResponse=(calendar,id)=>{
 const events=calendarPreview(calendar.events,{shareNames:calendar.shareNames,shareLocations:calendar.shareLocations});
 const content=generateICS(events,{name:'LifeOS Shared Calendar',calendarId:id,updatedAt:calendar.updatedAt});
 return new Response(content,{status:200,headers:{
  'content-type':'text/calendar; charset=utf-8',
  'content-disposition':'inline; filename="lifeos-calendar.ics"',
  'cache-control':'no-cache, no-store, must-revalidate',
  'referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff',
  'access-control-allow-origin':'*'
 }});
};
export default async function handler(request){
 const url=new URL(request.url);
 if(request.method==='GET'){
  const id=url.searchParams.get('id')||'';
  if(!ID_PATTERN.test(id))return error('INVALID_LINK','Invalid calendar link.',404);
  try{
   const current=await store().get('share-'+id,{type:'json'});
   if(!current||current.revoked||now()-(current.createdAt||0)>MAX_AGE)return error('LINK_EXPIRED','Calendar link is no longer active.',404);
   return feedResponse(current,id);
  }catch(e){console.error('Calendar feed unavailable',String(e?.message||e).slice(0,170));return error('STORE_UNAVAILABLE','Calendar feed is temporarily unavailable.',503);}
 }
 if(request.method!=='POST')return error('METHOD_NOT_ALLOWED','Only GET and POST are supported.',405);
 if(!sameOrigin(request))return error('INVALID_ORIGIN','Only the installed LifeOS app can manage sharing.',403);
 let body;try{
  const raw=await request.text();if(raw.length>220000)return error('TOO_LARGE','Maximum calendar share payload exceeded.',413);
  body=JSON.parse(raw);
 }catch{return error('BAD_REQUEST','Invalid calendar sharing request.',400);}
 if(!['create','sync','status','revoke'].includes(body?.action))return error('BAD_ACTION','Unsupported sharing action.',400);
 try{
  const bucket=store();
  if(body.action==='create'){
   const events=validatePayload(body);
   // Rate limit unauthenticated share creation to reduce abuse of the shared Netlify Blobs store.
   const ip=String(request.headers.get('x-nf-client-connection-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,80);
   const hour=Math.floor(now()/3600000),limitKey='rate-'+digest(ip+':'+hour);
   const prior=await bucket.get(limitKey,{type:'json'}).catch(()=>null);
   if((prior?.count||0)>=5)return error('RATE_LIMIT','Calendar link creation is temporarily limited. Try again later.',429);
   await bucket.setJSON(limitKey,{count:(prior?.count||0)+1,updatedAt:now()});
   const id=makeId(),manageToken=makeToken();
   await bucket.setJSON('share-'+id,{...events,manageHash:digest(manageToken),createdAt:now(),revoked:false});
   return json({ok:true,id,manageToken,eventCount:events.events.length,updatedAt:events.updatedAt});
  }
  const id=String(body.id||'');
  if(!ID_PATTERN.test(id))return error('INVALID_LINK','Calendar link is invalid.',400);
  const current=await bucket.get('share-'+id,{type:'json'});
  if(!current||current.revoked)return error('LINK_EXPIRED','Calendar share no longer exists.',404);
  if(!authorized(body.manageToken,current.manageHash))return error('UNAUTHORIZED','This device no longer has permission to manage this calendar link.',403);
  if(body.action==='status')return json({ok:true,id,eventCount:current.events.length,shareNames:current.shareNames,shareLocations:current.shareLocations,updatedAt:current.updatedAt});
  if(body.action==='revoke'){
   await bucket.delete('share-'+id);
   return json({ok:true,revoked:true});
  }
  const update=validatePayload(body);
  await bucket.setJSON('share-'+id,{...current,...update});
  return json({ok:true,id,eventCount:update.events.length,updatedAt:update.updatedAt});
 }catch(e){
  if(String(e?.message||'').includes('Too many')||String(e?.message||'').includes('too large'))return error('INVALID_EVENTS',String(e.message),400);
  console.error('Calendar share storage failure',String(e?.message||e).slice(0,170));
  return error('STORE_UNAVAILABLE','Calendar sharing is unavailable. Check Netlify Blobs configuration.',503);
 }
}
