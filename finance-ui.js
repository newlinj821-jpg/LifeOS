/* LifeOS Money: a straightforward monthly plan, separate from connected banks. */
(() => {
 'use strict';
 if(typeof db==='undefined'||!window.LifeOSFinanceCore)return;
 const F=window.LifeOSFinanceCore;
 const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);
 const clean=x=>safe(String(x??''));
 const monthNow=()=>dayKey(new Date()).slice(0,7);
 const monthLabel=x=>{const [y,m]=x.split('-').map(Number);return new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(new Date(y,m-1,1));};
 const nextMonth=(x,step)=>{const [y,m]=x.split('-').map(Number),d=new Date(y,m-1+step,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');};
 let month=monthNow(),editing=!db.finance;
 const budget=()=>F.summary(db.items,db.finance,month);
 function setup(){
  const p=F.profile(db.finance);
  return '<section class="panel panel-pad finance-setup" id="lifeBudgetEdit"><div class="finance-section-head"><h2>Income & savings</h2>'+
   (db.finance?'<button type="button" class="minor" data-finance="edit">Close</button>':'')+'</div>'+
   '<form id="financeSetupForm" class="life-budget-form">'+
   '<label>Monthly income <input class="field" type="number" min="0" max="100000000" step=".01" inputmode="decimal" name="monthlyIncome" required value="'+p.monthlyIncome+'"></label>'+
   '<label>Current savings balance <input class="field" type="number" min="0" max="100000000" step=".01" inputmode="decimal" name="savingsBalance" required value="'+p.savingsBalance+'"></label>'+
   '<label>Savings goal (optional) <input class="field" type="number" min="0" max="100000000" step=".01" inputmode="decimal" name="savingsGoal" required value="'+p.savingsGoal+'"></label>'+
   '<button type="submit" class="primary-btn">Save amounts</button></form>'+
   '<p class="fine">Planning amounts are separate from linked bank balances.</p></section>';
 }
 function row(info){
  const item=db.items.find(x=>x.id===info.id);if(!item)return '';
  return '<div class="life-budget-row"><button type="button" data-edit="'+clean(item.id)+'"><strong>'+clean(info.title)+'</strong>'+
   '<small>'+clean(info.repeat==='none'?'One time':info.repeat)+' · '+clean(info.category)+'</small></button>'+
   '<strong>'+money(info.planned)+'</strong><button type="button" class="life-budget-edit" data-edit="'+clean(item.id)+'" aria-label="Edit '+clean(info.title)+'">Edit</button></div>';
 }
 function group(title,rows,amount){
  return '<section class="life-budget-group"><div class="life-budget-group-head"><h3>'+title+'</h3><strong>'+money(amount)+'</strong></div>'+
   (rows.length?rows.map(row).join(''):'<p class="fine life-budget-empty">Nothing added yet.</p>')+'</section>';
 }
 function plan(){
  const s=budget(),items=s.rows;
  const savings=items.filter(x=>x.savings);
  const bills=items.filter(x=>!x.savings&&['Housing','Utilities','Subscriptions','Health','Transport'].includes(x.category));
  const expenses=items.filter(x=>!x.savings&&!['Housing','Utilities','Subscriptions','Health','Transport'].includes(x.category));
  const total=arr=>arr.reduce((n,x)=>n+x.planned,0);
  return '<section class="life-budget-plan" aria-label="Monthly budget projection">'+
   '<div class="life-budget-period"><div><h2>Monthly budget</h2><p class="fine">Your estimate, not your bank balance</p></div>'+
   '<div class="finance-month"><button type="button" data-finance="prev" aria-label="Previous month">‹</button><strong>'+clean(monthLabel(month))+'</strong><button type="button" data-finance="next" aria-label="Next month">›</button></div></div>'+
   '<div class="life-budget-answer"><span>Money left after everything</span><strong class="'+(s.available<0?'finance-negative':'')+'">'+money(s.available)+'</strong>'+
   '<small>'+ (s.available<0?'Your plan exceeds your monthly income.':'Estimated money remaining this month.')+'</small></div>'+
   '<div class="life-budget-math"><div><span>Monthly income</span><strong>'+money(s.income)+'</strong></div>'+
   '<div><span>Bills</span><strong>− '+money(total(bills))+'</strong></div>'+
   '<div><span>Other expenses</span><strong>− '+money(total(expenses))+'</strong></div>'+
   '<div><span>Planned savings</span><strong>− '+money(s.plannedSavings)+'</strong></div></div>'+
   '<div class="life-budget-actions"><button type="button" class="primary-btn" data-finance="add-bill">＋ Add bill</button>'+
   '<button type="button" class="outline-btn" data-finance="add-expense">＋ Add expense</button>'+
   '<button type="button" class="outline-btn" data-finance="add-savings">＋ Add savings</button>'+
   '<button type="button" class="ghost-btn" data-finance="edit">Edit income</button></div>'+
   '<div class="life-budget-groups">'+group('Bills',bills,total(bills))+group('Expenses',expenses,total(expenses))+group('Savings set aside',savings,s.plannedSavings)+'</div>'+
   '<p class="fine">Savings transfers lower your monthly money left. They do not change the actual bank balance unless the bank reports a transfer.</p></section>';
 }
 function markup(){
  const current=F.profile(db.finance);
  return '<section class="finance-page">'+
   '<header class="finance-head"><div><div class="eyebrow">MONEY</div><h1>Money</h1><p>Your bank accounts and what you have left each month.</p></div></header>'+
   '<div class="life-money-bank-intro"><h2>My bank</h2><p>Checking, savings, transactions, paycheck and spending alerts.</p></div>'+
   '<div class="finance-panels" hidden aria-hidden="true"></div>'+
   (editing||!db.finance?setup():'')+
   plan()+
   '<section class="life-savings-note"><div><strong>Tracked savings</strong><span>'+money(current.savingsBalance)+(current.savingsGoal?' · Goal '+money(current.savingsGoal):'')+'</span></div>'+
   '<button type="button" class="outline-btn" data-finance="edit">Edit</button></section>'+
   '</section>';
 }
 function addBudgetItem(category='',title='',monthly=false){
  openEntry('bill');
  const input=document.querySelector('#entry-title'),cat=document.querySelector('#entry-category');
  const repeat=document.querySelector('#entry-repeat'),due=document.querySelector('#entry-dueAt');
  if(input){input.value=title;input.placeholder=category==='Savings'?'e.g. Emergency fund':'e.g. Electricity';}
  if(cat&&category)cat.value=category;
  if(repeat)repeat.value=monthly?'monthly':'none';
  if(due&&monthly)due.value=localDateTime(new Date());
  if(input)input.focus();
 }
 const prior=render;
 render=function(){prior();if(currentPage==='money')document.querySelector('#view').innerHTML=markup();};
 document.addEventListener('click',event=>{
  if(currentPage!=='money')return;
  const button=event.target.closest('[data-finance]');if(!button)return;
  const action=button.dataset.finance;
  if(action==='prev'||action==='next'){month=nextMonth(month,action==='prev'?-1:1);render();return;}
  if(action==='edit'){editing=!editing;render();if(editing)document.querySelector('#lifeBudgetEdit')?.scrollIntoView({block:'nearest'});return;}
  if(action==='add-bill'){addBudgetItem('Utilities','',true);return;}
  if(action==='add-expense'){addBudgetItem('Other','',false);return;}
  if(action==='add-savings'){addBudgetItem('Savings','Savings transfer',true);return;}
 });
 document.addEventListener('submit',event=>{
  if(event.target?.id!=='financeSetupForm')return;
  event.preventDefault();
  const form=event.target,fields=['monthlyIncome','savingsBalance','savingsGoal'];
  for(const name of fields){
   const el=form.elements.namedItem(name);
   if(!el||!F.validAmount(el.value)){toast('Enter a valid amount.');el?.focus();return;}
  }
  db.finance={monthlyIncome:F.amount(form.elements.namedItem('monthlyIncome').value),
   savingsBalance:F.amount(form.elements.namedItem('savingsBalance').value),
   savingsGoal:F.amount(form.elements.namedItem('savingsGoal').value)};
  editing=false;save();toast('Monthly budget saved.');
 });
})();