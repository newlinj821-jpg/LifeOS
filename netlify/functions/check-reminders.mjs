import {getStore} from '@netlify/blobs';
import webpush from 'web-push';
import {configured,dueReminders,clock,quiet,notification,trimSeen} from '../lib/core.mjs';
export default async function handler(){
if(!configured()){console.warn('LifeOS: notification keys not configured');return;}
webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
const store=getStore('lifeos-push-devices'),now=new Date();
let checked=0,sent=0,failed=0,muted=0;
async function check(item){
const r=await store.get(item.key,{type:'json'});if(!r?.subscription||!r.timezone)return;
const due=dueReminders(r.reminders||[],r.timezone,now,26).slice(0,10);
if(!due.length)return;
let seen=trimSeen(r.seen),changed=false;
for(const occurrence of due){
if(seen[occurrence.key])continue;
if(r.quiet?.enabled&&quiet(clock(now,r.timezone),r.quiet.start,r.quiet.end)&&occurrence.reminder.priority!=='high'){muted++;continue;}
try{await webpush.sendNotification(r.subscription,JSON.stringify(notification(occurrence.reminder,r.privateMode)),{TTL:1800,urgency:occurrence.reminder.priority==='high'?'high':'normal'});
seen[occurrence.key]=Date.now();changed=true;sent++;
}catch(e){failed++;const code=e?.statusCode||0;console.error('LifeOS scheduled push failed',code,String(e?.message||'').slice(0,200));if([404,410].includes(code)){await store.delete(item.key);return;}}
}
if(changed)await store.setJSON(item.key,{...r,seen,checkedAt:Date.now()});
}
try{
for await(const page of store.list({paginate:true})){
for(let i=0;i<page.blobs.length&&checked<200;i+=5){const batch=page.blobs.slice(i,Math.min(i+5,page.blobs.length,i+200-checked));const result=await Promise.allSettled(batch.map(check));for(const r of result)if(r.status==='rejected'){failed++;console.error('LifeOS scan item',String(r.reason).slice(0,180));}checked+=batch.length;}
if(checked>=200)break;
}
}catch(e){console.error('LifeOS scan store error',String(e?.message||'').slice(0,250));}
console.log('LifeOS reminders: '+checked+' devices; '+sent+' sent; '+failed+' failed; '+muted+' quiet-hours suppressed');
}
