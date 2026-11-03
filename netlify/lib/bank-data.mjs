/* LifeOS bank references: normalize public API output without storing credentials. */
export const roundMoney=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
export const safeAmount=n=>Number.isFinite(Number(n))?roundMoney(n):null;
export const safeLabel=(v,max=120)=>String(v??'').replace(/[<>\x00-\x1f]/g,' ').trim().slice(0,max);
export function normalizeAccount(x,itemId){
 if(!x||typeof x.account_id!=='string')return null;
 const b=x.balances||{};
 return {id:x.account_id,itemId,type:safeLabel(x.type,32),subtype:safeLabel(x.subtype,32),
  name:safeLabel(x.name,75),mask:safeLabel(x.mask,6),
  current:safeAmount(b.current),available:safeAmount(b.available),
  currency:safeLabel(b.iso_currency_code||'USD',5)};
}
export function normalizeTransaction(x,itemId){
 if(!x||typeof x.transaction_id!=='string'||!x.account_id)return null;
 const amount=safeAmount(x.amount);
 if(amount===null)return null;
 return {id:x.transaction_id,itemId,accountId:x.account_id,
  date:/^\d{4}-\d{2}-\d{2}$/.test(x.date||'')?x.date:'',
  title:safeLabel(x.merchant_name||x.name,135),amount,
  pending:x.pending===true,
  category:safeLabel(x.personal_finance_category?.primary||x.category?.[0]||'OTHER',65),
  detail:safeLabel(x.personal_finance_category?.detailed||'',90)};
}
export const isTransfer=t=>/(^TRANSFER_|^LOAN_PAYMENTS|^BANK_FEES_BROKERAGE|^INCOME_INTEREST_EARNED)/.test(String(t.category||''));
export const isExpense=t=>t.amount>0&&!isTransfer(t)&&!t.pending;
export const isDeposit=t=>t.amount<0&&!isTransfer(t)&&!t.pending;
export const normalizeThresholds=o=>{
 const v=o||{};
 const value=(k,defaultValue)=>Number.isFinite(Number(v[k]))&&Number(v[k])>=1&&Number(v[k])<=1_000_000?roundMoney(Number(v[k])):defaultValue;
 return {largeExpense:value('largeExpense',250),largeDeposit:value('largeDeposit',500),balanceChange:value('balanceChange',200)};
};
export function bankInsights(current,previous,transactions,settings={}){
 const thresholds=normalizeThresholds(settings);
 const txs=Array.isArray(transactions)?transactions:[];
 const alerts=[];
 const latest=[...txs].filter(t=>!t.pending).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,300);
 for(const tx of latest){
  if(isExpense(tx)&&tx.amount>=thresholds.largeExpense)
   alerts.push({id:'expense:'+tx.id,kind:'large-expense',level:'attention',date:tx.date,title:'Large purchase',detail:tx.title,
    amount:tx.amount,accountId:tx.accountId});
  else if(isDeposit(tx)&&Math.abs(tx.amount)>=thresholds.largeDeposit)
   alerts.push({id:'deposit:'+tx.id,kind:'large-deposit',level:'info',date:tx.date,title:'Large deposit',detail:tx.title,
    amount:Math.abs(tx.amount),accountId:tx.accountId});
 }
 const oldMap=new Map((Array.isArray(previous)?previous:[]).map(x=>[x.id,x]));
 for(const account of (Array.isArray(current)?current:[])){
  const prior=oldMap.get(account.id);
  if(!prior||account.current===null||prior.current===null||!Number.isFinite(account.current)||!Number.isFinite(prior.current))continue;
  const difference=roundMoney(account.current-prior.current);
  if(Math.abs(difference)>=thresholds.balanceChange)
   alerts.push({id:'balance:'+account.id+':'+account.current,kind:'balance-change',level:'attention',date:'',
    title:'Balance changed',detail:account.name,
    amount:difference,accountId:account.id});
 }
 return alerts.slice(0,80);
}
export function summarizeTransactions(transactions,month){
 const ym=/^\d{4}-\d{2}$/.test(month||'')?month:new Date().toISOString().slice(0,7);
 const entries=(Array.isArray(transactions)?transactions:[]).filter(t=>String(t.date||'').startsWith(ym));
 return {month:ym,spent:roundMoney(entries.filter(isExpense).reduce((n,t)=>n+t.amount,0)),
  deposits:roundMoney(-entries.filter(isDeposit).reduce((n,t)=>n+t.amount,0)),
  count:entries.length};
}
export function applyTransactions(existing,added,modified,removed,max=1800){
 const byId=new Map((Array.isArray(existing)?existing:[]).map(t=>[t.id,t]));
 for(const r of removed||[])byId.delete(r.transaction_id);
 for(const t of [...(added||[]),...(modified||[])])if(t?.id)byId.set(t.id,t);
 return [...byId.values()].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,max);
}
export function purchasePreview(cost,savings,monthlyAvailable){
 const amount=safeAmount(cost),balance=safeAmount(savings),available=safeAmount(monthlyAvailable);
 if(amount===null||amount<0)return null;
 const fromSavings=balance===null?null:roundMoney(balance-amount);
 const fromBudget=available===null?null:roundMoney(available-amount);
 return {cost:amount,savingsAfter:fromSavings,budgetAfter:fromBudget,
  savingsShortfall:fromSavings===null?null:Math.max(0,-fromSavings),
  budgetShortfall:fromBudget===null?null:Math.max(0,-fromBudget)};
}
