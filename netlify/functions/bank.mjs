/* Read-only LifeOS / Plaid API. Server-side secrets only, single-owner authorization. */
import {getStore} from '@netlify/blobs';
import {json,digest,authorized,validSubscription} from '../lib/core.mjs';
import {bankReady,blankVault,readVault,writeVault,plaid,publicBank,bankStore,LIMIT_ITEMS} from '../lib/bank-core.mjs';
import {syncBank,deliverBankAlerts} from '../lib/bank-service.mjs';
const safe=s=>String(s||'').replace(/[<>\x00-\x1f]/g,' ').trim().slice(0,75);
const error=(code,message,status=400)=>json({code,error:message},status);
export default async function handler(req){
 if(req.method==='GET')return json({configured:bankReady(),environment:process.env.PLAID_ENV||'not configured',readOnly:true});
 if(req.method!=='POST')return error('METHOD','POST required',405);
 const origin=req.headers.get('origin');
 if(origin&&origin!==new URL(req.url).origin)return error('ORIGIN','Open LifeOS from its own website.',403);
 let b;try{const raw=await req.text();if(raw.length>25000)return error('TOO_LARGE','Request is too large.',413);b=JSON.parse(raw);}catch{return error('INVALID_JSON','Invalid request payload.');}
 const action=String(b?.action||'');
 if(action==='config')return json({configured:bankReady(),environment:process.env.PLAID_ENV||null,readOnly:true});
 if(!bankReady())return error('NOT_CONFIGURED','Finish Plaid and bank vault setup in Netlify before connecting.',503);
 if(!authorized(req.headers.get('x-lifeos-owner-code'),digest(process.env.LIFEOS_BANK_OWNER_CODE)))return error('OWNER_REQUIRED','Enter your LifeOS banking access code.',401);
 try{
  if(action==='status'){
   const vault=await readVault();
   return json({ok:true,...publicBank(vault),delivery:vault.delivery||null,queuedAlerts:(vault.pendingAlerts||[]).length});
  }
  if(action==='link'||action==='update-link'){
   const vault=await readVault();
   const params={client_name:'LifeOS',user:{client_user_id:'lifeos-private-owner'},country_codes:['US'],language:'en'};
   if(process.env.PLAID_REDIRECT_URI)params.redirect_uri=process.env.PLAID_REDIRECT_URI;
   if(action==='link'){
    if(vault.items.length>=LIMIT_ITEMS)return error('ACCOUNT_LIMIT','Maximum of five linked institutions in this version.',400);
    params.products=['transactions'];
   }else{
    const found=vault.items.find(x=>x.id===String(b.itemId||''));
    if(!found)return error('MISSING_ACCOUNT','That bank connection was not found.',404);
    params.access_token=found.accessToken;
   }
   const result=await plaid('/link/token/create',params,12000);
   return json({ok:true,linkToken:result.link_token,expiration:result.expiration,update:action==='update-link'});
  }
  if(action==='exchange'){
   const publicToken=String(b.publicToken||'');
   if(!/^[a-zA-Z0-9_-]{10,350}$/.test(publicToken))return error('INVALID_TOKEN','Plaid did not provide a valid connection token.');
   const vault=await readVault();
   if(vault.items.length>=LIMIT_ITEMS)return error('ACCOUNT_LIMIT','Maximum of five linked institutions.',400);
   const result=await plaid('/item/public_token/exchange',{public_token:publicToken});
   if(vault.items.some(x=>x.id===result.item_id))return json({ok:true,alreadyConnected:true,...publicBank(vault)});
   const record={id:String(result.item_id||''),accessToken:String(result.access_token||''),
     institution:safe(b.institution||'Connected institution'),accounts:[],transactions:[],cursor:'',
     connectedAt:Date.now(),lastSynced:0,error:null};
   if(!record.id||!record.accessToken)return error('PLAID_EXCHANGE','The bank returned an incomplete connection.');
   vault.items.push(record);
   await writeVault(vault);
   try{await syncBank();}catch(e){console.warn('Initial bank history pending',String(e.code||e.message||'error').slice(0,100));}
   return json({ok:true,...publicBank(await readVault())});
  }
  if(action==='refresh'){
   const result=await syncBank({liveBalance:b.liveBalance===true});
   return json({ok:true,...publicBank(result.vault),warnings:result.warnings,
     delivery:result.vault.delivery||null,queuedAlerts:(result.vault.pendingAlerts||[]).length});
  }
  if(action==='preferences'){
   const vault=await readVault();
   const p=b.preferences||{},old=vault.prefs||blankVault().prefs;
   const expectedPaycheck=p.expectedPaycheck===null||p.expectedPaycheck===''?0:Number(p.expectedPaycheck);
   if(!Number.isFinite(expectedPaycheck)||expectedPaycheck<0||expectedPaycheck>100000000||
     Math.abs(Math.round(expectedPaycheck*100)-expectedPaycheck*100)>1e-6)
    return error('INVALID_PAYCHECK','Enter a valid paycheck amount with no more than two decimal places.');
   vault.prefs={...old,
    paycheck:p.paycheck===true,expectedPaycheck,
    deposits:p.deposits===true,
    largePurchases:p.largePurchases===true,largeAmount:Math.min(100000,Math.max(1,Number(p.largeAmount)||250)),
    lowBalance:p.lowBalance===true,lowThreshold:Math.min(100000,Math.max(1,Number(p.lowThreshold)||100)),
    showAmounts:p.showAmounts===true,showDetails:false};
   await writeVault(vault);
   return json({ok:true,prefs:vault.prefs});
  }
  if(action==='attach-push'){
   if(!validSubscription(b.subscription))return error('INVALID_PUSH','Enable and verify LifeOS notifications on this phone first.');
   const key='device-'+digest(b.subscription.endpoint);
   const dev=await getStore('lifeos-push-devices').get(key,{type:'json'});
   if(!dev||!authorized(b.manageToken,dev.manageHash))return error('PUSH_NOT_VERIFIED','Finish notification verification in LifeOS Settings first.',403);
   const vault=await readVault();vault.pushKey=key;await writeVault(vault);
   return json({ok:true,attached:true});
  }
  if(action==='detach-push'){
   const vault=await readVault();vault.pushKey=null;vault.pendingAlerts=[];await writeVault(vault);
   return json({ok:true,attached:false});
  }
  if(action==='remove'){
   const vault=await readVault(),item=vault.items.find(x=>x.id===String(b.itemId||''));
   if(!item)return error('NOT_FOUND','Connection not found.',404);
   await plaid('/item/remove',{access_token:item.accessToken});
   vault.items=vault.items.filter(x=>x.id!==item.id);
   await writeVault(vault);
   return json({ok:true,...publicBank(vault)});
  }
  return error('UNKNOWN_ACTION','Unknown banking operation.');
 }catch(e){
  const code=String(e?.code||'BANK_UNAVAILABLE').slice(0,64);
  console.error('LifeOS bank action failed',action,code,String(e?.message||'').slice(0,130));
  if(code==='ITEM_LOGIN_REQUIRED')return error(code,'Bank authorization needs to be renewed. Use Reconnect bank.',409);
  if(code==='PRODUCT_NOT_READY')return error(code,'Your institution is still preparing transaction history. Try later.',409);
  if(code==='INVALID_PRODUCT' || code==='PRODUCT_NOT_ENABLED')return error(code,'Transactions access is not enabled in your Plaid account.',403);
  return error(code,'Could not complete the bank request. Check your Plaid configuration or try again.',502);
 }
}
