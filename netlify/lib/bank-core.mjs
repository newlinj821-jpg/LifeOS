/* LifeOS bank data: encryption, Plaid validation and cash-flow insights.
   The vault key is supplied ONLY via Netlify environment variables. */
import {createCipheriv,createDecipheriv,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';

export const VAULT_NAME='lifeos-finance-private';
export const LIMIT_ITEMS=5, MAX_TX_PER_ITEM=450;
export const bankStore=()=>getStore(VAULT_NAME);
export const sha=s=>createHash('sha256').update(String(s)).digest('hex');
export const secureEq=(a,b)=>{
 if(typeof a!=='string'||typeof b!=='string')return false;
 const A=Buffer.from(sha(a),'hex'),B=Buffer.from(sha(b),'hex');
 return timingSafeEqual(A,B);
};
export const bankReady=()=>Boolean(
  process.env.PLAID_CLIENT_ID&&process.env.PLAID_SECRET&&
  /^(sandbox|production)$/.test(process.env.PLAID_ENV||'')&&
  typeof process.env.LIFEOS_BANK_OWNER_CODE==='string'&&process.env.LIFEOS_BANK_OWNER_CODE.length>=20&&
  /^[a-fA-F0-9]{64}$/.test(process.env.LIFEOS_BANK_VAULT_KEY||'')
);
export const blankVault=()=>({version:1,items:[],prefs:{
 deposits:false,largePurchases:false,largeAmount:250,lowBalance:false,lowThreshold:100,
 showDetails:false
},pushKey:null,updatedAt:0});
function vaultKey(){
 const hex=process.env.LIFEOS_BANK_VAULT_KEY;
 if(!/^[a-fA-F0-9]{64}$/.test(hex||''))throw Error('Finance vault encryption key not configured');
 return Buffer.from(hex,'hex');
}
export function encryptVault(data){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',vaultKey(),iv);
 const value=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
 return {version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),value:value.toString('base64')};
}
export function decryptVault(blob){
 if(!blob||blob.version!==1||typeof blob.value!=='string')throw Error('Unrecognized finance vault');
 const decipher=createDecipheriv('aes-256-gcm',vaultKey(),Buffer.from(blob.iv,'base64'));
 decipher.setAuthTag(Buffer.from(blob.tag,'base64'));
 return JSON.parse(Buffer.concat([decipher.update(Buffer.from(blob.value,'base64')),decipher.final()]).toString('utf8'));
}
export async function readVault(store=bankStore()){
 const data=await store.get('owner-vault',{type:'json'});
 return data?decryptVault(data):blankVault();
}
export async function writeVault(value,store=bankStore()){
 await store.setJSON('owner-vault',encryptVault({...value,updatedAt:Date.now()}));
}
const safe=s=>String(s??'').replace(/[<>\\x00-\\x1f]/g,' ').trim();
export function normalizeAccount(x){
 if(!x||!x.account_id)return null;
 const balance=x.balances||{};
 return {id:String(x.account_id).slice(0,180),
 name:safe(x.name||'Bank account').slice(0,70),mask:String(x.mask||'').slice(-4),
 type:safe(x.type).slice(0,30),subtype:safe(x.subtype).slice(0,40),
 current:Number.isFinite(balance.current)?balance.current:null,
 available:Number.isFinite(balance.available)?balance.available:null,
 currency:String(balance.iso_currency_code||'USD').slice(0,3)};
}
export function normalizeTransaction(x){
 if(!x?.transaction_id||!x.account_id||!/^\\d{4}-\\d{2}-\\d{2}$/.test(x.date||''))return null;
 return {id:String(x.transaction_id).slice(0,180),accountId:String(x.account_id).slice(0,180),
 date:x.date,name:safe(x.merchant_name||x.name||'Bank transaction').slice(0,130),
 amount:Number(x.amount)||0,pending:x.pending===true,
 category:safe(x.personal_finance_category?.primary||x.category?.[0]||'OTHER').slice(0,55),
 detail:safe(x.personal_finance_category?.detailed||'').slice(0,65),
 currency:String(x.iso_currency_code||'USD').slice(0,3)};
}
export function isTransfer(tx){return /^TRANSFER_|^LOAN_PAYMENTS$/.test(tx.category||'');}
export function incomeStats(items){
 const tx=items.flatMap(i=>i.transactions||[]).filter(t=>!t.pending);
 const spending=tx.filter(t=>t.amount>0&&!isTransfer(t)).reduce((s,t)=>s+t.amount,0);
 const income=tx.filter(t=>t.amount<0&&!isTransfer(t)).reduce((s,t)=>s-Math.abs(t.amount),0);
 const deposits=Math.abs(income);
 const groups={};
 for(const t of tx.filter(t=>t.amount>0&&!isTransfer(t)))groups[t.category]=(groups[t.category]||0)+t.amount;
 return {spending:Math.round(spending*100)/100,deposits:Math.round(deposits*100)/100,
 net:Math.round((deposits-spending)*100)/100,
 categories:Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,value])=>({name,amount:Math.round(value*100)/100}))};
}
export function publicBank(vault){
 const items=(vault.items||[]).map(x=>({id:x.id,institution:x.institution,
   accounts:(x.accounts||[]),lastSynced:x.lastSynced||null,error:x.error||null}));
 const transactions=(vault.items||[]).flatMap(item=>(item.transactions||[]).map(t=>({...t,institution:item.institution})))
   .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,150);
 const stats=incomeStats(vault.items||[]);
 return {connected:items.length>0,items,transactions,stats,prefs:vault.prefs||blankVault().prefs,
  lastSynced:Math.max(0,...items.map(i=>i.lastSynced||0))};
}
const HOST={sandbox:'https://sandbox.plaid.com',production:'https://production.plaid.com'};
export async function plaid(path,params,timeout=16000){
 const env=process.env.PLAID_ENV||'sandbox',host=HOST[env];
 if(!host)throw Error('Invalid Plaid environment');
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeout);
 try{
  const response=await fetch(host+path,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({...params,client_id:process.env.PLAID_CLIENT_ID,secret:process.env.PLAID_SECRET}),signal:ctrl.signal});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload||payload.error_code){
   const e=new Error(payload?.display_message||payload?.error_message||'Plaid provider is unavailable');
   e.code=payload?.error_code||'PLAID_ERROR';e.status=response.status;throw e;
  }
  return payload;
 }finally{clearTimeout(timer);}
}
async function transactionsFor(item){
 const access_token=item.accessToken,firstCursor=item.cursor||'';
 let collected=[],modified=[],removed=[],cursor=firstCursor,hasMore=true,retries=0;
 while(hasMore){
  if(collected.length+modified.length>950)throw Error('Transaction update too large; try later');
  let page;
  try{page=await plaid('/transactions/sync',{access_token,cursor,count:100},19000);}
  catch(error){
   if(error.code==='TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION'&&retries++<2){
    collected=[];modified=[];removed=[];cursor=firstCursor;hasMore=true;continue;
   }
   throw error;
  }
  collected.push(...(page.added||[]));modified.push(...(page.modified||[]));removed.push(...(page.removed||[]));
  hasMore=page.has_more===true;cursor=page.next_cursor||cursor;
  if((collected.length+modified.length+removed.length)>1100)throw Error('Too many transaction pages');
 }
 const latest=new Map((item.transactions||[]).map(t=>[t.id,t]));
 for(const t of removed)latest.delete(t.transaction_id);
 const newTransactions=[];
 for(const raw of [...collected,...modified]){
  const t=normalizeTransaction(raw);
  if(!t)continue;
  if(!latest.has(t.id)&&!t.pending&&item.lastSynced)newTransactions.push(t);
  latest.set(t.id,t);
 }
 const tx=[...latest.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,MAX_TX_PER_ITEM);
 return {transactions:tx,cursor,newTransactions};
}
export async function refreshVault(vault,{transactions=true,liveBalance=false}={}){
 const news=[],warnings=[];
 for(const item of vault.items||[]){
  try{
   const a=await plaid(liveBalance?'/accounts/balance/get':'/accounts/get',{access_token:item.accessToken},liveBalance?25000:15000);
   item.accounts=(a.accounts||[]).map(normalizeAccount).filter(Boolean);
   if(transactions){
    const updates=await transactionsFor(item);
    item.transactions=updates.transactions;item.cursor=updates.cursor;
    news.push(...updates.newTransactions.map(t=>({...t,itemId:item.id,institution:item.institution})));
   }
   item.lastSynced=Date.now();item.error=null;
  }catch(err){item.error=String(err?.code||'SYNC_FAILED').slice(0,60);warnings.push(item.institution+': '+item.error);}
 }
 return {vault,newTransactions:news,warnings};
}
export function financeAlerts(oldVault,newVault,newTransactions){
 const prefs=newVault.prefs||blankVault().prefs,alerts=[];
 for(const t of newTransactions){
  if(prefs.deposits&&t.amount<0&&!isTransfer(t))
   alerts.push({id:'dep:'+t.id,kind:'deposit',amount:Math.abs(t.amount),title:'Deposit detected',body:'A new deposit was reported by your bank.'});
  if(prefs.largePurchases&&t.amount>0&&!isTransfer(t)&&t.amount>=(Number(prefs.largeAmount)||250))
   alerts.push({id:'spend:'+t.id,kind:'spending',amount:t.amount,title:'Large transaction detected',body:'A transaction reached your alert threshold.'});
 }
 if(prefs.lowBalance){
  const oldAccounts=new Map((oldVault.items||[]).flatMap(i=>i.accounts||[]).map(a=>[a.id,a]));
  for(const account of (newVault.items||[]).flatMap(i=>i.accounts||[])){
   if(account.type!=='depository'||account.subtype!=='checking'||account.current===null)continue;
   const previous=oldAccounts.get(account.id)?.current;
   const limit=Number(prefs.lowThreshold)||100;
   if(account.current<limit&&(previous===undefined||previous===null||previous>=limit))
    alerts.push({id:'low:'+account.id+':'+Math.floor(Date.now()/86400000),kind:'balance',
      amount:account.current,title:'Checking balance below threshold',body:'A bank-reported checking balance crossed your alert threshold.'});
  }
 }
 return alerts.slice(0,20);
}
