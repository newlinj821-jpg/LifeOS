/* Read-only Plaid connection. All financial API requests use a scoped, short-lived server session. */
(() => {
 'use strict';
 if(typeof render!=='function'||typeof db==='undefined')return;
 const state={config:null,summary:null,session:sessionStorage.getItem('lifeos.bankSession')||'',busy:false,loading:false,ready:false,message:'',error:false,tab:'accounts',showAll:false};
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
 const clean=x=>safe(String(x??''));
 const when=x=>x?new Date(x).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not yet';
 async function api(action,data={},token=state.session){
  const result=await fetch('/.netlify/functions/plaid',{method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},
   body:JSON.stringify({action,...data})});
  const response=await result.json().catch(()=>({error:'Bank service response was unreadable'}));
  if(!result.ok){
   const error=new Error(response.error||'Bank service is unavailable');error.code=response.code;
   if(result.status===401){state.session='';state.summary=null;sessionStorage.removeItem('lifeos.bankSession');}
   throw error;
  }
  return response;
 }
 function cashflow(){
  const income=state.summary?.paychecks||{},latest=income.latest,month=state.summary?.thisMonth||{};
  return '<div class="bank-income-grid">'+
   '<div><span>Last matching paycheck</span><strong>'+(latest?money(latest.amount):'—')+'</strong>'+
   '<small>'+(latest?'Posted '+clean(latest.date):'Set an expected amount and connect a bank')+'</small></div>'+
   '<div><span>Bank deposits this month</span><strong>'+money(month.deposits||0)+'</strong><small>Bank-reported deposits, excluding identified transfers</small></div>'+
   '<div><span>Estimated pay schedule</span><strong>'+clean(income.cadence||'Unknown')+'</strong><small>'+(income.nextEstimated?'Estimated next: '+clean(income.nextEstimated):'Needs multiple matching deposits')+'</small></div></div>'+
   '<p class="fine">Expected pay is classified separately from ordinary deposits. Monthly income and savings in your manual LifeOS budget stay editable and are not double counted.</p>';
 }
 function accounts(){
  const all=state.summary?.accounts||[];
  return '<div class="bank-accounts">'+(all.length?all.map(x=>
   '<div class="bank-account"><span><strong>'+clean(x.name||x.subtype||'Account')+'</strong>'+
    '<small>'+clean(x.institution||'Bank')+' · '+clean(x.subtype||x.type||'Account')+' · ••'+clean(x.mask||'')+'</small></span>'+
    '<strong>'+(Number.isFinite(x.current)?money(x.current):'Unavailable')+'</strong></div>').join(''):
    '<p class="fine" style="padding:16px">No accounts yet. After linking, select Refresh data.</p>')+'</div>';
 }
 function activity(){
  const list=state.summary?.transactions||[];
  return '<div class="bank-transactions">'+(list.length?list.slice(0,state.showAll?80:15).map(x=>
   '<div class="bank-transaction"><span><strong>'+clean(x.title||'Transaction')+'</strong>'+
   '<small>'+clean(x.date||'')+' · '+clean(x.institution||'Bank')+(x.pending?' · Pending':'')+'</small></span>'+
   '<strong class="'+(x.amount<0?'bank-credit':'')+'">'+(x.amount<0?'+':'−')+money(Math.abs(x.amount))+'</strong></div>').join(''):
   '<p class="fine" style="padding:16px">Transactions will appear after your bank reports them to Plaid.</p>')+'</div>'+
   (list.length>15?'<button class="outline-btn" style="margin-top:10px" data-bank="more">'+(state.showAll?'Show fewer':'Show more')+'</button>':'');
 }
 function alerts(){
  const p=state.summary?.bankAlerts||{};
  const expected=p.expectedPaycheckAmount??'';
  return '<div class="bank-alert-state"><strong>'+(state.summary?.pushConnected?'Bank alerts are connected':'Bank alerts are off')+'</strong>'+
   '<p class="fine">First verify normal LifeOS notifications in Settings. When enabled, we send at most two bank notifications a day, avoid 10 PM–8 AM, and never alert for pending deposits or historical backfill.</p>'+
   (state.summary?.pushConnected?'<button class="outline-btn" type="button" data-bank="unpair">Turn off bank alerts</button>':
   '<button class="primary-btn" type="button" data-bank="pair">Connect this phone for bank alerts</button>')+'</div>'+
   '<form id="lifeBankAlerts" class="bank-pref-form"><div class="bank-pref-intro"><h3>Your expected paycheck amount</h3>'+
   '<p class="fine">Only a new posted deposit matching this amount <strong>exactly</strong> will be called a paycheck. A larger or smaller payment is treated as an ordinary deposit.</p></div>'+
   '<div class="bank-small-field"><label for="bankExpectedPay">Expected amount ($)</label>'+
   '<input class="field" type="text" inputmode="decimal" maxlength="15" id="bankExpectedPay" name="expectedPaycheckAmount" placeholder="e.g. 2500.00" value="'+clean(expected)+'">'+
   '<small>Enter the exact amount you normally receive. Amounts are matched to the cent.</small></div>'+
   '<label><input type="checkbox" name="paycheck" '+(p.paycheck?'checked':'')+'> Notify me when that paycheck is detected</label>'+
   '<label><input type="checkbox" name="otherDeposits" '+(p.otherDeposits?'checked':'')+'> Other deposits (on by default)</label>'+
   '<label><input type="checkbox" name="largeExpense" '+(p.largeExpense?'checked':'')+'> Large purchases (off by default)</label>'+
   '<div class="bank-small-field"><label for="bankSpendingThreshold">Large purchase amount ($)</label><input class="field" type="text" inputmode="decimal" id="bankSpendingThreshold" name="largeExpenseAmount" value="'+clean(p.largeExpenseAmount||300)+'"></div>'+
   '<label><input type="checkbox" name="lowBalance" '+(p.lowBalance?'checked':'')+'> Low checking balance (off by default)</label>'+
   '<div class="bank-small-field"><label for="bankLowThreshold">Low balance amount ($)</label><input class="field" type="text" inputmode="decimal" id="bankLowThreshold" name="lowBalanceAmount" value="'+clean(p.lowBalanceAmount||100)+'"></div>'+
   '<label><input type="checkbox" name="showAmounts" '+(p.showAmounts?'checked':'')+'> Show bank amounts on my lock screen</label>'+
   '<button class="primary-btn" type="submit">Save paycheck and alert settings</button></form>'+
   '<p class="fine bank-footnote">Bank alerts depend on Plaid delivering a posted transaction and your phone accepting push. Detection may be delayed. They are never scheduled at random times.</p>';
 }
 function institutions(){
  const list=state.summary?.institutions||[];
  return '<div class="bank-institutions">'+(list.length?list.map(x=>
   '<div class="bank-institution"><span><strong>'+clean(x.name||'Connected bank')+'</strong>'+
   '<small>Last sync: '+clean(when(x.transactionsUpdatedAt||x.updatedAt))+(x.warning?' · '+clean(x.warning):'')+'</small></span>'+
   '<button class="outline-btn" type="button" data-bank-reconnect="'+clean(x.id)+'">Reconnect</button>'+
   '<button class="ghost-btn" type="button" data-bank-disconnect="'+clean(x.id)+'">Remove</button></div>').join(''):
   '<p class="fine">No institutions linked.</p>')+'</div>';
 }
 function markup(){
  if(!state.ready)return '<section class="panel panel-pad bank-panel" id="lifeBankPanel"><h2>Bank connection</h2><p class="fine">Checking availability…</p></section>';
  let contents='';
  if(!state.config?.configured)contents='<h2>Bank connection</h2><p class="fine">Plaid is not configured in Netlify yet. Manual finances continue to work.</p>'+
   '<a href="https://github.com/newlinj821-jpg/LifeOS/blob/main/docs/PLAID_SETUP.md" target="_blank" rel="noopener">How to connect Plaid</a>';
  else if(!state.session||!state.summary)contents='<h2>Unlock your bank connection</h2>'+
   '<p class="fine">Enter your private LifeOS banking access key from Netlify, not your bank password or Plaid secret.</p>'+
   '<form id="lifeBankUnlock" autocomplete="off"><label for="lifeBankKey">Bank access key</label>'+
   '<input class="field" type="password" id="lifeBankKey" minlength="24" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="LifeOS private bank key">'+
   '<button class="primary-btn" type="submit">Unlock bank view</button></form>';
  else contents='<div class="bank-section-head"><div><div class="eyebrow">BANK OVERVIEW</div><h2>Checking and savings</h2>'+
   '<p class="fine">Read only · Last updated '+clean(when(state.summary.updatedAt))+'</p></div>'+
   '<span class="bank-status">'+clean(state.summary.environment)+'</span></div>'+
   '<div class="bank-actions"><button class="primary-btn" type="button" data-bank="connect">＋ Connect bank</button>'+
   '<button class="outline-btn" type="button" data-bank="refresh">Refresh data</button>'+
   '<button class="ghost-btn" type="button" data-bank="lock">Lock</button></div>'+
   '<div class="bank-tabs">'+[['accounts','Accounts'],['paychecks','Paychecks'],['activity','Activity'],['alerts','Alerts'],['manage','Manage']].map(([k,v])=>
   '<button type="button" data-bank-tab="'+k+'" class="'+(state.tab===k?'active':'')+'">'+v+'</button>').join('')+'</div>'+
   (state.tab==='accounts'?accounts()+cashflow():state.tab==='paychecks'?cashflow()+alerts():state.tab==='activity'?activity():state.tab==='alerts'?alerts():institutions())+
   '<p class="fine bank-footnote">Bank data stays separate from your manual income, bills and savings. Background checks may run with LifeOS closed, but bank availability controls when new transactions can be detected.</p>';
  return '<section class="panel panel-pad bank-panel" id="lifeBankPanel">'+contents+
   (state.message?'<p class="bank-error" role="status">'+clean(state.message)+'</p>':'')+
   (state.busy?'<p class="fine" role="status">Working with Plaid…</p>':'')+'</section>';
 }
 function redraw(){
  if(currentPage!=='money')return;
  const element=document.querySelector('#view .finance-page');if(!element)return;
  const existing=element.querySelector('#lifeBankPanel');
  if(existing){existing.outerHTML=markup();return;}
  const anchor=element.querySelector('.finance-panels');
  if(anchor)anchor.insertAdjacentHTML('beforebegin',markup());
  else element.insertAdjacentHTML('beforeend',markup());
 }
 let inFlight=false;
 async function init(){
  if(inFlight||state.ready)return;
  inFlight=true;
  try{
   state.config=await api('config',{},'');
   state.ready=true;
   if(state.session){try{const x=await api('status');state.summary=x.summary;}catch{state.session='';sessionStorage.removeItem('lifeos.bankSession');}}
  }catch(e){state.ready=true;state.message=e.message;}
  finally{inFlight=false;redraw();}
 }
 async function run(action,data={}){
  if(state.busy)return;
  state.busy=true;state.message='';redraw();
  try{
   const response=await api(action,data);
   if(response.summary)state.summary=response.summary;
   if(action==='refresh')toast('Bank sync requested. Showing the latest available posted transactions.');
   if(action==='link-notifications')toast('Bank notifications connected to this verified phone.');
   if(action==='unlink-notifications')toast('Bank notifications turned off.');
  }catch(e){state.message=e.message||'Unable to complete bank action.';}
  finally{state.busy=false;redraw();}
 }
 let linkLoading;
 function loadLink(){
  if(window.Plaid?.create)return Promise.resolve();
  if(linkLoading)return linkLoading;
  linkLoading=new Promise((resolve,reject)=>{
   const el=document.createElement('script');el.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';el.async=true;
   el.onload=()=>window.Plaid?.create?resolve():reject(Error('Plaid Link failed to initialize.'));
   el.onerror=()=>reject(Error('Cannot load Plaid Link. Check your internet connection.'));document.head.append(el);
  });
  return linkLoading;
 }
 async function link(updateItemId=''){
  if(state.busy)return;
  state.busy=true;redraw();
  try{
   await loadLink();
   const data=await api('link-token',updateItemId?{updateItemId}:{});
   const handler=window.Plaid.create({token:data.linkToken,onSuccess:async(publicToken,metadata)=>{
     if(updateItemId){await run('refresh');toast('Bank reconnected.');}
     else{await run('exchange',{publicToken,institution:metadata?.institution?.name||'Bank'});await run('refresh');}
     handler.destroy?.();
   },onExit:err=>{if(err)state.message=err.display_message||err.error_message||'Bank connection closed.';handler.destroy?.();redraw();}});
   handler.open();
  }catch(e){state.message=e.message||'Could not open Plaid.';}
  finally{state.busy=false;redraw();}
 }
 async function pair(){
  try{
   if(!('serviceWorker' in navigator))throw Error('First enable LifeOS notifications in Settings.');
   const sub=await navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription());
   const manageToken=localStorage.getItem('lifeos.pushToken');
   if(!sub||!manageToken)throw Error('Enable and verify notifications in Settings before connecting bank alerts.');
   await run('link-notifications',{subscription:sub.toJSON(),manageToken});
  }catch(e){state.message=e.message;redraw();}
 }
 const previousRender=render;
 render=function(){previousRender();redraw();if(currentPage==='money'&&!state.ready)init();};
 document.addEventListener('submit',async e=>{
  if(e.target.id==='lifeBankUnlock'){
   e.preventDefault();
   const input=e.target.querySelector('#lifeBankKey'),key=input?.value||'';
   if(key.length<24){state.message='Enter your complete private LifeOS bank access key.';redraw();return;}
   input.value='';
   try{const result=await api('unlock',{setupKey:key},'');
    state.session=result.session;sessionStorage.setItem('lifeos.bankSession',state.session);
    state.summary=result.summary;state.tab='accounts';state.message='';toast('Bank account view unlocked.');
   }catch(err){state.message=err.message||'Bank access failed.';}
   redraw();return;
  }
  if(e.target.id==='lifeBankAlerts'){
   e.preventDefault();const form=e.target,f=new FormData(form);
   const raw=String(f.get('expectedPaycheckAmount')||'').trim();
   const expected=raw===''?null:LifeOSFinanceCore.parseMoneyInput(raw);
   if(raw!==''&&(!Number.isFinite(expected)||expected<=0)){state.message='Enter a valid paycheck amount, or leave it blank to disable paycheck matching.';redraw();return;}
   const threshold=name=>LifeOSFinanceCore.parseMoneyInput(String(f.get(name)||'').trim());
   const large=threshold('largeExpenseAmount'),low=threshold('lowBalanceAmount');
   if(!(large>0)||!(low>0)){state.message='Enter valid positive alert thresholds.';redraw();return;}
   const prefs={expectedPaycheckAmount:expected,paycheck:f.has('paycheck'),otherDeposits:f.has('otherDeposits'),
    largeExpense:f.has('largeExpense'),largeExpenseAmount:large,lowBalance:f.has('lowBalance'),lowBalanceAmount:low,
    showAmounts:f.has('showAmounts'),paycheckMatches:String(f.get('paycheckMatches')||'').split(',').map(x=>x.trim()).filter(Boolean)};
   await run('notification-prefs',{prefs});return;
  }
 });
 document.addEventListener('click',async e=>{
  if(currentPage!=='money')return;
  const tab=e.target.closest('[data-bank-tab]');
  if(tab){state.tab=tab.dataset.bankTab;redraw();return;}
  const recon=e.target.closest('[data-bank-reconnect]');
  if(recon){await link(recon.dataset.bankReconnect);return;}
  const removal=e.target.closest('[data-bank-disconnect]');
  if(removal){if(confirm('Disconnect this bank? Manual LifeOS bills, income and savings will remain.'))await run('disconnect',{itemId:removal.dataset.bankDisconnect});return;}
  const el=e.target.closest('[data-bank]');if(!el)return;
  if(el.dataset.bank==='connect')await link();
  else if(el.dataset.bank==='refresh')await run('refresh');
  else if(el.dataset.bank==='pair')await pair();
  else if(el.dataset.bank==='unpair')await run('unlink-notifications');
  else if(el.dataset.bank==='lock'){try{await api('lock');}catch{}state.session='';state.summary=null;sessionStorage.removeItem('lifeos.bankSession');redraw();}
 });
})();
