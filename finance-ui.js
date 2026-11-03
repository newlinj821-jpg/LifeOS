/* LifeOS Money: intentionally simple monthly cash-flow and savings management. */
(() => {
 'use strict';
 if(typeof db==='undefined'||!window.LifeOSFinanceCore){console.error('LifeOS Money could not start');return;}
 const F=window.LifeOSFinanceCore;
 const currency=amount=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(amount)?amount:0);
 const clean=s=>safe(String(s??''));
 const currentMonth=()=>dayKey(new Date()).slice(0,7);
 let selectedMonth=currentMonth(),editing=!db.finance,view='all',query='';
 const finance=()=>F.profile(db.finance);
 const prettyMonth=value=>{const [y,m]=value.split('-').map(Number);return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(y,m-1,1));};
 const offsetMonth=(month,delta)=>{const [y,m]=month.split('-').map(Number),d=new Date(y,m-1+delta,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
 function metricCard(symbol,label,value,small='',special=false){
  return '<div class="finance-metric '+(special?'finance-metric-highlight':'')+'"><div class="finance-metric-top"><span class="finance-metric-icon">'+symbol+'</span><span>'+clean(label)+'</span></div>'+
  '<strong>'+clean(value)+'</strong>'+(small?'<small>'+clean(small)+'</small>':'')+'</div>';
 }
 function cardTotals(stats){
  const savingsLine=stats.plannedSavings?'Includes '+currency(stats.plannedSavings)+' in planned savings transfers':'No savings transfers planned yet';
  return '<div class="finance-metrics">'+
   metricCard('↓','Monthly income',currency(stats.income),'Expected take-home income')+
   metricCard('↑','Monthly commitments',currency(stats.planned),savingsLine)+
   metricCard('↗','Available after commitments',currency(stats.available),'Income minus planned expenses and savings',true)+
   metricCard('◇','Savings balance',currency(stats.savingsBalance),stats.savingsGoal?'Goal: '+currency(stats.savingsGoal):'Your manually tracked savings balance')+
  '</div>';
 }
 function setupPanel(){
  const current=finance();
  return '<section class="panel panel-pad finance-setup"><div class="finance-section-head"><div><h2>Set up your money</h2><p class="fine">Three amounts. Update them whenever your finances change.</p></div>'+
   (db.finance?'<button class="minor" data-finance="edit">Close</button>':'')+'</div>'+
   '<form id="financeSetupForm"><div class="finance-setup-fields">'+
   '<label><span>Monthly income</span><small>How much you usually receive each month after deductions</small><input class="field" id="financeIncome" name="monthlyIncome" type="number" min="0" max="100000000" step="0.01" inputmode="decimal" required value="'+current.monthlyIncome+'"></label>'+
   '<label><span>Current savings balance</span><small>The money actually in your savings, not a planned deposit</small><input class="field" id="financeSavingsBalance" name="savingsBalance" type="number" min="0" max="100000000" step="0.01" inputmode="decimal" required value="'+current.savingsBalance+'"></label>'+
   '<label><span>Savings goal</span><small>Optional target — enter 0 to leave this unset</small><input class="field" id="financeSavingsGoal" name="savingsGoal" type="number" min="0" max="100000000" step="0.01" inputmode="decimal" required value="'+current.savingsGoal+'"></label>'+
   '</div><div class="finance-setup-footer"><span class="fine">Stored privately on this device with your other LifeOS data.</span><button type="submit" class="primary-btn">Save amounts</button></div></form></section>';
 }
 function savingsPanel(stats){
  const max=stats.savingsGoal;
  const current=stats.savingsBalance;
  const progress=stats.savingsProgress;
  const remaining=Math.max(0,F.amount(max-current));
  return '<section class="panel panel-pad finance-savings"><div class="finance-section-head"><div><div class="eyebrow">SAVINGS</div><h2>Your savings</h2></div><button class="minor" data-finance="edit">Edit balance</button></div>'+
   '<div class="finance-saving-balance"><strong>'+currency(current)+'</strong><span>'+(max?'of '+currency(max)+' goal':'Current tracked balance')+'</span></div>'+
   (max?'<div class="finance-progress" role="progressbar" aria-label="Savings goal progress" aria-valuenow="'+progress+'" aria-valuemin="0" aria-valuemax="100"><div style="width:'+progress+'%"></div></div>'+
   '<p class="fine finance-goal-summary">'+progress+'% saved · '+currency(remaining)+' left to reach your goal</p>':
   '<p class="fine">Add a savings goal whenever you have one.</p>')+
   '<div class="finance-savings-transfer"><div><strong>'+currency(stats.plannedSavings)+' planned this month</strong><span>'+currency(stats.paidSavings)+' marked completed</span></div><button class="outline-btn" data-finance="savings">＋ Savings transfer</button></div>'+
   '<p class="fine finance-disclaimer">Savings transfers count as monthly expenses in your cash-flow plan. Your savings balance changes only when you edit it, so LifeOS never assumes an unconfirmed transfer arrived.</p></section>';
 }
 function forecastPanel(stats){
  const income=stats.income,spending=stats.otherExpenses,saving=stats.plannedSavings;
  const denom=Math.max(income,spending+saving,1);
  const expensePct=Math.min(100,Math.round(spending/denom*100));
  const savingPct=Math.min(100-expensePct,Math.round(saving/denom*100));
  return '<section class="panel panel-pad finance-forecast"><div class="finance-section-head"><div><div class="eyebrow">MONTHLY OUTLOOK</div><h2>Where your money is going</h2></div></div>'+
   '<div class="finance-split" aria-label="Planned expenses and savings as a share of this month’s income"><div class="finance-split-expenses" style="width:'+expensePct+'%"></div><div class="finance-split-savings" style="width:'+savingPct+'%"></div></div>'+
   '<div class="finance-breakdown">'+
   '<div><span class="finance-legend-dot expenses"></span><span>Other planned expenses</span><strong>'+currency(spending)+'</strong></div>'+
   '<div><span class="finance-legend-dot savings"></span><span>Savings transfers</span><strong>'+currency(saving)+'</strong></div>'+
   '<div><span class="finance-legend-dot available"></span><span>Left after commitments</span><strong class="'+(stats.available<0?'finance-negative':'')+'">'+currency(stats.available)+'</strong></div>'+
   '</div><p class="fine finance-disclaimer">This is a plan based on what you enter, not your live bank balance. Expenses without a date are excluded until scheduled.</p>'+
   '</section>';
 }
 function entryRow(info,month){
  const item=db.items.find(x=>x.id===info.id);if(!item)return '';
  const isCurrent=month===currentMonth();
  const status=info.remaining===0?'Complete':info.paid>0?'Partially paid':'Planned';
  const recurring=info.repeat&&info.repeat!=='none';
  return '<div class="finance-entry">'+
   '<span class="finance-entry-icon '+(info.savings?'is-savings':'')+'">'+(info.savings?'◇':'＄')+'</span>'+
   '<button class="finance-entry-copy" data-edit="'+clean(item.id)+'"><strong>'+clean(info.title)+'</strong><small>'+clean(info.category)+' · '+(recurring?clean(info.repeat)+' · ':'')+clean(info.first)+'</small></button>'+
   '<div class="finance-entry-price"><strong>'+currency(info.planned)+'</strong><small class="'+(info.remaining===0?'finance-complete':'')+'">'+status+'</small></div>'+
   (isCurrent?'<input type="checkbox" class="tick" data-complete="'+clean(item.id)+'" aria-label="Mark '+clean(item.title)+' complete" '+(info.remaining===0?'checked':'')+'>':'')+
   '</div>';
 }
 function entriesPanel(stats){
  const month=stats.month,own=db.items.filter(x=>x.kind==='bill'&&!x.dueAt);
  const rows=[...stats.rows];
  let matching=rows.filter(x=>
   (view==='all'||(view==='savings'&&x.savings)||(view==='open'&&x.remaining>0)||(view==='paid'&&x.remaining<=0))&&
   (!query||(x.title+' '+x.category).toLowerCase().includes(query.toLowerCase())));
  const unscheduled=(view==='all'||view==='open')?own.filter(x=>!query||(x.title+' '+x.category).toLowerCase().includes(query.toLowerCase())):[];
  return '<section class="panel finance-entries"><div class="panel-head"><div><h2>Monthly expenses</h2><p class="fine">'+clean(prettyMonth(month))+' · '+matching.length+' planned entries</p></div><button class="minor" data-finance="add">Add expense ＋</button></div>'+
   '<div class="finance-filter-line"><input id="financeSearch" class="field" type="search" placeholder="Find an expense..." value="'+clean(query)+'" aria-label="Search expenses">'+
   '<div class="finance-chips">'+[['all','All'],['open','Open'],['paid','Completed'],['savings','Savings']].map(([k,label])=>
   '<button class="chip '+(view===k?'active':'')+'" data-finance-filter="'+k+'">'+label+'</button>').join('')+'</div></div>'+
   (matching.length?'<div class="finance-entry-list">'+matching.map(x=>entryRow(x,month)).join('')+'</div>':
   '<div class="finance-empty"><strong>No expenses here yet</strong><p>Add a bill, an expense, or a regular savings contribution.</p><button class="outline-btn" data-finance="add">＋ Add expense</button></div>')+
   (unscheduled.length?'<div class="finance-unscheduled"><strong>Not scheduled</strong><p class="fine">Set a date to include these in monthly projections.</p>'+
    unscheduled.map(x=>'<button data-edit="'+clean(x.id)+'">'+clean(x.title)+' · '+currency(F.amount(x.amount))+' ›</button>').join('')+'</div>':'')+
   '</section>';
 }
 function viewHTML(){
  const stats=F.summary(db.items,db.finance,selectedMonth),noIncome=!db.finance;
  return '<section class="finance-page">'+
   '<div class="finance-head"><div><div class="eyebrow">YOUR PERSONAL SPACE</div><h1>Money</h1><p>Income, everyday expenses, and savings in one place.</p></div>'+
   '<div class="finance-head-actions"><button class="outline-btn" data-finance="edit">Edit amounts</button><button class="primary-btn" data-finance="add">＋ Add expense</button></div></div>'+
   '<div class="finance-month"><span>Showing</span><button aria-label="Previous month" data-finance="prev">‹</button>'+
   '<strong>'+clean(prettyMonth(stats.month))+'</strong><button aria-label="Next month" data-finance="next">›</button>'+
   (stats.month!==currentMonth()?'<button class="finance-month-today" data-finance="today">Current month</button>':'')+'</div>'+
   (noIncome?'<div class="finance-onboard"><strong>Start with your monthly income.</strong><p>Enter how much you receive, what you have saved, and an optional savings goal. No account connection is needed.</p></div>':'')+
   ((editing||noIncome)?setupPanel():'')+
   cardTotals(stats)+
   (stats.available<0?'<div class="finance-budget-warning" role="status">Planned expenses and savings exceed the monthly income you entered by '+currency(Math.abs(stats.available))+'.</div>':'')+
   '<div class="finance-panels">'+forecastPanel(stats)+savingsPanel(stats)+'</div>'+entriesPanel(stats)+'</section>';
 }
 function editSavingsExpense(){
  openEntry('bill');
  const title=$('#entry-title'),amount=$('#entry-amount'),cat=$('#entry-category'),repeat=$('#entry-repeat'),due=$('#entry-dueAt'),alert=$('#entryForm [name="alert"]');
  if(title)title.value='Savings transfer';
  if(amount)amount.value='900';
  if(cat)cat.value='Savings';
  if(repeat)repeat.value='monthly';
  if(due)due.value=localDateTime(new Date());
  if(alert)alert.checked=false;
  toast('Savings is set to $900 monthly. Change the amount or date before saving.');
 }
 const priorRender=render;
 render=function(){
  priorRender();
  if(currentPage==='money')$('#view').innerHTML=viewHTML();
 };
 document.addEventListener('click',event=>{
  if(currentPage!=='money')return;
  const button=event.target.closest('[data-finance],[data-finance-filter]');
  if(!button)return;
  const action=button.dataset.finance;
  if(button.hasAttribute('data-finance-filter')){
   view=button.dataset.financeFilter;render();return;
  }
  if(action==='edit'){editing=!editing;render();return;}
  if(action==='add'){openEntry('bill');return;}
  if(action==='savings'){editSavingsExpense();return;}
  if(action==='prev'){selectedMonth=offsetMonth(selectedMonth,-1);render();return;}
  if(action==='next'){selectedMonth=offsetMonth(selectedMonth,1);render();return;}
  if(action==='today'){selectedMonth=currentMonth();render();return;}
 });
 document.addEventListener('submit',event=>{
  if(event.target?.id!=='financeSetupForm')return;
  event.preventDefault();
  const form=event.target;
  const inputs=['monthlyIncome','savingsBalance','savingsGoal'];
  for(const name of inputs){
   const input=form.elements.namedItem(name);
   if(!input||!F.validAmount(input.value)){toast('Enter a valid non-negative number for each amount.');input?.focus();return;}
  }
  db.finance={monthlyIncome:F.amount(form.elements.namedItem('monthlyIncome').value),
   savingsBalance:F.amount(form.elements.namedItem('savingsBalance').value),
   savingsGoal:F.amount(form.elements.namedItem('savingsGoal').value)};
  editing=false;save();toast('Monthly income and savings saved.');
 });
 document.addEventListener('input',event=>{
  if(currentPage!=='money'||event.target?.id!=='financeSearch')return;
  const input=event.target,position=input.selectionStart;
  query=input.value.trim().slice(0,90);
  // Update only the list when searching to keep the mobile keyboard and focus.
  const stats=F.summary(db.items,db.finance,selectedMonth);
  const list=$('#view .finance-entries');
  if(list){const holder=document.createElement('div');holder.innerHTML=entriesPanel(stats);list.replaceWith(holder.firstElementChild);
   const again=$('#financeSearch');if(again){again.focus({preventScroll:true});again.setSelectionRange(position,position);}}
 });
})();
