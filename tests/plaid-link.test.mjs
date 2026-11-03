import test from 'node:test';
import assert from 'node:assert/strict';
import {plaidLinkOptions,describePlaidError} from '../netlify/lib/plaid-link.mjs';

const owner={ownerId:'lifeos-owner-1'};
const config={
 redirect:'https://livelaughos.netlify.app/',
 webhook:'https://livelaughos.netlify.app/.netlify/functions/plaid-webhook'
};
test('LifeOS production Link token request includes exact approved redirect and webhook',()=>{
 const result=plaidLinkOptions(owner,null,config);
 assert.equal(result.redirect_uri,config.redirect);
 assert.equal(result.webhook,config.webhook);
 assert.deepEqual(result.products,['transactions']);
 assert.deepEqual(result.country_codes,['US']);
 assert.equal(result.user.client_user_id,owner.ownerId);
 assert.equal(Object.hasOwn(result,'secret'),false);
});
test('Link update mode retains the access token without changing requested products',()=>{
 const result=plaidLinkOptions(owner,{accessToken:'access-example'},config);
 assert.equal(result.access_token,'access-example');
 assert.ok(!Object.hasOwn(result,'products'));
 assert.ok(!Object.hasOwn(result,'webhook'));
 assert.equal(result.redirect_uri,config.redirect);
});
test('Web-only fallback omits redirect field without disabling read-only transactions',()=>{
 const result=plaidLinkOptions(owner,null,config,true);
 assert.ok(!('redirect_uri' in result));
 assert.equal(result.webhook,config.webhook);
 assert.deepEqual(result.products,['transactions']);
});
test('Malformed redirect URI is rejected before calling Plaid',()=>{
 for(const redirect of ['http://livelaughos.netlify.app/','https://livelaughos.netlify.app/#money',
  'https://livelaughos.netlify.app/?key=somewhere']){
  assert.throws(()=>plaidLinkOptions(owner,null,{redirect}),{code:'INVALID_REDIRECT_CONFIGURATION'});
 }
});
test('Plaid INVALID_FIELD pinpoints rejected redirect without leaking API credentials',()=>{
 const details=describePlaidError({error_code:'INVALID_FIELD',
  error_message:'redirect_uri is not included in your allowed redirect URIs',
  request_id:'AbCdEf1234'},'link/token/create');
 assert.equal(details.code,'PLAID_REDIRECT_NOT_ALLOWED');
 assert.equal(details.field,'redirect_uri');
 assert.equal(details.canTryWebOnly,true);
 assert.equal(details.requestId,'AbCdEf1234');
 assert.ok(details.message.includes('Allowed Redirect URIs'));
});
test('Plaid INVALID_FIELD distinguishes webhook from redirect and includes request ID',()=>{
 const details=describePlaidError({error_code:'INVALID_FIELD',
  error_message:'webhook is not a valid URL',request_id:'Request4567'},'link/token/create');
 assert.equal(details.code,'PLAID_WEBHOOK_INVALID');
 assert.equal(details.field,'webhook');
 assert.equal(details.requestId,'Request4567');
 assert.ok(!details.canTryWebOnly);
});
test('Unknown INVALID_FIELD remains actionable without passing arbitrary server text to browser',()=>{
 const details=describePlaidError({error_code:'INVALID_FIELD',
  error_message:'secret: foo private-token-123',request_id:'id-123456'},'link/token/create');
 assert.equal(details.code,'INVALID_FIELD');
 assert.ok(details.message.includes('Logs'));
 assert.ok(!details.message.includes('private-token-123'));
});
test('Exact LifeOS redirect URI is in setup instructions and user-facing fallback',async()=>{
 const doc=(await import('node:fs')).readFileSync(new URL('../docs/PLAID_SETUP.md',import.meta.url),'utf8');
 assert.ok(doc.includes('PLAID_REDIRECT_URI'));
 const bank=(await import('node:fs')).readFileSync(new URL('../bank-ui.js',import.meta.url),'utf8');
 assert.ok(bank.includes('connect-web'));
 assert.ok(bank.includes('requestId'));
});
