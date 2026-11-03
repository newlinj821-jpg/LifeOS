/* LifeOS Money: read-only bank connection, private owner access, practical alerts. */
(() => {
'use strict';
const state={config:null,code:'',data:null,busy:false,msg:'',error:false,tab:'accounts',showAll:false};
const clean=x=>safe(String(x??''));
const dollars=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
const date=x=>x?new Date(x).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Not yet';
const path='/.netlify/functions/bank';
async function send(action,extra={}){
 const res=await fetch(path,{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-lifeos-owner-code':state.code},body:JSON.stringify({action,...extra})});
 const data=await res.json().catch(()=>({error:'Bank response was unreadable'}));
 if(!res.ok){const error=new Error(data.error||'Bank request failed');error.code=data.code;throw error;}
 return data;
}
async function showConfig(){
 try{const res=await fetch(path,{cache:'no-store'});state.config=await res.json();}
 catch{state.config={configured:false};state.msg='Bank service is not reachable on this deployment.';state.error=true;}
 draw();
}
function panel(){
 const cfg=state.config;
 let content='';
 if(!cfg)content='<p class="fine">Checking bank connection availability…</p>';
 else if(!cfg.configured)content='<div class="bank-start"><strong>Connect a bank when you are ready</strong><p>Plaid has not yet been configured in Netlify. All manual income, savings and expenses still work.</p>'+
 '<a href="https://github.com/newlinj821-jpg/LifeOS/blob/main/docs/PLAID_SETUP.md" target="_blank" rel="noopener noreferrer">How to configure Plaid</a></div>';
 else if(!state.code)content='<div class="bank-start"><strong>Unlock your banking view</strong><p>Enter the private owner code you configured in Netlify. It stays in app memory only, never in your LifeOS backup.</p>'+
 '<form id="bankUnlock"><label for="bankOwnerCode">Private LifeOS bank owner code</label><div class="bank-form-row"><input class="field" id="bankOwnerCode" name="ownerCode" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="20" required placeholder="Enter private access code"><button class="primary-btn" type="submit">Unlock</button></div></form></div>';
 else if(!state.data?.connected)content='<div class="bank-start"><strong>No bank connected yet</strong><p>Choose your checking or savings institution in Plaid. This is read-only: no transfer or withdrawal permission.</p><div class="bank-actions"><button class="primary-btn" data-bank="connect">Connect checking or savings</button><button class="outline-btn" data-bank="status">Refresh status</button><button class="ghost-btn" data-bank="lock">Lock</button></div></div>';
 else {
 const d=state.data,accounts=(d.items||[]).flatMap(i=>(i.accounts||[]).map(a=>({...a,institution:i.institution,itemId:i.id})));
 const tx=d.transactions||[],va=tx.filter(x=>x.vaBenefit&&!x.pending),prefs=d.prefs||{};
 const notifyState=d.delivery?.lastStatus||'Not paired';
 content='<div class="bank-actions"><button class="outline-btn" data-bank="refresh">Refresh data</button><button class="outline-btn" data-bank="connect">Connect another bank</button><button class="ghost-btn" data-bank="lock">Lock bank view</button></div>'+
 '<p class="bank-footnote">Last checked '+clean(date(d.lastSynced))+'. Plaid controls when each bank provides new transactions; this is not a live account stream.</p>'+
 '<div class="bank-tabs">'+[['accounts','Accounts'],['activity','Activity'],['alerts','Alerts'],['manage','Manage']].map(([id,label])=>'<button class="'+(state.tab===id?'active':'')+'" data-bank-tab="'+id+'">'+label+'</button>').join('')+'</div>';
 if(state.tab==='accounts'){
  content+='<div class="bank-account-grid">'+accounts.map(a=>'<article class="bank-account"><small>'+clean(a.institution)+' · '+clean(a.subtype||a.type)+'</small><strong>'+clean(a.name)+' <span>••'+clean(a.mask)+'</span></strong><b>'+(a.current===null?'Unavailable':dollars(a.current))+'</b><small>Reported balance'+(a.available!==null?' · Available '+dollars(a.available):'')+'</small></article>').join('')+'</div>'+
  '<div class="bank-stat-grid"><div><small>Recent deposits</small><strong>'+dollars(d.stats?.deposits)+'</strong></div><div><small>Recent spending</small><strong>'+dollars(d.stats?.spending)+'</strong></div><div><small>VA credits found</small><strong>'+va.length+'</strong></div></div>'+
  '<p class="bank-footnote">Bank figures and manual monthly income/savings are separate. Recent totals cover the retained transaction sample, not necessarily one full month.</p>';
 }else if(state.tab==='activity'){
  content+=tx.length?'<div class="bank-transactions">'+tx.slice(0,state.showAll?80:12).map(t=>'<div class="bank-transaction"><div><strong>'+clean(t.vaBenefit?'VA benefits':t.name)+'</strong><small>'+clean(t.institution)+' · '+clean(t.date)+(t.pending?' · Pending':'')+'</small></div><b class="'+(t.amount<0?'bank-credit':'')+'">'+(t.amount<0?'+':'−')+dollars(Math.abs(t.amount))+'</b></div>').join('')+'</div><button class="outline-btn" data-bank="more">'+(state.showAll?'Show fewer':'Show more transactions')+'</button>':'<p class="fine">Plaid has not returned transaction history yet. Initial sync can take time.</p>';
 }else if(state.tab==='alerts'){
  content+='<form id="bankPrefs"><p class="fine">These alerts are event-triggered, not random reminders. They appear after new posted data reaches Plaid. Amounts are hidden from the lock screen by default.</p>'+
   [['vaDeposits','VA benefits deposited','Notify when a new posted VA benefit credit is detected.'],
    ['deposits','Other deposits','Notify on non-VA deposits, excluding transfers.'],
    ['largePurchases','Large purchases','Alert when a posted purchase exceeds the threshold.'],
    ['lowBalance','Low checking balance','Alert once on crossing below the chosen threshold.'],
    ['showAmounts','Show amounts on lock screen','Optional; LifeOS private-preview mode overrides this.']].map(([name,label,sub])=>'<label class="bank-toggle"><span><strong>'+label+'</strong><small>'+sub+'</small></span><input name="'+name+'" type="checkbox" '+(prefs[name]?'checked':'')+'></label>').join('')+
   '<div class="bank-two-fields"><label>Large purchase threshold ($)<input class="field" type="text" inputmode="decimal" name="largeAmount" value="'+clean(prefs.largeAmount||250)+'"></label>'+
   '<label>Low balance threshold ($)<input class="field" type="text" inputmode="decimal" name="lowThreshold" value="'+clean(prefs.lowThreshold||100)+'"></label></div>'+
   '<div class="bank-actions"><button class="primary-btn" type="submit">Save alert settings</button><button class="outline-btn" data-bank="pair">Enable bank alerts on this phone</button><button class="ghost-btn" data-bank="unpair">Stop bank push</button></div></form>'+
   '<p class="bank-footnote">Delivery: '+clean(notifyState)+' · '+Number(d.queuedAlerts||0)+' queued. Provider acceptance does not prove the phone displayed an alert.</p>';
 }else{
  content+='<div class="bank-institution-list">'+(d.items||[]).map(i=>'<div class="bank-institution"><div><strong>'+clean(i.institution)+'</strong><small>Last checked '+clean(date(i.lastSynced))+(i.error?' · '+clean(i.error):'')+'</small></div><div class="bank-actions"><button class="outline-btn" data-bank="reconnect" data-item="'+clean(i.id)+'">Reconnect</button><button class="danger-btn" data-bank="remove" data-item="'+clean(i.id)+'">Disconnect</button></div></div>').join('')+'</div>';
 }
 }
 return '<section class="panel panel-pad bank-panel" id="bankPanel"><div class="bank-title"><div><div class="eyebrow">OPTIONAL · READ ONLY</div><h2>Bank connections</h2><p class="fine">Checking, savings, transactions and useful alerts alongside your manual budget.</p></div>'+
 '<span class="bank-chip">'+(state.data?.connected?'Connected':'Private')+'</span></div>'+
 (state.msg?'<div class="bank-notice '+(state.error?'bank-error':'')+'" role="status">'+clean(state.msg)+'</div>':'')+
 (state.busy?'<p class="bank-working" role="status">Contacting bank service…</p>':'')+content+'</section>';
}
function draw(){
 if(typeof currentPage!=='undefined'&&currentPage==='money'){
  const main=document.querySelector('#view .finance-page');
  if(!main)return;
  const current=main.querySelector('#bankPanel');
  if(current){current.outerHTML=panel();return;}
  const anchor=main.querySelector('.finance-panels');
  if(anchor)anchor.insertAdjacentHTML('beforebegin',panel());else main.insertAdjacentHTML('beforeend',panel());
 }
}
async function read(){
 if(!state.code)return;
 state.busy=true;draw();
 try{state.data=await send('status');state.msg='';state.error=false;}
 catch(e){state.msg=e.message;state.error=true;if(e.code==='OWNER_REQUIRED')state.code='';}
 finally{state.busy=false;draw();}
}
async function action(name,extra={}){
 state.busy=true;state.msg='';draw();
 try{
  const res=await send(name,extra);
  if(name==='preferences')state.data.prefs=res.prefs;
  else if(name==='attach-push')state.msg='This verified phone can now receive new bank alerts.';
  else if(name==='detach-push')state.msg='Bank push alerts turned off for this phone.';
  else if(name==='remove'){state.data=res;state.msg='Bank disconnected.';state.tab='accounts';}
  else{state.data=res;state.msg=name==='refresh'?'Bank check completed.':'Bank connection updated.';}
  state.error=false;
 }catch(e){state.error=true;state.msg=e.message;}
 finally{state.busy=false;draw();}
}
let scriptReady=null;
async function plaidScript(){
 if(window.Plaid?.create)return;
 if(!scriptReady)scriptReady=new Promise((resolve,reject)=>{const s=document.createElement('script');
  s.src='https://cdn.plaid.com/link/v2/stable/link-initialize.js';s.async=true;
  s.onload=()=>window.Plaid?.create?resolve():reject(Error('Plaid Link did not initialize.'));
  s.onerror=()=>reject(Error('Plaid Link could not load. Check network and blockers.'));document.head.append(s);});
 return scriptReady;
}
async function connect(itemId){
 if(state.busy)return;state.busy=true;state.msg='Opening Plaid Link…';draw();
 try{
  const data=await send(itemId?'update-link':'link',itemId?{itemId}:{});
  await plaidScript();
  const handler=window.Plaid.create({token:data.linkToken,
   onSuccess:async(publicToken,metadata)=>{
    if(itemId)await action('refresh');
    else await action('exchange',{publicToken,institution:metadata?.institution?.name||'Connected bank'});
    handler.destroy?.();
   },
   onExit:err=>{if(err){state.error=true;state.msg=String(err.display_message||err.error_message||'Plaid Link was cancelled').slice(0,160);}handler.destroy?.();draw();}
  });
  handler.open();
 }catch(e){state.msg=e.message;state.error=true;}
 finally{state.busy=false;draw();}
}
async function pair(){
 try{
  if(!pushEnabled)throw Error('First enable and verify notifications under LifeOS Settings.');
  const sub=await navigator.serviceWorker.ready.then(r=>r.pushManager.getSubscription());
  if(!sub)throw Error('No active push subscription. Reconnect notifications first.');
  await action('attach-push',{subscription:sub.toJSON(),manageToken:getManageToken()});
 }catch(e){state.msg=e.message;state.error=true;draw();}
}
const previousRender=render;
render=function(){previousRender();draw();};
document.addEventListener('submit',async e=>{
 if(e.target.id==='bankUnlock'){
  e.preventDefault();
  const code=String(e.target.elements.namedItem('ownerCode')?.value||'').trim();
  if(code.length<20){state.error=true;state.msg='Enter the full private banking access code.';draw();return;}
  state.code=code;await read();return;
 }
 if(e.target.id==='bankPrefs'){
  e.preventDefault();const form=e.target,f=new FormData(form);
  const amount=x=>String(form.elements.namedItem(x)?.value||'').trim();
  if(!LifeOSFinanceCore.validAmount(amount('largeAmount'))||!LifeOSFinanceCore.validAmount(amount('lowThreshold'))){
   state.error=true;state.msg='Enter valid numeric thresholds before saving.';draw();return;
  }
  await action('preferences',{preferences:{vaDeposits:f.has('vaDeposits'),deposits:f.has('deposits'),
   largePurchases:f.has('largePurchases'),largeAmount:LifeOSFinanceCore.amount(amount('largeAmount')),
   lowBalance:f.has('lowBalance'),lowThreshold:LifeOSFinanceCore.amount(amount('lowThreshold')),
   showAmounts:f.has('showAmounts')}});
 }
});
document.addEventListener('click',async e=>{
 const t=e.target.closest('[data-bank]');if(!t||state.busy)return;
 const a=t.dataset.bank,itemId=t.dataset.item||'';
 if(a==='connect'||a==='reconnect')await connect(a==='reconnect'?itemId:'');
 if(a==='status')await read();
 if(a==='refresh')await action('refresh');
 if(a==='pair')await pair();
 if(a==='unpair')await action('detach-push');
 if(a==='more'){state.showAll=!state.showAll;draw();}
 if(a==='lock'){state.code='';state.data=null;state.msg='Bank view locked. Background synchronization continues on the server.';draw();}
 if(a==='remove'&&confirm('Disconnect this institution and stop its future updates?'))await action('remove',{itemId});
});
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-bank-tab]');if(!t)return;
 state.tab=t.dataset.bankTab;draw();
});
showConfig();
})();
