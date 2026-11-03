/* LifeOS private bank API. Read-only: Transactions and cached accounts by default. */
import {json,digest,authorized,validSubscription} from '../lib/core.mjs';
import {getStore} from '@netlify/blobs';
import {updateBanks,deliverBankAlerts} from '../lib/bank-background.mjs';
import {randomBytes} from 'node:crypto';
import {currentEnvironment,isConfigured,verifySetupKey,newSession,storeSession,sessionValid,deleteSession,readVault,writeVault} from '../lib/bank-security.mjs';
import {normalizeAccount,normalizeTransaction,applyTransactions,bankPrefs,paycheckHistory,summarizeTransactions} from '../lib/bank-data.mjs';

const base=()=>currentEnvironment()==='production'?'https://production.plaid.com':'https://sandbox.plaid.com';
const sourceOfError=e=>({code:e?.code||'BANK_ERROR',error:e?.message||'Bank data is temporarily unavailable.'});
class PlaidError extends Error {
 constructor(code,message,status=502){super(message);this.code=code;this.status=status;}
}
async function callPlaid(route,body){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),27000);
 try{
  const response=await fetch(base()+'/'+route,{method:'POST',headers:{'content-type':'application/json'},
   signal:controller.signal,body:JSON.stringify({...body,client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
   const code=String(data.error_code||'PLAID_UNAVAILABLE');
   const safeMessages={
    ITEM_LOGIN_REQUIRED:'Bank connection needs repair. Reconnect the institution through Plaid.',
    PRODUCT_NOT_READY:'Transactions are not available yet. Try refreshing later.',
    PRODUCT_NOT_ENABLED:'The Plaid product is not enabled for this connection.',
    INVALID_CREDENTIALS:'Plaid credentials are not accepted. Check the keys and environment in Netlify.',
    INVALID_ACCESS_TOKEN:'This bank connection needs to be relinked.',
    TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION:'Transaction history changed during synchronization.'
   };
   throw new PlaidError(code,safeMessages[code]||'Plaid returned '+code+'. Check the Plaid dashboard or try later.');
  }
  return data;
 }catch(e){
  if(e?.name==='AbortError')throw new PlaidError('TIMEOUT','Plaid did not respond in time. Try again.');
  throw e;
 }finally{clearTimeout(timeout);}
}
function safeAccountList(data,itemId){
 return (data?.accounts||[]).map(x=>normalizeAccount(x,itemId)).filter(Boolean).slice(0,35);
}
async function syncTransactions(record){
 const initial=record.cursor||'',outAdd=[],outMod=[],outRemoved=[];
 let next=initial,attempts=0,finished=false;
 while(attempts++<3&&!finished){
  outAdd.length=0;outMod.length=0;outRemoved.length=0;next=initial;
  for(let page=0;page<30;page++){
   let data;
   try{data=await callPlaid('transactions/sync',{access_token:record.accessToken,cursor:next,count:500});}
   catch(e){
    if(e?.code==='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'&&attempts<3){break;}
    throw e;
   }
   for(const x of data.added||[]){const t=normalizeTransaction(x,record.itemId);if(t)outAdd.push(t);}
   for(const x of data.modified||[]){const t=normalizeTransaction(x,record.itemId);if(t)outMod.push(t);}
   outRemoved.push(...(data.removed||[]));
   next=data.next_cursor||next;
   if(!data.has_more){finished=true;break;}
   if(page===29)throw new PlaidError('SYNC_TOO_LARGE','Transaction history exceeded the safe sync limit. No partial updates were saved.');
  }
 }
 if(!finished)throw new PlaidError('SYNC_RETRY','Transactions changed during synchronization. Try again; existing records are unchanged.');
 return {transactions:applyTransactions(record.transactions||[],outAdd,outMod,outRemoved),cursor:next};
}
function visible(v){
 const all=v.items.flatMap(i=>i.transactions||[]);
 return {environment:currentEnvironment(),updatedAt:v.updatedAt||null,connected:v.items.length,
  bankAlerts:bankPrefs(v.bankAlerts),pushConnected:Boolean(v.pushDeviceKey),bankLastError:v.bankLastError||null,
  lastBankNotification:v.bankLastPushAt||null,paychecks:paycheckHistory(all,v.bankAlerts),
  thisMonth:summarizeTransactions(all,new Date().toISOString().slice(0,7)),
  accounts:v.items.flatMap(i=>(i.accounts||[]).map(a=>({...a,institution:i.institution||'Connected bank'}))),
  previousAccounts:v.items.flatMap(i=>i.previousAccounts||[]),
  transactions:v.items.flatMap(i=>i.transactions||[]).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,700),
  institutions:v.items.map(i=>({id:i.itemId,name:i.institution||'Connected bank',
   updatedAt:i.updatedAt||null,transactionsUpdatedAt:i.transactionsUpdatedAt||null,warning:i.warning||''}))};
}
function safeEnv(){return {configured:isConfigured(),environment:currentEnvironment(),
 readOnly:true,sessionHours:12,webhookConfigured:Boolean(process.env.PLAID_WEBHOOK_URL),
 needs:['PLAID_CLIENT_ID','PLAID_SECRET','PLAID_ENV','LIFEOS_BANK_SETUP_KEY','LIFEOS_BANK_ENCRYPTION_KEY']};}
function success(result){return json(result);}
function sameOrigin(req){
 const origin=req.headers.get('origin');
 const fetchSite=req.headers.get('sec-fetch-site');
 return (!origin||origin===new URL(req.url).origin)&&(!fetchSite||['same-origin','none'].includes(fetchSite));
}
export default async function handler(request){
 if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED',error:'POST only.'},405);
 if(!sameOrigin(request))return json({code:'ORIGIN',error:'Bank requests must come from LifeOS.'},403);
 let body;
 try{
  const text=await request.text();
  if(text.length>16000)return json({code:'TOO_LARGE',error:'Request too large.'},413);
  body=JSON.parse(text);
  if(!body||typeof body!=='object')throw Error('invalid');
 }catch{return json({code:'INVALID_REQUEST',error:'Invalid bank request.'},400);}
 const action=body.action;
 if(action==='config')return success(safeEnv());
 if(!isConfigured())return json({code:'NOT_CONFIGURED',error:'Set up your Plaid credentials and LifeOS bank keys in Netlify first.'},503);
 try{
  if(action==='unlock'){
   if(!verifySetupKey(body.setupKey))return json({code:'INVALID_SETUP_KEY',error:'Incorrect LifeOS bank setup key.'},403);
   const session=newSession();await storeSession(session);
   const vault=await readVault();
   // Create the encrypted owner record once, without creating any connected bank.
   if(!vault.initialized){vault.initialized=true;await writeVault(vault);}
   return success({ok:true,session,expiresInSeconds:43200,summary:visible(vault)});
  }
  const authorization=request.headers.get('authorization')||'';
  if(!await sessionValid(authorization))return json({code:'BANK_LOCKED',error:'Your bank session expired. Unlock with your LifeOS bank setup key.'},401);
  if(action==='lock'){await deleteSession(authorization);return success({ok:true});}
  let vault=await readVault();
  if(action==='status')return success({ok:true,summary:visible(vault)});
  if(action==='link-token'){
   const item=body.updateItemId?vault.items.find(x=>x.itemId===body.updateItemId):null;
   if(body.updateItemId&&!item)return json({code:'NOT_FOUND',error:'Select an existing bank to reconnect.'},404);
   const opts=item?{access_token:item.accessToken,user:{client_user_id:vault.ownerId},client_name:'LifeOS',
     country_codes:['US'],language:'en'}:{user:{client_user_id:vault.ownerId},client_name:'LifeOS',products:['transactions'],
     country_codes:['US'],language:'en'};
   const webhook=process.env.PLAID_WEBHOOK_URL;
   if(!item&&webhook&&/^https:\/\/[^?#]+$/.test(webhook))opts.webhook=webhook;
   const redirect=process.env.PLAID_REDIRECT_URI;
   if(redirect&&/^https:\/\/[^?#]+$/.test(redirect))opts.redirect_uri=redirect;
   const data=await callPlaid('link/token/create',opts);
   if(typeof data.link_token!=='string')throw new PlaidError('NO_LINK_TOKEN','Plaid did not provide a link token.');
   return success({ok:true,linkToken:data.link_token,expiration:data.expiration});
  }
  if(action==='exchange'){
   if(typeof body.publicToken!=='string'||body.publicToken.length>512||!body.publicToken.startsWith('public-'))
    return json({code:'INVALID_PUBLIC_TOKEN',error:'The bank linking session returned an invalid token.'},400);
   const exchanged=await callPlaid('item/public_token/exchange',{public_token:body.publicToken});
   if(!exchanged.access_token||!exchanged.item_id)throw new PlaidError('INVALID_EXCHANGE','Plaid did not confirm this bank connection.');
   const old=vault.items.find(x=>x.itemId===exchanged.item_id);
   if(old)return success({ok:true,summary:visible(vault),alreadyLinked:true});
   const record={itemId:exchanged.item_id,accessToken:exchanged.access_token,
    institution:String(body.institution||'Connected bank').slice(0,100).replace(/[<>]/g,''),
    accounts:[],previousAccounts:[],transactions:[],cursor:'',updatedAt:null,transactionsUpdatedAt:null};
   vault.items.push(record);
   await writeVault(vault);
   // The token is securely retained even if the bank is not ready for transactions.
   try{
    const data=await callPlaid('accounts/get',{access_token:record.accessToken});
    record.accounts=safeAccountList(data,record.itemId);
    record.updatedAt=Date.now();vault.updatedAt=Date.now();
    await writeVault(vault);
   }catch(e){record.warning='Account details are still loading. Select Refresh later.';await writeVault(vault);}
   // Start transactions/sync so Plaid can begin sending SYNC_UPDATES_AVAILABLE events.
   try{await updateBanks({itemId:record.itemId});vault=await readVault();}
   catch(e){console.warn('LifeOS initial bank sync pending',String(e.code||e.message).slice(0,90));}
   return success({ok:true,summary:visible(vault)});
  }
  if(action==='refresh'){
   // A manual refresh uses the cached Accounts endpoint by default (not the
   // potentially chargeable real-time Balance or Transactions Refresh add-on).
   if(body.freshBalances===true)return json({code:'BALANCE_ADDON_DISABLED',
     error:'Real-time balance refresh can incur Plaid charges. LifeOS uses the standard free-compatible accounts refresh instead.'},400);
   const result=await updateBanks({});
   await deliverBankAlerts();
   vault=await readVault();
   return success({ok:true,summary:visible(vault),updated:result.updated,warnings:result.warnings});
  }
  if(action==='notification-prefs'){
   const input=body.prefs;
   if(!input||typeof input!=='object')return json({code:'INVALID_PREFS',error:'Invalid notification preferences.'},400);
   vault.bankAlerts=bankPrefs({...vault.bankAlerts,...input});
   await writeVault(vault);
   return success({ok:true,summary:visible(vault)});
  }
  if(action==='link-notifications'){
   if(!validSubscription(body.subscription)||typeof body.manageToken!=='string')
    return json({code:'NOT_VERIFIED',error:'Enable and verify regular LifeOS notifications before linking bank alerts.'},400);
   const endpointHash=digest(body.subscription.endpoint),deviceKey='device-'+endpointHash;
   const record=await getStore('lifeos-push-devices').get(deviceKey,{type:'json'});
   if(!record||!authorized(body.manageToken,record.manageHash))
    return json({code:'NOT_VERIFIED',error:'This phone does not have a verified LifeOS push connection. Reconnect notifications in Settings.'},403);
   vault.pushDeviceKey=deviceKey;vault.bankAlerts=bankPrefs({...vault.bankAlerts,enabled:true});
   await writeVault(vault);
   return success({ok:true,summary:visible(vault)});
  }
  if(action==='unlink-notifications'){
   vault.pushDeviceKey=null;vault.bankAlerts=bankPrefs({...vault.bankAlerts,enabled:false});
   vault.alertQueue=[];
   await writeVault(vault);
   return success({ok:true,summary:visible(vault)});
  }
  if(action==='disconnect'){
   const id=String(body.itemId||'');
   const record=vault.items.find(x=>x.itemId===id);
   if(!record)return json({code:'NOT_FOUND',error:'Bank connection not found.'},404);
   await callPlaid('item/remove',{access_token:record.accessToken});
   vault.items=vault.items.filter(x=>x.itemId!==id);vault.updatedAt=Date.now();
   await writeVault(vault);
   return success({ok:true,summary:visible(vault)});
  }
  return json({code:'UNKNOWN_ACTION',error:'Unknown bank action.'},400);
 }catch(e){
  console.error('LifeOS bank operation failed:',String(e.code||e.name||'SERVER_ERROR').slice(0,75));
  return json(sourceOfError(e),e?.status||503);
 }
}
