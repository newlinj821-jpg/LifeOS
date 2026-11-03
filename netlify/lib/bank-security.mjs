/* LifeOS bank owner authentication + authenticated encryption of server-side tokens/data. */
import {createHash,createCipheriv,createDecipheriv,randomBytes,timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';
const digest=x=>createHash('sha256').update(String(x)).digest('hex');
export const currentEnvironment=()=>process.env.PLAID_ENV==='production'?'production':'sandbox';
export const isConfigured=()=>Boolean(
 process.env.PLAID_CLIENT_ID&&process.env.PLAID_SECRET&&
 typeof process.env.LIFEOS_BANK_SETUP_KEY==='string'&&process.env.LIFEOS_BANK_SETUP_KEY.length>=24&&
 /^[0-9a-fA-F]{64}$/.test(process.env.LIFEOS_BANK_ENCRYPTION_KEY||'')
);
export const verifySetupKey=provided=>{
 if(typeof provided!=='string'||provided.length<24||provided.length>256||!isConfigured())return false;
 const h1=Buffer.from(digest(provided),'hex'),h2=Buffer.from(digest(process.env.LIFEOS_BANK_SETUP_KEY),'hex');
 return timingSafeEqual(h1,h2);
};
export const newSession=()=>randomBytes(32).toString('hex');
const sessions=()=>getStore('lifeos-bank-device-sessions');
export async function storeSession(token){
 await sessions().setJSON('session-'+digest(token),{until:Date.now()+12*3600_000});
}
export async function sessionValid(auth){
 if(typeof auth!=='string'||!/^Bearer [0-9a-f]{64}$/.test(auth))return false;
 const v=auth.slice(7),record=await sessions().get('session-'+digest(v),{type:'json'});
 return Number.isFinite(record?.until)&&Date.now()<record.until;
}
export async function deleteSession(auth){
 if(typeof auth==='string'&&/^Bearer [0-9a-f]{64}$/.test(auth))await sessions().delete('session-'+digest(auth.slice(7)));
}
const vault=()=>getStore('lifeos-bank-secure-vault');
const key=()=>Buffer.from(process.env.LIFEOS_BANK_ENCRYPTION_KEY,'hex');
export function seal(object){
 if(!isConfigured())throw Error('Bank vault is not configured.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 const data=Buffer.from(JSON.stringify(object),'utf8'),ciphertext=Buffer.concat([cipher.update(data),cipher.final()]);
 return {v:1,iv:iv.toString('base64'),data:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64')};
}
export function unseal(data){
 if(!data)return null;
 if(data.v!==1||!data.iv||!data.data||!data.tag)throw Error('Bank vault is unreadable. Do not change the encryption key after linking.');
 const dec=createDecipheriv('aes-256-gcm',key(),Buffer.from(data.iv,'base64'));
 dec.setAuthTag(Buffer.from(data.tag,'base64'));
 return JSON.parse(Buffer.concat([dec.update(Buffer.from(data.data,'base64')),dec.final()]).toString('utf8'));
}
export async function readVault(){
 const value=await vault().get('owner',{type:'json'});
 return value?unseal(value):{ownerId:'lifeos-'+randomBytes(16).toString('hex'),items:[],createdAt:Date.now()};
}
export async function writeVault(record){await vault().setJSON('owner',seal(record));}
