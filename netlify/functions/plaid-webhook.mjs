/* Plaid webhook: reject unsigned/replayed events; never trust an item ID alone. */
import {decodeProtectedHeader,importJWK,jwtVerify} from 'jose';
import {createHash,timingSafeEqual} from 'node:crypto';
import {currentEnvironment,isConfigured,readVault} from '../lib/bank-security.mjs';
import {plaidBank,updateBanks,deliverBankAlerts} from '../lib/bank-background.mjs';
const res=(status,message)=>new Response(message,{status,headers:{'content-type':'text/plain','cache-control':'no-store'}});
export async function verifyPlaidWebhook(raw,jwt){
 if(typeof jwt!=='string'||jwt.length>3000)throw Error('Missing or invalid signature');
 const header=decodeProtectedHeader(jwt);
 if(header.alg!=='ES256'||typeof header.kid!=='string'||header.kid.length>180)throw Error('Unsupported signature');
 const verification=await plaidBank('webhook_verification_key/get',{key_id:header.kid},12000);
 const key=verification.key;
 if(!key||key.alg&&key.alg!=='ES256')throw Error('Unrecognized webhook key');
 const publicKey=await importJWK(key,'ES256');
 const {payload}=await jwtVerify(jwt,publicKey,{algorithms:['ES256'],maxTokenAge:'5m',clockTolerance:30});
 if(typeof payload.request_body_sha256!=='string'||!/^[a-f0-9]{64}$/.test(payload.request_body_sha256))throw Error('Webhook hash missing');
 const expected=Buffer.from(payload.request_body_sha256,'hex');
 const actual=createHash('sha256').update(raw,'utf8').digest();
 if(!timingSafeEqual(expected,actual))throw Error('Webhook body hash mismatch');
 return true;
}
export default async function handler(request){
 if(request.method!=='POST')return res(405,'POST only');
 if(!isConfigured())return res(503,'Bank configuration missing');
 let raw;
 try{raw=await request.text();if(raw.length>10000)return res(413,'Payload too large');}
 catch{return res(400,'Invalid request');}
 try{await verifyPlaidWebhook(raw,request.headers.get('plaid-verification'));}
 catch(e){console.warn('LifeOS rejected unverified Plaid webhook',String(e.message).slice(0,100));return res(401,'Unverified webhook');}
 let event;
 try{event=JSON.parse(raw);}catch{return res(400,'Malformed JSON');}
 if(event.environment&&event.environment!==currentEnvironment())return res(202,'Environment ignored');
 if(event.webhook_type!=='TRANSACTIONS'||event.webhook_code!=='SYNC_UPDATES_AVAILABLE')return res(202,'Ignored');
 const id=String(event.item_id||'');
 try{
  const vault=await readVault();
  if(!vault.items?.some(item=>item.itemId===id))return res(202,'Not linked');
  await updateBanks({itemId:id,includeAccounts:true});
  await deliverBankAlerts();
  return res(200,'Processed');
 }catch(error){
  console.error('LifeOS webhook sync error',String(error.code||error.message).slice(0,100));
  return res(503,'Retry later');
 }
}
