import {getStore} from '@netlify/blobs';
import webpush from 'web-push';
import {json,digest,token,authorized,configured,validSubscription,validZone,cleanItems} from '../lib/core.mjs';
import {newRecovery,recoveryCanStart,verifyRecovery} from '../lib/push-recovery.mjs';
const data=()=>getStore('lifeos-push-devices');
export default async function handler(req){
if(req.method==='GET')return json({configured:configured(),publicKey:configured()?process.env.VAPID_PUBLIC_KEY:null,...(!configured()?{code:'VAPID_MISSING',error:'Configure VAPID keys in Netlify then redeploy'}:{})});
if(req.method!=='POST')return json({code:'METHOD_NOT_ALLOWED',error:'POST required'},405);
if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({code:'INVALID_ORIGIN',error:'Cross-origin request blocked'},403);
if(!configured())return json({code:'VAPID_MISSING',error:'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in Netlify and redeploy.'},503);
let b;try{const str=await req.text();if(str.length>85000)return json({code:'TOO_LARGE',error:'Maximum 250 reminders per device'},413);b=JSON.parse(str);}catch{return json({code:'BAD_REQUEST',error:'Invalid request'},400);}
if(!validSubscription(b.subscription))return json({code:'INVALID_SUBSCRIPTION',error:'Browser push subscription is invalid. Repair notifications.'},400);
if(!['subscribe','sync','unsubscribe','test','status','recover-start','recover-finish'].includes(b.action))return json({code:'INVALID_ACTION',error:'Unknown action'},400);
const key='device-'+digest(b.subscription.endpoint);
try{
const store=data(),prev=await store.get(key,{type:'json'}),ok=!!prev&&authorized(b.manageToken,prev.manageHash);
if(b.action==='recover-start'){
 if(!prev)return json({code:'DEVICE_NOT_FOUND',error:'This phone is not registered. Choose Enable notifications.'},404);
 if(ok)return json({ok:true,alreadyRegistered:true,reminderCount:(prev.reminders||[]).length});
 const limits=recoveryCanStart(prev.recovery);
 if(!limits.ok)return json({code:limits.code,error:limits.error},429);
 const verification=newRecovery(b.subscription.endpoint,Date.now(),prev.recovery);
 try{
  webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
  await webpush.sendNotification(b.subscription,JSON.stringify({
   title:'LifeOS · Verification code: '+verification.code,
   body:'Enter '+verification.code+' in LifeOS to reconnect notifications on this phone. Expires in 10 minutes.',
   tag:'lifeos-verify-device',url:'/#settings',priority:'high'
  }),{TTL:600,urgency:'high'});
 }catch(e){
  const st=e?.statusCode||0;console.error('LifeOS push recovery delivery',st,String(e?.message||'').slice(0,180));
  if([404,410].includes(st)){await store.delete(key);return json({code:'PUSH_EXPIRED',error:'The previous subscription is expired. Try enabling notifications again.'},410);}
  if([401,403].includes(st))return json({code:'VAPID_REJECTED',error:'The push provider rejected the notification keys. Check the VAPID settings in Netlify.'},502);
  return json({code:'VERIFY_DELIVERY_FAILED',error:'Could not send a verification code to this phone. Try again or check the function logs.'},502);
 }
 await store.setJSON(key,{...prev,recovery:verification.record});
 return json({ok:true,verificationRequired:true,expiresInSeconds:600,acceptedByProvider:true});
}
if(b.action==='recover-finish'){
 if(!prev||!prev.recovery)return json({code:'NO_ACTIVE_CODE',error:'Request a fresh verification code first.'},409);
 const result=verifyRecovery(prev.recovery,String(b.code||''),b.subscription.endpoint);
 if(!result.ok){
  if(result.code==='CODE_EXPIRED')return json({code:'CODE_EXPIRED',error:'That code expired. Request another code.'},410);
  const attempt=(prev.recovery.attempts||0)+1;
  await store.setJSON(key,{...prev,recovery:{...prev.recovery,attempts:attempt}});
  const exhausted=attempt>=5;
  return json({code:exhausted?'TOO_MANY_ATTEMPTS':'INVALID_CODE',error:exhausted?'Too many incorrect codes. Request a new one after the cooldown.':'Incorrect verification code. Check your notification and try again.'},403);
 }
 const tz=String(b.timezone||'UTC');if(!validZone(tz))return json({code:'INVALID_TIMEZONE',error:'Invalid timezone'},400);
 const validTime=x=>/^([01]\\d|2[0-3]):[0-5]\\d$/.test(x||'');
 const quietInput=b.quiet||{};
 const newManageToken=token();
 const updated={...prev,subscription:b.subscription,manageHash:digest(newManageToken),
  reminders:cleanItems(b.reminders),timezone:tz,
  quiet:{enabled:quietInput.enabled===true,start:validTime(quietInput.start)?quietInput.start:'22:00',end:validTime(quietInput.end)?quietInput.end:'07:00'},
  privateMode:b.privateMode===true,updatedAt:Date.now()};
 delete updated.recovery;
 await store.setJSON(key,updated);
 return json({ok:true,manageToken:newManageToken,reminderCount:updated.reminders.length,verified:true});
}
if(b.action==='status')return json({configured:true,enrolled:ok,reminderCount:ok?(prev.reminders||[]).length:0,updatedAt:ok?prev.updatedAt:null});
if(b.action==='subscribe'||b.action==='sync'){
if(prev&&!ok)return json({code:'DEVICE_TOKEN_MISMATCH',error:'A previous device registration needs verification. Choose Reconnect this device to receive a one-time code.'},409);
const tz=String(b.timezone||'UTC');if(!validZone(tz))return json({code:'INVALID_TIMEZONE',error:'Invalid timezone'},400);
const remind=cleanItems(b.reminders);
const validTime=x=>/^([01]\d|2[0-3]):[0-5]\d$/.test(x||'');
const q=b.quiet||{};const quiet={enabled:q.enabled===true,start:validTime(q.start)?q.start:'22:00',end:validTime(q.end)?q.end:'07:00'};
const manageToken=ok?b.manageToken:token();
await store.setJSON(key,{subscription:b.subscription,manageHash:digest(manageToken),reminders:remind,timezone:tz,quiet,privateMode:b.privateMode===true,seen:prev?.seen||{},updatedAt:Date.now(),lastTestAt:prev?.lastTestAt||0});
return json({ok:true,manageToken,reminderCount:remind.length,timezone:tz});
}
if(!ok)return json({code:'DEVICE_UNAUTHORIZED',error:'This device is not authorized. Use Repair notifications.'},403);
if(b.action==='unsubscribe'){await store.delete(key);return json({ok:true});}
if(Date.now()-(prev.lastTestAt||0)<45000)return json({code:'TEST_COOLDOWN',error:'Wait 45 seconds between push tests.'},429);
try{
webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
await webpush.sendNotification(prev.subscription,JSON.stringify({title:'LifeOS · Notification test',body:'Your test notification was accepted by your push provider. Background reminders are evaluated periodically on the server.',tag:'lifeos-test',url:'/?view=settings'}),{TTL:180,urgency:'normal'});
}catch(e){const status=e?.statusCode||0;console.error('LifeOS push test',status,String(e?.message||'').slice(0,250));if([404,410].includes(status)){await store.delete(key);return json({code:'PUSH_EXPIRED',error:'This push subscription expired. Repair notifications.'},410);}if([401,403].includes(status))return json({code:'VAPID_REJECTED',error:'Push provider rejected VAPID credentials. Verify matching keys in Netlify and redeploy.'},502);return json({code:'PUSH_REJECTED',error:'Push provider rejected test. Check function logs.'},502);}
await store.setJSON(key,{...prev,lastTestAt:Date.now()});
return json({ok:true,acceptedByProvider:true});
}catch(e){console.error('LifeOS push storage failure',String(e?.message||'').slice(0,250));return json({code:'STORE_ERROR',error:'Notification storage unavailable. Check Netlify Blobs and function logs.'},503);}
}
