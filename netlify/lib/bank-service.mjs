/* Background bank refresh and notification delivery. No bank credentials in device push payloads. */
import {getStore} from '@netlify/blobs';
import webpush from 'web-push';
import {configured,clock,quiet} from './core.mjs';
import {readVault,writeVault,refreshVault,financeAlerts,blankVault} from './bank-core.mjs';

const lastN=v=>Object.entries(v||{}).filter(([,time])=>Date.now()-Number(time)<40*86400000).slice(-400);
export async function deliverBankAlerts(vault,now=new Date()){
 const queue=(vault.pendingAlerts||[]).filter(a=>a&&a.createdAt&&now.getTime()-a.createdAt<36*3600000&&a.status!=='accepted');
 vault.pendingAlerts=queue.slice(-35);
 vault.delivery=vault.delivery||{attempted:0,accepted:0,failed:0,lastAt:null,lastStatus:'not configured'};
 if(!queue.length)return {accepted:0,pending:0};
 if(!vault.pushKey||!configured()){vault.delivery.lastStatus='No verified push device or VAPID settings';return {accepted:0,pending:queue.length};}
 const pushStore=getStore('lifeos-push-devices');
 const device=await pushStore.get(vault.pushKey,{type:'json'});
 if(!device?.subscription||!device?.manageHash){vault.delivery.lastStatus='Push device disconnected; open LifeOS to reconnect';return {accepted:0,pending:queue.length};}
 const zone=device.timezone||'America/Chicago';
 try{if(device.quiet?.enabled&&quiet(clock(now,zone),device.quiet.start||'22:00',device.quiet.end||'07:00')){
  vault.delivery.lastStatus='Quiet hours: queued until next check';
  return {accepted:0,pending:queue.length};
 }}catch{}
 webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 let accepted=0;
 for(const entry of queue.filter(a=>a.attempts<3).slice(0,3)){
  entry.attempts=(entry.attempts||0)+1;entry.lastAttemptAt=Date.now();
  vault.delivery.attempted++;
  // Reserve the attempt BEFORE sending to reduce accidental duplicates on retries or crashes.
  await writeVault(vault);
  try{
   const privateMode=device.privateMode===true;
   const content={title:privateMode?'LifeOS · Money update':entry.title,
     body:privateMode?'Open LifeOS to review your financial notification.':entry.body,
     tag:'lifeos-'+entry.id.slice(0,90),url:'/#money',
     priority:'normal',type:'lifeos-bank-notification'};
   await webpush.sendNotification(device.subscription,JSON.stringify(content),{TTL:7200,urgency:'normal'});
   entry.status='accepted';entry.acceptedAt=Date.now();accepted++;
   vault.delivery.accepted++;vault.delivery.lastStatus='Accepted by push provider (display not confirmed)';
  }catch(error){
   const code=Number(error.statusCode)||0;
   entry.status=entry.attempts>=3||[401,403,404,410].includes(code)?'failed':'pending';
   vault.delivery.failed++;vault.delivery.lastStatus='Push rejected ('+(code||'network error')+')';
   if([404,410].includes(code))vault.pushKey=null;
   console.error('LifeOS bank alert transport',code,String(error.message||'').slice(0,140));
  }
  vault.delivery.lastAt=Date.now();
  await writeVault(vault);
 }
 vault.pendingAlerts=queue.filter(e=>e.status!=='accepted').slice(-35);
 return {accepted,pending:vault.pendingAlerts.length};
}
export async function syncBank({liveBalance=false}={}){
 const old=await readVault();
 const next=structuredClone(old);
 const {newTransactions,warnings}=await refreshVault(next,{transactions:true,liveBalance});
 const alerts=financeAlerts(old,next,newTransactions);
 const seen=Object.fromEntries(lastN(next.seenAlerts));
 const pending=next.pendingAlerts||[];
 for(const event of alerts){
  if(seen[event.id])continue;
  seen[event.id]=Date.now();
  if(next.pushKey)pending.push({...event,status:'pending',attempts:0});
 }
 next.seenAlerts=seen;next.pendingAlerts=pending.slice(-35);
 next.lastSyncAt=Date.now();
 await writeVault(next);
 const sent=await deliverBankAlerts(next);
 await writeVault(next);
 return {vault:next,warnings,alerts:alerts.length,delivery:sent};
}
