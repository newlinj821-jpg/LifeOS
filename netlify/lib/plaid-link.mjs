/* Validated Plaid Link configuration and actionable provider-error mapping.
 * Never expose Plaid secrets or user bank data to browser errors/logs. */
const FIELDS=[
 'redirect_uri','webhook','user.client_user_id','client_name',
 'country_codes','language','products','access_token','link_customization_name'
];
const publicId=x=>/^[A-Za-z0-9_-]{6,80}$/.test(String(x||''))?String(x):null;
const isRedirectError=x=>/redirect[_ -]?uri|allowed redirect|redirect url|oauth redirect/i.test(String(x||''));
const isWebhookError=x=>/\bwebhook\b/i.test(String(x||''));
export function plaidLinkOptions(vault,item,config={},webWithoutRedirect=false){
 const base={user:{client_user_id:vault.ownerId},client_name:'LifeOS',country_codes:['US'],language:'en'};
 if(item)base.access_token=item.accessToken;
 else base.products=['transactions'];
 const webhook=String(config.webhook||'').trim();
 if(!item&&/^https:\/\/[^?#]+$/.test(webhook))base.webhook=webhook;
 if(!webWithoutRedirect){
  const redirect=String(config.redirect||'').trim();
  if(redirect){
   if(!/^https:\/\/[^?#]+$/.test(redirect))throw Object.assign(
    new Error('Your PLAID_REDIRECT_URI must be an HTTPS address without query parameters or a fragment.'),
    {code:'INVALID_REDIRECT_CONFIGURATION',status:400}
   );
   base.redirect_uri=redirect;
  }
 }
 return base;
}
export function describePlaidError(payload={},route=''){
 const code=String(payload.error_code||'PLAID_UNAVAILABLE').slice(0,75);
 const raw=String(payload.error_message||'').slice(0,500);
 const requestId=publicId(payload.request_id);
 if(code==='INVALID_FIELD'&&route==='link/token/create'){
  if(isRedirectError(raw))return {code:'PLAID_REDIRECT_NOT_ALLOWED',
   message:'Plaid rejected your redirect URI. In Plaid Dashboard → Build → API → Allowed Redirect URIs, add the exact address saved as PLAID_REDIRECT_URI in Netlify (including the final slash), then try again.',
   field:'redirect_uri',canTryWebOnly:true,requestId};
  if(isWebhookError(raw))return {code:'PLAID_WEBHOOK_INVALID',
   message:'Plaid rejected your webhook URL. Confirm PLAID_WEBHOOK_URL is a reachable HTTPS URL ending in /.netlify/functions/plaid-webhook, then redeploy.',
   field:'webhook',requestId};
  const field=FIELDS.find(x=>raw.toLowerCase().includes(x.toLowerCase()))||null;
  return {code,message:field?
    'Plaid rejected the '+field+' field in the bank connection request. Review the corresponding Plaid or Netlify setting.':
    'Plaid rejected a field in the bank connection request. Find the exact field in Plaid Dashboard → Logs, using the request ID below.',
    field,requestId};
 }
 if(code==='INVALID_FIELD')return {code,message:'Plaid rejected a request field. Review Plaid Dashboard → Logs for the exact rejected field.',requestId};
 if(code==='INVALID_PRODUCT'||code==='PRODUCT_NOT_ENABLED')return {code,
  message:'Plaid Transactions access is not enabled in the selected environment. Check Products and your Production/Trial access in Plaid Dashboard.',requestId};
 if(code==='INVALID_CREDENTIALS')return {code,
  message:'Plaid rejected the API credentials. Check your Production client ID, Production secret, and PLAID_ENV=production in Netlify.',requestId};
 if(code==='INVALID_CONFIGURATION')return {code,
  message:'Plaid rejected the Link configuration. Check your Production access and Link setup in Plaid Dashboard.',requestId};
 return {code,requestId};
}
