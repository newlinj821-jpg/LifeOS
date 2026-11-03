import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 newRecovery,recoveryCanStart,verifyRecovery,validRecoveryCode,recoveryDigest,
 RECOVERY_TTL_MS,RECOVERY_COOLDOWN_MS,RECOVERY_MAX_ATTEMPTS
} from '../netlify/lib/push-recovery.mjs';
const endpoint='https://web.push.apple.com/example-private-endpoint-token';
const now=Date.UTC(2026,10,3,20,0,0);
test('Creates a six-digit one-time code and stores only a salted hash',()=>{
 const {code,record}=newRecovery(endpoint,now);
 assert.match(code,/^\d{6}$/);
 assert.equal(record.hash.length,64);
 assert.ok(!JSON.stringify(record).includes(code),'Code must not be persisted in plain text');
 assert.equal(record.expiresAt-now,RECOVERY_TTL_MS);
 assert.equal(verifyRecovery(record,code,endpoint,now+1000).ok,true);
 assert.equal(recoveryDigest(code,endpoint,record.salt),record.hash);
});
test('Rejects wrong code, wrong endpoint, expired code, and attempted guessing',()=>{
 const {code,record}=newRecovery(endpoint,now);
 const wrong=code==='000000'?'111111':'000000';
 assert.deepEqual(verifyRecovery(record,wrong,endpoint,now+1000),{ok:false,code:'INVALID_CODE'});
 assert.equal(verifyRecovery(record,code,endpoint+'-attacker',now+1000).ok,false);
 assert.equal(verifyRecovery(record,code,endpoint,now+RECOVERY_TTL_MS+1).code,'CODE_EXPIRED');
 assert.equal(verifyRecovery({...record,attempts:RECOVERY_MAX_ATTEMPTS},code,endpoint,now+1000).code,'TOO_MANY_ATTEMPTS');
 assert.equal(validRecoveryCode('12345'),false);
 assert.equal(validRecoveryCode('abcdef'),false);
 assert.equal(validRecoveryCode('012345'),true);
});
test('Limits repeated notification code requests',()=>{
 const {record}=newRecovery(endpoint,now);
 assert.equal(recoveryCanStart(record,now+RECOVERY_COOLDOWN_MS-1).ok,false);
 assert.equal(recoveryCanStart(record,now+RECOVERY_COOLDOWN_MS).ok,true);
 let r=record;
 for(let i=1;i<5;i++)r=newRecovery(endpoint,now+i*RECOVERY_COOLDOWN_MS,r).record;
 assert.equal(recoveryCanStart(r,now+5*RECOVERY_COOLDOWN_MS).code,'RECOVERY_RATE_LIMIT');
 assert.equal(recoveryCanStart(r,now+3600001).ok,true);
});
test('Recovery is a separate action and cannot create a blind token reset',()=>{
 const code=readFileSync(new URL('../netlify/functions/push.mjs',import.meta.url),'utf8');
 for(const id of ["recover-start","recover-finish","verifyRecovery","DEVICE_TOKEN_MISMATCH","webpush.sendNotification","manageHash:digest(newManageToken)"]){
  assert.ok(code.includes(id),id);
 }
 assert.match(code,/recovery:verification\.record/);
 assert.match(code,/delete updated\.recovery/);
 assert.match(code,/const validTime=x=>\/\^\(\[01\]\\d\|2\[0-3\]\):\[0-5\]\\d\$\//);
});
test('Front end requires real server enrollment for push testing and offers recovery UI',()=>{
 const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const snippet of ["startPushRecovery(subscription)","pushRecoveryPending","data-push-verify","pushPayload('recover-finish'","pushPayload('test',sub)","This phone needs to reconnect"]){
  assert.ok(js.includes(snippet),snippet);
 }
 assert.ok(!js.includes("LifeOS · Local notification test"),'Do not imply a local notification proves background push works');
 assert.ok(js.includes("navigator.serviceWorker.addEventListener('message'"),'Client should accept service worker verification proof');
 assert.ok(js.includes("recoveryCodeFromPush"),'Code can arrive before server acknowledgement');
 const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(worker.includes("client.postMessage")||worker.includes("target.postMessage"),'Worker should relay proof to an active client');
 const server=readFileSync(new URL('../netlify/functions/push.mjs',import.meta.url),'utf8');
 assert.ok(server.includes("type:'lifeos-device-verification',code:verification.code"),'Only recovery pushes contain a verification code');
 assert.ok(server.indexOf("await store.setJSON(key,{...prev,recovery:verification.record})")<server.indexOf("await webpush.sendNotification(b.subscription"),'Persist challenge before delivering it to prevent a race');
});
test('iOS PWA reserves status bar and uses native document scrolling for keyboard focus',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../app-mobile.css',import.meta.url),'utf8');
 assert.match(html,/apple-mobile-web-app-status-bar-style" content="black"/);
 assert.ok(!html.includes('black-translucent'));
 assert.ok(css.includes('position:sticky!important'));
 assert.ok(css.includes('overflow-y:auto!important'));
 assert.ok(css.includes('touch-action:auto!important'));
 assert.ok(css.includes('lifeos-keyboard-open .mobile-bottom'));
 assert.ok(!css.includes('/* Mobile shell v2: ONE scroll container'));
});
