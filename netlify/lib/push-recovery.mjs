/* Proof-of-possession recovery for a Web Push endpoint. Codes never leave the push channel. */
import {randomInt,randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const hex=value=>createHash('sha256').update(value).digest('hex');
export const RECOVERY_TTL_MS=10*60_000;
export const RECOVERY_COOLDOWN_MS=75_000;
export const RECOVERY_MAX_ATTEMPTS=5;
export const RECOVERY_MAX_STARTS_PER_HOUR=5;
export const validRecoveryCode=value=>typeof value==='string'&&/^\d{6}$/.test(value);
export const recoveryDigest=(code,endpoint,salt)=>hex(String(endpoint)+'|'+String(salt)+'|'+String(code));
export function newRecovery(endpoint,now=Date.now(),previous){
 const code=String(randomInt(0,1000000)).padStart(6,'0');
 const salt=randomBytes(16).toString('hex');
 const since=previous&&now-(previous.hourWindowAt||0)<3600000;
 const starts=since?(previous.hourStarts||0)+1:1;
 return {code,record:{hash:recoveryDigest(code,endpoint,salt),salt,startedAt:now,expiresAt:now+RECOVERY_TTL_MS,attempts:0,hourWindowAt:since?previous.hourWindowAt:now,hourStarts:starts}};
}
export function recoveryCanStart(current,now=Date.now()){
 if(!current)return {ok:true};
 if(now-(current.startedAt||0)<RECOVERY_COOLDOWN_MS)return {ok:false,code:'RECOVERY_COOLDOWN',error:'A verification code was just sent. Wait a minute before requesting another.'};
 if(now-(current.hourWindowAt||0)<3600000&&(current.hourStarts||0)>=RECOVERY_MAX_STARTS_PER_HOUR)return {ok:false,code:'RECOVERY_RATE_LIMIT',error:'Too many verification requests for this phone. Try again in an hour.'};
 return {ok:true};
}
export function verifyRecovery(record,code,endpoint,now=Date.now()){
 if(!record||!validRecoveryCode(code))return {ok:false,code:'INVALID_CODE'};
 if(!Number.isFinite(record.expiresAt)||now>record.expiresAt)return {ok:false,code:'CODE_EXPIRED'};
 if((record.attempts||0)>=RECOVERY_MAX_ATTEMPTS)return {ok:false,code:'TOO_MANY_ATTEMPTS'};
 const expected=record.hash||'',actual=recoveryDigest(code,endpoint,record.salt||'');
 if(!/^[0-9a-f]{64}$/.test(expected)||!timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex')))return {ok:false,code:'INVALID_CODE'};
 return {ok:true};
}
