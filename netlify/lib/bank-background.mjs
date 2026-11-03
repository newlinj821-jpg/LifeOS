/* Bank sync is server-side and works while the LifeOS app is closed.
   Transactions arrive when Plaid and the bank publish them; never promise instant posting. */
import {getStore} from '@netlify/blobs';
import webpush from 'web-push';
import {readVault,writeVault,currentEnvironment} from './bank-security.mjs';
import {normalizeAccount,normalizeTransaction,applyTransactions,mergeBankAccounts,isDeposit,isExpense,
 bankPrefs,bankAlertCandidates} from './bank-data.mjs';
import {digest,configured,quiet,clock} from './core.mjs';

const hosts={sandbox:'https://sandbox.plaid.com',production:'https://production.plaid.com'};
const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Math.abs(Number(n)||0));
export async function plaidBank(path,body,timeout=20000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const result=await fetch(hosts[currentEnvironment()]+'/'+path,{method:'POST',
   headers:{'content-type':'application/json'},signal:controller.signal,
   body:JSON.stringify({...body,client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET})});
  const data=await result.json().catch(()=>({}));
  if(!result.ok||data.error_code){
   const e=new Error('Plaid '+String(data.error_code||result.status));
   e.code=String(data.error_code||'PLAID_ERROR');throw e;
  }
  return data;
 }finally{clearTimeout(timer);}
}
async function incremental(item){
 const startCursor=item.cursor||'';
 for(let attempt=0;attempt<3;attempt++){
  let cursor=startCursor,hasMore=true,added=[],modified=[],removed=[];
  for(let page=0;page<25&&hasMore;page++){
   let body;
   try{body=await plaidBank('transactions/sync',{access_token:item.accessToken,cursor,count:200});}
   catch(e){if(e.code==='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'&&attempt<2){hasMore=null;break;}throw e;}
   added.push(...(body.added||[]).map(x=>normalizeTransaction(x,item.itemId)).filter(Boolean));
   modified.push(...(body.modified||[]).map(x=>normalizeTransaction(x,item.itemId)).filter(Boolean));
   removed.push(...(body.removed||[]));
   if(added.length+modified.length+removed.length>3500)throw Error('BANK_SYNC_LIMIT');
   cursor=body.next_cursor||cursor;hasMore=body.has_more===true;
  }
  if(hasMore===null)continue;
  if(hasMore)throw Error('BANK_SYNC_PAGINATION');
  const old=new Map((item.transactions||[]).map(t=>[t.id,t]));
  const tx=applyTransactions(item.transactions,added,modified,removed);
  const incoming=[...added,...modified].filter(t=>{
   const prior=old.get(t.id);
   return !t.pending&&(!prior||prior.pending===true);
  });
  return {tx,cursor,incoming};
 }
 throw Error('BANK_SYNC_RETRY');
}
const dayKey=()=>new Date().toISOString().slice(0,10);
export async function updateBanks({itemId=null,includeAccounts=true}={}){
 const vault=await readVault(),preferences=bankPrefs(vault.bankAlerts);
 vault.bankAlerts=preferences;vault.alertSeen=vault.alertSeen||{};
 vault.alertQueue=Array.isArray(vault.alertQueue)?vault.alertQueue:[];
 const warnings=[],records=[];
 for(const item of vault.items||[]){
  if(itemId&&item.itemId!==itemId)continue;
  const wasInitialized=Boolean(item.transactionsUpdatedAt);
  try{
   const oldAccounts=item.accounts||[];
   if(includeAccounts){
    const data=await plaidBank('accounts/get',{access_token:item.accessToken},16000);
    const fresh=(data.accounts||[]).map(a=>normalizeAccount(a,item.itemId)).filter(Boolean);
    item.previousAccounts=oldAccounts;
    item.accounts=mergeBankAccounts(oldAccounts,fresh);
    if(fresh.length)item.updatedAt=Date.now();
    else item.warning='ACCOUNTS_PENDING';
   }
   const synced=await incremental(item);
   item.transactions=synced.tx;item.cursor=synced.cursor;
   item.transactionsUpdatedAt=Date.now();item.warning='';
   // First sync is historical backfill and must never send retroactive payday alerts.
   if(wasInitialized&&preferences.enabled&&vault.pushDeviceKey){
    for(const event of bankAlertCandidates(synced.incoming,preferences)){
     if(vault.alertSeen[event.id]||vault.alertQueue.some(x=>x.id===event.id))continue;
     vault.alertSeen[event.id]=Date.now();
     vault.alertQueue.push({...event,createdAt:Date.now()});
     records.push(event.kind);
    }
    if(preferences.lowBalance){
     const prev=new Map(oldAccounts.map(a=>[a.id,a]));
     for(const account of item.accounts||[]){
      if(account.type!=='depository'||account.subtype!=='checking'||!Number.isFinite(account.current))continue;
      const before=prev.get(account.id)?.current;
      if(!Number.isFinite(before)||before>=preferences.lowBalanceAmount&&account.current<preferences.lowBalanceAmount){
       if(account.current<preferences.lowBalanceAmount){
        const id='low:'+account.id+':'+dayKey();
        if(!vault.alertSeen[id]){vault.alertSeen[id]=Date.now();vault.alertQueue.push({id,kind:'low',amount:account.current,date:dayKey(),createdAt:Date.now()});}
       }
      }
     }
    }
   }
  }catch(e){
   const code=String(e.code||e.message||'BANK_SYNC_FAILED').slice(0,65);
   item.warning=code;warnings.push({institution:item.institution,code});
  }
 }
 const expiry=Date.now()-14*86400000;
 vault.alertSeen=Object.fromEntries(Object.entries(vault.alertSeen).filter(([,t])=>t>expiry).slice(-800));
 vault.alertQueue=vault.alertQueue.filter(e=>Date.now()-(e.createdAt||0)<5*86400000).slice(-60);
 vault.updatedAt=Date.now();
 await writeVault(vault);
 return {updated:(vault.items||[]).filter(i=>!itemId||itemId===i.itemId).length,warnings,queued:records.length};
}
export function bankMessage(alert,config){
 const money=config.showAmounts?' · '+currency(alert.amount):'';
 if(alert.kind==='paycheck')return {title:'Paycheck received'+money,body:'A posted deposit matched your saved paycheck amount. Review the transaction in Money.'};
 if(alert.kind==='deposit')return {title:'Deposit received'+money,body:'A new bank deposit was posted. Review the amount and source in Money.'};
 if(alert.kind==='spending')return {title:'Large purchase posted'+money,body:'A purchase reached the amount you chose for spending alerts.'};
 return {title:'Checking balance is low',body:'Your reported checking balance crossed below your selected threshold.'};
}
function inQuiet(config,zone,date){
 try{return quiet(clock(date,zone),config.quietStart,config.quietEnd);}
 catch{return true;}
}
export async function deliverBankAlerts(){
 const vault=await readVault(),prefs=bankPrefs(vault.bankAlerts),queued=Array.isArray(vault.alertQueue)?vault.alertQueue:[];
 if(!prefs.enabled||!vault.pushDeviceKey||!queued.length||!configured())return {sent:0,pending:queued.length};
 const store=getStore('lifeos-push-devices');
 const device=await store.get(vault.pushDeviceKey,{type:'json'});
 if(!device?.subscription||!device?.timezone)return {sent:0,pending:queued.length,warning:'PUSH_NOT_VERIFIED'};
 if(inQuiet(prefs,device.timezone,new Date()))return {sent:0,pending:queued.length,quiet:true};
 const date=dayKey(),history=vault.bankDaily||{};
 const count=history.date===date?history.sent||0:0;
 // A confirmed paycheck is important enough not to be blocked by the daily
 // cap for routine deposit/purchase alerts.
 if(count>=prefs.maxDaily&&!queued.some(a=>a.kind==='paycheck'))return {sent:0,pending:queued.length,limit:true};
 webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 let sent=0;
 for(const entry of queued.slice().sort((a,b)=>Number(b.kind==='paycheck')-Number(a.kind==='paycheck'))){
  if(entry.kind!=='paycheck'&&count+sent>=prefs.maxDaily)continue;
  // Do not deliver stale bank alerts days after the actual transaction.
  if(Date.now()-(entry.createdAt||0)>36*3600000)continue;
  // Claim BEFORE network delivery so concurrent webhook/cron runs cannot repeatedly notify.
  const current=await readVault();
  const found=current.alertQueue?.find(x=>x.id===entry.id&&!x.claimedAt);
  if(!found)continue;
  found.claimedAt=Date.now();
  await writeVault(current);
  const copy=bankMessage(entry,{...prefs,showAmounts:prefs.showAmounts===true&&device.privateMode!==true});
  try{
   await webpush.sendNotification(device.subscription,JSON.stringify({
    title:copy.title,body:copy.body,tag:'lifeos-bank-'+digest(entry.id).slice(0,14),
    url:'/#money',priority:'normal'
   }),{TTL:1800,urgency:'normal'});
   const latest=await readVault();
   latest.alertQueue=(latest.alertQueue||[]).filter(x=>x.id!==entry.id);
   latest.bankDaily={date,sent:(latest.bankDaily?.date===date?latest.bankDaily.sent||0:0)+1};
   latest.bankLastPushAt=Date.now();
   await writeVault(latest);sent++;
  }catch(e){
   const code=e.statusCode||0;
   const latest=await readVault();
   latest.alertQueue=(latest.alertQueue||[]).filter(x=>x.id!==entry.id);
   latest.bankLastError=code===401||code===403?'PUSH_CREDENTIALS':code===404||code===410?'PUSH_EXPIRED':'PUSH_NOT_ACCEPTED';
   await writeVault(latest);
   console.error('LifeOS bank push rejected',code);
  }
 }
 return {sent,pending:queued.length-sent};
}
