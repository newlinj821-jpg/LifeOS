import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeTransaction,isDeposit,isPaycheck,isVAIncome,bankPrefs,
 bankAlertCandidates,paycheckHistory,isTransfer} from '../netlify/lib/bank-data.mjs';

const make=(id,amount,title='VACP TREAS 310-XXVA BENEF',date='2026-11-03',extra={})=>({
 id,accountId:'account-1',date,title,amount,pending:false,category:'INCOME_OTHER_INCOME',...extra
});
const prefs={enabled:true,paycheck:true,otherDeposits:false,expectedPaycheckAmount:2150.75};
test('An exact posted VA payment triggers ONE paycheck candidate',()=>{
 const t=make('posted-va',-2150.75);
 assert.equal(isVAIncome(t),true);
 assert.equal(isPaycheck(t,prefs),true);
 const alerts=bankAlertCandidates([t],prefs,Date.parse('2026-11-04T12:00:00Z'));
 assert.equal(alerts.length,1);
 assert.equal(alerts[0].kind,'paycheck');
 assert.equal(alerts[0].amount,2150.75);
});
test('A larger VA payment is an ordinary deposit, never a paycheck',()=>{
 const t=make('extra',-2250.75);
 assert.equal(isPaycheck(t,prefs),false);
 assert.deepEqual(bankAlertCandidates([t],prefs,Date.parse('2026-11-04T12:00:00Z')),[]);
 const alert=bankAlertCandidates([t],{...prefs,otherDeposits:true},Date.parse('2026-11-04T12:00:00Z'));
 assert.equal(alert.length,1);
 assert.equal(alert[0].kind,'deposit');
});
test('A smaller VA payment is likewise an ordinary deposit',()=>{
 const t=make('smaller',-2150.74);
 assert.equal(isPaycheck(t,prefs),false);
 assert.equal(bankAlertCandidates([t],{...prefs,otherDeposits:true},Date.parse('2026-11-04T12:00:00Z'))[0].kind,'deposit');
});
test('A VA descriptor alone cannot generate paycheck alerts when amount is unset',()=>{
 const t=make('no-expected',-2150.75);
 assert.equal(isPaycheck(t,{...prefs,expectedPaycheckAmount:null}),false);
 assert.equal(bankAlertCandidates([t],{...prefs,expectedPaycheckAmount:null},Date.parse('2026-11-04T12:00:00Z')).length,0);
});
test('Pending credits, savings transfers, dated old history and refunds cannot trigger payroll',()=>{
 const posted=make('posted-va',-2150.75);
 const tx=[{...posted,id:'pending',pending:true},{...posted,id:'transfer',category:'TRANSFER_OUT',title:'VACP TREAS 310'},make('old',-2150.75,'VACP TREAS 310','2026-10-01'),{...posted,id:'refund',title:'REFUND FROM STORE',category:'OTHER'}];
 assert.equal(bankAlertCandidates(tx,prefs,Date.parse('2026-11-04T12:00:00Z')).length,0);
 assert.equal(isTransfer(tx[1]),true);
 assert.equal(isDeposit(tx[0]),false);
});
test('Configured amount alone identifies a paycheck; a same-value refund is not pay',()=>{
 const generic=make('generic',-2150.75,'INCOMING ACH CREDIT','2026-11-03',{category:'INCOME_OTHER_INCOME'});
 assert.equal(isPaycheck(generic,prefs),true);
 const refund=make('refund-identical',-2150.75,'REFUND FROM STORE','2026-11-03',{category:'OTHER'});
 assert.equal(isPaycheck(refund,prefs),false);
 const higher=make('higher-income',-2150.76,'XXVA BENEF','2026-11-03');
 const alerts=bankAlertCandidates([generic,refund,higher],{...prefs,otherDeposits:true},Date.parse('2026-11-04T12:00:00Z'));
 assert.equal(alerts.find(a=>a.id==='paycheck:generic')?.kind,'paycheck');
 assert.equal(alerts.find(a=>a.id==='deposit:higher-income')?.kind,'deposit');
 assert.ok(!alerts.some(a=>a.kind==='paycheck'&&a.id.includes('refund')));
});
test('Payroll from another employer is recognized only at the expected amount',()=>{
 const payroll=make('wages',-1000,'Employer Payroll','2026-11-03',{category:'INCOME_WAGES'});
 assert.equal(isPaycheck(payroll,{...prefs,expectedPaycheckAmount:1000}),true);
 assert.equal(isPaycheck(payroll,{...prefs,expectedPaycheckAmount:1200}),false);
});
test('Amount settings preserve cents, reject invalid values, and never infer paycheck from monthly budget',()=>{
 assert.equal(bankPrefs({...prefs,expectedPaycheckAmount:2150.75}).expectedPaycheckAmount,2150.75);
 for(const v of [null,'',undefined,'wrong','-4',0,Infinity]){
  assert.equal(bankPrefs({...prefs,expectedPaycheckAmount:v}).expectedPaycheckAmount,null);
 }
 assert.equal(bankPrefs(prefs).maxDaily,2);
 assert.equal(bankPrefs(prefs).otherDeposits,false);
});
test('Paycheck history only includes matching amount, not higher deposits',()=>{
 const record=[make('matching',-2150.75,'XXVA BENEF','2026-11-03'),make('higher',-2250.75,'XXVA BENEF','2026-10-02')];
 const history=paycheckHistory(record,prefs);
 assert.equal(history.count,1);
 assert.equal(history.latest.amount,2150.75);
});
test('Production app exposes paycheck amount input, correct Plaid endpoint and persistent server sync',()=>{
 const ui=readFileSync(new URL('../bank-ui.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../netlify/functions/plaid.mjs',import.meta.url),'utf8');
 const cron=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(ui,/id="bankExpectedPay"/);
 assert.match(ui,/\.netlify\/functions\/plaid/);
 assert.match(ui,/link-notifications/);
 assert.match(ui,/action==='lifeBankAlerts'|target\.id==='lifeBankAlerts'/);
 assert.ok(backend.includes("action==='notification-prefs'"));
 assert.ok(backend.includes("action==='link-notifications'"));
 assert.ok(cron.includes('[functions."check-banks"]'));
 assert.ok(html.includes('src="/bank-ui.js"'));
 assert.ok(!ui.includes("fetch('/.netlify/functions/bank'"),'Deprecated broken API should never be called');
});
test('Plaid-only server components never get included in the offline PWA cache',()=>{
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.ok(sw.includes("'/bank-ui.js'"));
 assert.ok(!sw.includes("/.netlify/functions/plaid"));
});
