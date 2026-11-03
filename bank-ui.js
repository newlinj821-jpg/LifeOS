/* LifeOS Bank Connections — opt-in, read-only, unobtrusive on Money screen. */
(() => {
 'use strict';
 if(typeof db==='undefined'||typeof render!=='function')return;
 const bank={config:null,summary:null,session:sessionStorage.getItem('lifeos.bankSession')||'',busy:false,error:'',
 tab:'overview',ready:false,lastFetched:0,linking:false};
 const fmt=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
 const clean=x=>safe(String(x??''));
 const date=x=>x?new Date(x).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Not updated yet';
 const timeAgo=x=>!x?'Never':Math.round((Date.now()-x)/60000)<2?'Just now':
 Math.round((Date.now()-x)/60000)<90?Math.round((Date.now()-x)/60000)+'m ago':
 Math.round((Date.now()-x)/3600000)<48?Math.round((Date.now()-x)/3600000)+'h ago':date(x);
 const escapeSelector=x=>String(x).replace(/["\\]/g,'');
 async function request(action,body={},session=bank.session){
  const result=await fetch('/.netlify/functions/plaid',{method:'POST',headers:{'content-type':'application/json',...(session?{authorization:'Bearer '+session}:{})},
   credentials:'same-origin',cache:'no-store',body:JSON.stringify({action,...body})});
  const json=await result.json().catch(()=>({error:'Bank service returned an invalid response.'}));
  if(!result.ok){
   if(result.status===401){bank.session='';bank.summary=null;sessionStorage.removeItem('lifeos.bankSession');}
   const error=new Error(json.error||'Bank service error');error.code=json.code;throw error;
  }
  return json;
 }
 function notify(message){bank.error=message;toast(message);refreshUI();}
 function lastSync(){const t=bank.summary?.updatedAt;return timeAgo(t);}
 function configure(){
  if(bank.config&&!bank.config.configured)return '<section class="panel panel-pad bank-panel"><h2>Connect a bank, when you’re ready</h2>'+
   '<p class="fine">Plaid is not configured yet. Your manual income, savings and expenses continue working without it.</p>'+
   '<p class="bank-hint">Set the Plaid and private LifeOS bank keys in Netlify, then redeploy. No banking credentials go in GitHub.</p>'+
   '<a href="https://github.com/newlinj821-jpg/LifeOS/blob/main/docs/PLAID_SETUP.md" target="_blank" rel="noopener">Plaid setup guide</a></section>';
  return '<section class="panel panel-pad bank-panel"><div class="bank-section-head"><div><div class="eyebrow">OPTIONAL BANK CONNECTION</div><h2>Connect your checking and savings</h2></div><span class="bank-status">Read only</span></div>'+
   '<p class="fine">Your bank information is kept in a private encrypted server vault. Manual budgets and savings never disappear.</p>'+
   '<form id="lifeBankUnlock"><label for="bankSetupPassword">Private LifeOS bank access key</label>'+
   '<input class="field" type="password" id="bankSetupPassword" name="password" autocomplete="off" required minlength="24" placeholder="Enter your LifeOS bank access key">'+
   '<button class="primary-btn" type="submit">Unlock bank dashboard</button></form>'+
   '<p class="bank-hint">This is the separate access key you set in Netlify—not your bank password or Plaid secret.</p></section>';
 }
 function accounts(){
  const s=bank.summary,all=s.accounts||[];
  return '<div class="bank-accounts">'+(all.length?all.map(x=>
   '<div class="bank-account"><span><strong>'+clean(x.name||x.subtype||'Bank account')+'</strong>'+
   '<small>'+clean(x.institution||'Connected bank')+' · '+clean(x.type||'Account')+' ·••'+clean(x.mask||'')+'</small></span>'+
   '<strong>'+ (Number.isFinite(x.current)?fmt(x.current):'Balance unavailable')+'</strong></div>').join(''):
   '<p class="fine">No accounts returned yet. Some banks take time to complete linking.</p>')+'</div>';
 }
 function income(){
  const p=bank.summary?.paychecks||{},monthly=bank.summary?.thisMonth||{},recent=p.latest;
  return '<div class="bank-income-grid"><div><span>Paycheck / benefits detected</span><strong>'+(recent?fmt(recent.amount):'—')+'</strong>'+
   '<small>'+(recent?'Last seen '+clean(recent.date):'No confirmed payroll deposits yet')+'</small></div>'+
   '<div><span>Deposits this month</span><strong>'+fmt(monthly.deposits)+'</strong><small>Bank-reported posted credits; excludes identified transfers</small></div>'+
   '<div><span>Deposit cadence</span><strong>'+clean(p.cadence||'Unknown')+'</strong><small>'+(p.nextEstimated?'Next estimated: '+clean(p.nextEstimated)+' (not guaranteed)':'Needs multiple historical deposits')+'</small></div></div>'+
   '<p class="fine">LifeOS recognizes descriptions such as VACP TREAS 310 and XXVA BENEF. Other payroll can be added below. Bank deposits are shown separately from your manually entered monthly income to prevent double-counting.</p>';
 }
 function transactions(){
  const list=bank.summary?.transactions||[];
  return '<div class="bank-transactions">'+(list.length?list.slice(0,35).map(t=>{
   const isCredit=t.amount<0;
   return '<div class="bank-transaction"><span><strong>'+clean(t.title||'Transaction')+'</strong>'+
    '<small>'+clean(t.date||'')+' · '+clean(t.institution||'Bank')+(t.pending?' · Pending':'')+'</small></span>'+
    '<strong class="'+(isCredit?'bank-credit':'')+'">'+(isCredit?'+':'−')+fmt(Math.abs(t.amount))+'</strong></div>';
  }).join(''):'<p class="fine">Transactions will appear once Plaid has retrieved them from your bank.</p>')+'</div>';
 }
 function preferences(){
  const p=bank.summary?.bankAlerts||{};
  return '<form id="bankAlertForm" class="bank-pref-form"><div class="bank-pref-intro"><h3>Useful notifications, not constant alerts</h3>'+
   '<p class="fine">Paycheck notifications are the only alert enabled by default after you connect this phone. Nothing is sent for historical deposits, pending transactions, or routine balance changes.</p></div>'+
   '<label><input type="checkbox" name="paycheck" '+(p.paycheck?'checked':'')+'> Tell me when a paycheck is reported</label>'+
   '<label><input type="checkbox" name="otherDeposits" '+(p.otherDeposits?'checked':'')+'> Other posted deposits (optional)</label>'+
   '<label><input type="checkbox" name="largeExpense" '+(p.largeExpense?'checked':'')+'> Unusually large purchases (optional)</label>'+
   '<div class="bank-small-field"><label for="bankLargeAmount">Purchase alert amount</label><input class="field" id="bankLargeAmount" type="number" min="1" step="0.01" name="largeExpenseAmount" value="'+(p.largeExpenseAmount||300)+'"></div>'+
   '<label><input type="checkbox" name="lowBalance" '+(p.lowBalance?'checked':'')+'> Checking account falls below a limit (optional)</label>'+
   '<div class="bank-small-field"><label for="bankLowAmount">Low-balance limit</label><input class="field" type="number" min="1" step="0.01" id="bankLowAmount" name="lowBalanceAmount" value="'+(p.lowBalanceAmount||100)+'"></div>'+
   '<label><input type="checkbox" name="showAmounts" '+(p.showAmounts?'checked':'')+'> Include dollar amounts on my lock screen</label>'+
   '<div class="bank-small-field"><label for="bankMatch">Additional paycheck description to recognize</label>'+
   '<input class="field" type="text" id="bankMatch" maxlength="45" name="paycheckMatches" value="'+clean((p.paycheckMatches||[]).join(', '))+'" placeholder="e.g. PAYROLL COMPANY">'+
   '<small>Use commas to separate more than one. Benefit descriptors are automatically recognized.</small></div>'+
   '<button class="outline-btn" type="submit">Save notification preferences</button>'+
   '</form>';
 }
 function markup(){
  if(!bank.ready)return '<section class="panel panel-pad bank-panel"><h2>Bank connection</h2><p class="fine">Checking bank configuration…</p></section>';
  if(!bank.config?.configured||!bank.session||!bank.summary)return configure();
  const s=bank.summary;
  const controls='<div class="bank-actions"><button class="primary-btn" type="button" data-bank="connect">＋ Link bank</button>'+
    '<button class="outline-btn" type="button" data-bank="refresh" '+(bank.busy?'disabled':'')+'>Refresh data</button>'+
    '<button class="ghost-btn" type="button" data-bank="lock">Lock</button></div>';
  const institutions=(s.institutions||[]).map(x=>
   '<div class="bank-institution"><span><strong>'+clean(x.name)+'</strong>'+
    '<small>Updated '+timeAgo(x.transactionsUpdatedAt||x.updatedAt)+(x.warning?' · '+clean(x.warning):'')+'</small></span>'+
    '<button class="minor" type="button" data-bank-update="'+clean(x.id)+'">Reconnect</button>'+
    '<button class="minor danger-btn" type="button" data-bank-remove="'+clean(x.id)+'">Disconnect</button></div>').join('');
  return '<section class="panel panel-pad bank-panel"><div class="bank-section-head"><div><div class="eyebrow">BANK OVERVIEW</div><h2>Connected accounts</h2>'+
    '<p class="fine">Private read-only access · Last updated '+lastSync()+'</p></div><span class="bank-status">'+clean(s.environment)+'</span></div>'+
    controls+(bank.error?'<p class="bank-error" role="status">'+clean(bank.error)+'</p>':'')+
    '<div class="bank-tabs">'+[['overview','Overview'],['income','Paychecks'],['activity','Activity'],['alerts','Alerts']].map(([id,label])=>
      '<button class="'+(bank.tab===id?'active':'')+'" type="button" data-bank-tab="'+id+'">'+label+'</button>').join('')+'</div>'+
    (bank.tab==='overview'?accounts()+income():bank.tab==='income'?income():bank.tab==='activity'?transactions():
     '<div class="bank-alert-options">'+
      '<div class="bank-alert-state"><strong>'+(s.pushConnected?'Bank alerts connected':'Bank alerts are off')+'</strong>'+
      '<p class="fine">Notifications require a verified LifeOS push subscription. Quiet hours: 10 PM–8 AM. Maximum two bank alerts per day.</p>'+
      (s.pushConnected?'<button class="outline-btn" type="button" data-bank="unlink-push">Turn off bank push</button>':
       '<button class="primary-btn" type="button" data-bank="link-push">Connect phone notifications</button>')+'</div>'+
      preferences()+'</div>')+
    '<div class="bank-institutions">'+institutions+'</div>'+
    '<p class="fine bank-footnote">Connected banks update in the background when Plaid reports activity, with periodic fallback checks. This is not instant bank data. Real-time paid Balance and Transactions Refresh add-ons are not enabled.</p></section>';
 }
 function refreshUI(){
  if(currentPage!=='money')return;
  const main=$('#view'),prior=main?.querySelector('#lifeBankMount');
  if(prior)prior.innerHTML=markup();
 }
 const oldRender=render;
 render=function(){
  oldRender();
  if(currentPage==='money'){
   const here=$('#view .finance-panels');
   if(here&&!$('#lifeBankMount'))here.insertAdjacentHTML('afterend','<div id="lifeBankMount">'+markup()+'</div>');
   if(!bank.ready)init();
  }
 };
 let inFlight=false;
 async function init(){
  if(inFlight||bank.ready)return;
  inFlight=true;
  try{
   bank.config=await request('config',{},'');
   bank.ready=true;
   if(bank.session){
    try{const x=await request('status');bank.summary=x.summary;}
    catch{bank.session='';sessionStorage.removeItem('lifeos.bankSession');}
   }
  }catch(e){bank.ready=true;bank.error=String(e.message||e);}
  finally{inFlight=false;refreshUI();}
 }
 async function run(action,body={}){
  if(bank.busy)return;
  bank.busy=true;bank.error='';refreshUI();
  try{
   const result=await request(action,body);
   if(result.summary)bank.summary=result.summary;
   if(action==='refresh')toast('Bank data checked. '+(result.warnings?.length?'Some connections need attention.':'Up to date with Plaid’s latest available data.'));
   if(action==='link-notifications')toast('Bank alerts connected to this phone. Paycheck alerts are enabled.');
   if(action==='unlink-notifications')toast('Bank push alerts turned off.');
  }catch(e){notify(e.message||'Bank request failed.');}
  finally{bank.busy=false;refreshUI();}
 }
 function loadPlaidScript(){
  if(window.Plaid?.create)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   let script=document.querySelector('script[data-life-plaid]');
   if(script){script.addEventListener('load',resolve,{once:true});script.addEventListener('error',()=>reject(Error('Plaid Link could not load.')),{once:true});return;}
   script=document.createElement('script');script.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';
   script.async=true;script.dataset.lifePlaid='1';script.onload=resolve;
   script.onerror=()=>reject(Error('Plaid Link could not load. Check your connection.'));
   document.head.append(script);
  });
 }
 async function link(updateItemId){
  if(bank.busy||bank.linking)return;
  bank.linking=true;bank.error='';refreshUI();
  try{
   await loadPlaidScript();
   const data=await request('link-token',updateItemId?{updateItemId}:{});
   const handler=window.Plaid.create({token:data.linkToken,
    onSuccess:async(publicToken,metadata)=>{
     try{
      if(updateItemId){await run('refresh');toast('Bank reconnected.');}
      else{await run('exchange',{publicToken,institution:metadata?.institution?.name||'Connected bank'});await run('refresh');}
     }catch(e){notify(e.message||'Unable to finish linking.');}
     finally{handler.destroy?.();}
    },
    onExit:(err)=>{if(err)notify('Plaid connection ended: '+(err.display_message||err.error_message||'Try again.'));handler.destroy?.();},
    onLoad:()=>{}
   });
   handler.open();
  }catch(error){notify(String(error.message||error));}
  finally{bank.linking=false;refreshUI();}
 }
 async function pairPush(){
  try{
   if(!('serviceWorker' in navigator))throw Error('Install LifeOS and enable notifications in Settings first.');
   const registration=await navigator.serviceWorker.ready,sub=await registration.pushManager.getSubscription();
   const manageToken=localStorage.getItem('lifeos.pushToken');
   if(!sub||!manageToken)throw Error('Enable and verify regular LifeOS notifications in Settings before connecting bank alerts.');
   await run('link-notifications',{subscription:sub.toJSON(),manageToken});
  }catch(e){notify(e.message||'Cannot connect notifications.');}
 }
 document.addEventListener('submit',async event=>{
  if(event.target.id==='lifeBankUnlock'){
   event.preventDefault();const input=event.target.querySelector('#bankSetupPassword'),key=input?.value||'';
   if(key.length<24){notify('Enter your private LifeOS bank access key from Netlify.');return;}
   input.value='';
   try{bank.busy=true;refreshUI();const result=await request('unlock',{setupKey:key},'');
    bank.session=result.session;sessionStorage.setItem('lifeos.bankSession',bank.session);
    bank.summary=result.summary;bank.error='';bank.tab='overview';toast('Bank dashboard unlocked.');
   }catch(e){bank.error=e.message||'Unlock failed.';}
   finally{bank.busy=false;refreshUI();}
  }else if(event.target.id==='bankAlertForm'){
   event.preventDefault();
   const f=new FormData(event.target);
   const values={
    paycheck:f.has('paycheck'),otherDeposits:f.has('otherDeposits'),
    largeExpense:f.has('largeExpense'),largeExpenseAmount:Number(f.get('largeExpenseAmount')),
    lowBalance:f.has('lowBalance'),lowBalanceAmount:Number(f.get('lowBalanceAmount')),
    showAmounts:f.has('showAmounts'),
    paycheckMatches:String(f.get('paycheckMatches')||'').split(',').map(x=>x.trim()).filter(Boolean)
   };
   await run('notification-prefs',{prefs:values});toast('Notification preferences saved.');
  }
 });
 document.addEventListener('click',async e=>{
  if(currentPage!=='money')return;
  const tab=e.target.closest('[data-bank-tab]');
  if(tab){bank.tab=tab.dataset.bankTab;refreshUI();return;}
  const update=e.target.closest('[data-bank-update]');if(update){await link(update.dataset.bankUpdate);return;}
  const remove=e.target.closest('[data-bank-remove]');
  if(remove){if(confirm('Disconnect this bank and remove its saved transactions from LifeOS? Your manually entered budget stays intact.'))await run('disconnect',{itemId:remove.dataset.bankRemove});return;}
  const button=e.target.closest('[data-bank]');if(!button)return;
  const action=button.dataset.bank;
  if(action==='connect')await link();
  if(action==='refresh')await run('refresh');
  if(action==='link-push')await pairPush();
  if(action==='unlink-push')await run('unlink-notifications');
  if(action==='lock'){try{await request('lock');}catch{}
   bank.session='';bank.summary=null;sessionStorage.removeItem('lifeos.bankSession');refreshUI();toast('Bank dashboard locked.');}
 });
})();
