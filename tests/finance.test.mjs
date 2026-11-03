import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../finance-core.js',import.meta.url),'utf8');
const sandbox=vm.createContext({});
vm.runInContext(source,sandbox,{filename:'finance-core.js'});
const F=sandbox.LifeOSFinanceCore;

const savings={id:'savings-monthly',kind:'bill',title:'Savings transfer',category:'Savings',amount:900,repeat:'monthly',dueAt:'2026-11-03T10:00',completedDates:[]};
const mortgage={id:'mortgage',kind:'bill',title:'Mortgage',category:'Housing',amount:986,repeat:'monthly',dueAt:'2026-10-05T10:00',completedDates:[]};
const groceries={id:'groceries',kind:'bill',title:'Groceries',category:'Food',amount:270,repeat:'none',dueAt:'2026-11-07T12:00',done:false};

test('Savings category functions as a $900/month recurring expense without changing savings balance',()=>{
 const stats=F.summary([savings,mortgage,groceries],{monthlyIncome:3500,savingsBalance:2400,savingsGoal:5000},'2026-11');
 assert.equal(stats.income,3500);
 assert.equal(stats.plannedSavings,900);
 assert.equal(stats.otherExpenses,1256);
 assert.equal(stats.planned,2156);
 assert.equal(stats.available,1344);
 assert.equal(stats.pending,2156);
 assert.equal(stats.savingsBalance,2400);
 assert.equal(stats.savingsGoal,5000);
 assert.equal(stats.savingsProgress,48);
 assert.equal(stats.rows.length,3);
});
test('Marking a monthly savings expense complete records payment, not fictitious bank balance',()=>{
 const done={...savings,completedDates:['2026-11-07']};
 const stats=F.summary([done,mortgage],{monthlyIncome:3500,savingsBalance:200,savingsGoal:1000},'2026-11');
 assert.equal(stats.plannedSavings,900);
 assert.equal(stats.paidSavings,900);
 assert.equal(stats.paid,900);
 assert.equal(stats.pending,986);
 assert.equal(stats.savingsBalance,200);
 assert.equal(stats.available,1614);
});
test('Monthly repeats project forward but do not count before first scheduled month',()=>{
 assert.equal(F.summary([savings],{monthlyIncome:3000},'2026-10').planned,0);
 assert.equal(F.summary([savings],{monthlyIncome:3000},'2026-11').planned,900);
 assert.equal(F.summary([savings],{monthlyIncome:3000},'2026-12').planned,900);
 assert.equal(F.summary([savings],{monthlyIncome:3000},'2027-01').planned,900);
});
test('One-off expenses count once, undated expenses do not silently reduce month forecast',()=>{
 const unscheduled={id:'no-date',kind:'bill',title:'Unscheduled purchase',amount:500,category:'Other'};
 const stats=F.summary([unscheduled,groceries],{monthlyIncome:2000},'2026-11');
 assert.equal(stats.planned,270);
 assert.equal(stats.rows.length,1);
 assert.equal(F.summary([groceries],{monthlyIncome:2000},'2026-12').planned,0);
});
test('Supports monthly obligations on the 31st without skipping February',()=>{
 const item={...savings,dueAt:'2026-01-31T08:00'};
 assert.equal(F.datesForBill(item,'2026-02')[0],'2026-02-28');
 assert.equal(F.datesForBill(item,'2028-02')[0],'2028-02-29');
 assert.equal(F.datesForBill(item,'2026-03')[0],'2026-03-31');
});
test('Weekly expenses may recur multiple times in a calendar month',()=>{
 const weekly={...savings,amount:50,repeat:'weekly',dueAt:'2026-11-02T12:00'};
 assert.deepEqual(Array.from(F.datesForBill(weekly,'2026-11')),['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30']);
 assert.equal(F.summary([weekly],{monthlyIncome:1000},'2026-11').plannedSavings,250);
});
test('Rejects invalid and negative financial values, preserves decimal cents',()=>{
 for(const value of [-1,'-20','abc',Infinity,NaN,null,undefined,''])assert.equal(F.amount(value),0);
 assert.equal(F.amount('900.70'),900.7);
 assert.equal(F.amount('12.345'),12.35);
 assert.equal(F.validAmount('900'),true);
 assert.equal(F.validAmount('-900'),false);
 assert.equal(F.profile({monthlyIncome:'4300.10',savingsBalance:80,savingsGoal:100}).monthlyIncome,4300.10);
});
test('Savings is included in the original bill editor and the installable PWA bundles the finance screen',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../finance-ui.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
 const serviceWorker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(app,/\['Housing','Utilities','Transport','Food','Health','Subscriptions','Pets','Shopping','Savings','Other'\]/);
 for(const file of ['finance-core.js','finance-ui.js','finance.css']){
   assert.ok(html.includes('/'+file));
   assert.ok(build.includes(file));
   assert.ok(serviceWorker.includes('/'+file));
 }
 assert.ok(page.includes("amount.value='900'"));
 assert.ok(page.includes("repeat.value='monthly'"));
 assert.ok(page.includes("cat.value='Savings'"));
 assert.ok(page.includes("financeSetupForm"));
 assert.ok(!page.includes('fetch('),'Finance pages should not send private financial data to a public API');
});
