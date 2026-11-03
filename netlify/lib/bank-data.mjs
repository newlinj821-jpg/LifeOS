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


/* Paycheck classification deliberately excludes transfers and pending credits.
   A statement descriptor such as VACP TREAS 310 or XXVA BENEF remains private. */
export const incomeDescriptor=t=>String(t?.title||t?.name||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
export const isVAIncome=t=>isDeposit(t)&&(
 /\bVACP\s+TREAS\s*310\b/.test(incomeDescriptor(t))||
 /\bXXVA\s+BENEF\b/.test(incomeDescriptor(t))||
 /\bVA\s+(?:BENEFITS?|COMPENSATION)\b/.test(incomeDescriptor(t))
);
export const defaultBankPrefs=()=>({enabled:false,paycheck:true,otherDeposits:false,largeExpense:false,
 largeExpenseAmount:300,lowBalance:false,lowBalanceAmount:100,showAmounts:false,
 expectedPaycheckAmount:null,
 paycheckMatches:[],quietStart:'22:00',quietEnd:'08:00',maxDaily:2});
export function bankPrefs(value){
 const x=value&&typeof value==='object'?value:{},defaults=defaultBankPrefs();
 const money=(v,d)=>Number.isFinite(+v)&&+v>=1&&+v<=100000?roundMoney(+v):d;
 const time=(v,d)=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?v:d;
 return {...defaults,enabled:x.enabled===true,paycheck:x.paycheck!==false,
  otherDeposits:x.otherDeposits===true,largeExpense:x.largeExpense===true,
  largeExpenseAmount:money(x.largeExpenseAmount,300),lowBalance:x.lowBalance===true,
  lowBalanceAmount:money(x.lowBalanceAmount,100),showAmounts:x.showAmounts===true,
  expectedPaycheckAmount:x.expectedPaycheckAmount===null||x.expectedPaycheckAmount===''||x.expectedPaycheckAmount===undefined?null:money(x.expectedPaycheckAmount,null),
  maxDaily:Math.max(1,Math.min(3,Math.trunc(+x.maxDaily||2))),
  quietStart:time(x.quietStart,'22:00'),quietEnd:time(x.quietEnd,'08:00'),
  paycheckMatches:Array.isArray(x.paycheckMatches)?x.paycheckMatches.filter(v=>typeof v==='string'&&v.trim().length>=3&&v.length<=45).map(v=>v.trim().toUpperCase()).slice(0,8):[]};
}
export function isPaycheck(t,config={}){
 if(!isDeposit(t))return false;
 const p=bankPrefs(config);
 // Exact cents matter: a larger VA credit or payroll payment is an ordinary
 // deposit, never an unexpected paycheck notification.
 if(p.expectedPaycheckAmount===null||Math.round(Math.abs(t.amount)*100)!==Math.round(p.expectedPaycheckAmount*100))return false;
 const label=incomeDescriptor(t);
 if(isVAIncome(t))return true;
 if(p.paycheckMatches.some(v=>label.includes(v)))return true;
 return /^INCOME_WAGES\b/.test(t.category||'')||/\bPAYROLL\b/.test(label);
}
export function paycheckHistory(transactions,config={}){
 const matches=(Array.isArray(transactions)?transactions:[]).filter(t=>isPaycheck(t,config)&&/^\d{4}-\d{2}-\d{2}$/.test(t.date||'')).sort((a,b)=>b.date.localeCompare(a.date));
 const gaps=[];
 for(let i=0;i+1<Math.min(matches.length,7);i++){
  const gap=Math.round((Date.parse(matches[i].date+'T12:00Z')-Date.parse(matches[i+1].date+'T12:00Z'))/86400000);
  if(gap>0)gaps.push(gap);
 }
 const avg=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:0;
 const cadence=avg>=26&&avg<=36?'Monthly':avg>=12&&avg<=16?'Every two weeks':avg>=6&&avg<=8?'Weekly':'Unknown';
 const next=matches[0]&&cadence!=='Unknown'?new Date(Date.parse(matches[0].date+'T12:00Z')+Math.round(avg)*86400000).toISOString().slice(0,10):null;
 return {count:matches.length,latest:matches[0]?{date:matches[0].date,amount:Math.abs(matches[0].amount),label:incomeDescriptor(matches[0]),accountId:matches[0].accountId}:null,
  cadence,nextEstimated:next,estimateOnly:Boolean(next)};
}
export function bankAlertCandidates(transactions,config={},now=Date.now()){
 const p=bankPrefs(config),alerts=[],minDate=new Date(now-5*86400000).toISOString().slice(0,10);
 for(const t of (Array.isArray(transactions)?transactions:[])){
  if(!t||t.pending||!t.date||t.date<minDate||!t.id)continue;
  const paycheck=isPaycheck(t,p);
  const kind=paycheck&&p.paycheck?'paycheck':
   isDeposit(t)&&p.otherDeposits?'deposit':
   isExpense(t)&&p.largeExpense&&t.amount>=p.largeExpenseAmount?'spending':null;
  if(!kind)continue;
  alerts.push({id:kind+':'+t.id,kind,date:t.date,amount:Math.abs(t.amount),accountId:t.accountId});
 }
 return alerts;
}
