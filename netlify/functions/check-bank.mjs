/* Scheduled bank refresh runs without the browser or a user's banking code. Plaid still controls institution update cadence. */
import {bankReady,readVault} from '../lib/bank-core.mjs';
import {syncBank,deliverBankAlerts} from '../lib/bank-service.mjs';
export default async function handler(){
 if(!bankReady()){console.log('LifeOS bank sync: not configured');return;}
 try{
  const vault=await readVault();
  if(!vault.items?.length)return;
  const result=await syncBank({liveBalance:false});
  console.log('LifeOS bank check:',result.vault.items.length,'connections;',result.alerts,'new alert conditions;',result.delivery.accepted,'accepted by push provider;',result.warnings.length,'upstream warnings');
 }catch(e){
  // Do not log account names, transaction descriptions or sensitive tokens.
  console.error('LifeOS bank background sync error',String(e?.code||'SYNC_FAILED').slice(0,55));
 }
}
