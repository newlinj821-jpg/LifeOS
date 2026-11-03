/* Netlify scheduled fallback. Plaid webhooks provide the primary prompt for sync. */
import {isConfigured} from '../lib/bank-security.mjs';
import {updateBanks,deliverBankAlerts} from '../lib/bank-background.mjs';
export default async function handler(){
 if(!isConfigured()){console.log('LifeOS bank: Plaid not configured; scheduled check skipped.');return;}
 try{
  const result=await updateBanks({});
  const alerts=await deliverBankAlerts();
  console.log('LifeOS bank scheduled check: '+result.updated+' connections checked, '+alerts.sent+' alerts accepted by push provider, '+result.warnings.length+' warnings.');
 }catch(e){console.error('LifeOS scheduled bank check',String(e.code||e.message).slice(0,120));}
}
