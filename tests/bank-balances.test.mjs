import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {safeAmount,normalizeAccount,mergeBankAccounts} from '../netlify/lib/bank-data.mjs';

const checking={account_id:'checking-1',name:'My Checking',type:'depository',subtype:'checking',mask:'1234',
 balances:{current:1820.55,available:1780.55,iso_currency_code:'USD'}};
const savings={account_id:'saving-1',name:'High Yield Savings',type:'depository',subtype:'savings',mask:'5678',
 balances:{current:4100.07,available:null,iso_currency_code:'USD'}};
const account=(x)=>normalizeAccount(x,'institution-1');

test('Plaid null and missing balances never become a fabricated $0',()=>{
 for(const val of [null,undefined,'',NaN,Infinity,false])assert.equal(safeAmount(val),null);
 assert.equal(safeAmount(0),0);
 assert.equal(account(savings).current,4100.07);
 assert.equal(account(savings).available,null);
});
test('Two distinct accounts and balances survive a full successful Plaid sync',()=>{
 const report=mergeBankAccounts([],[account(checking),account(savings)],123456);
 assert.equal(report.length,2);
 assert.equal(report[0].current,1820.55);
 assert.equal(report[1].current,4100.07);
 assert.equal(report[0].stale,false);
 assert.equal(report[1].stale,false);
});
test('Missing savings account on a partial response retains last known savings with stale marker',()=>{
 const before=mergeBankAccounts([],[account(checking),account(savings)],100);
 const next=mergeBankAccounts(before,[account({...checking,balances:{current:1822,available:1782}})],200);
 assert.equal(next.length,2);
 assert.equal(next.find(x=>x.subtype==='savings').current,4100.07);
 assert.equal(next.find(x=>x.subtype==='savings').stale,true);
 assert.equal(next.find(x=>x.subtype==='checking').current,1822);
});
test('A failed/no-accounts response keeps both balances with stale labels',()=>{
 const before=mergeBankAccounts([],[account(checking),account(savings)],100);
 const after=mergeBankAccounts(before,[],200);
 assert.deepEqual(after.map(a=>a.current),[1820.55,4100.07]);
 assert.ok(after.every(a=>a.stale));
});
test('A null updated balance retains the previous valid amount without faking freshness',()=>{
 const original=mergeBankAccounts([],[account(checking)],100);
 const update=account({...checking,balances:{current:null,available:null}});
 const result=mergeBankAccounts(original,[update],200);
 assert.equal(result[0].current,1820.55);
 assert.equal(result[0].available,1780.55);
 assert.equal(result[0].stale,true);
 assert.equal(result[0].lastReportedAt,100);
});
test('Cards aggregate checking and savings independently and support real zero balances',()=>{
 const src=readFileSync(new URL('../bank-balances.js',import.meta.url),'utf8');
 const ctx=vm.createContext({});
 vm.runInContext(src,ctx);
 const numbers=ctx.LifeOSBankBalances.summarize([
  {...account(checking),institution:'Example Bank'},
  {...account(savings),institution:'Example Bank'},
  {...account({...checking,account_id:'checking-2',balances:{current:0,available:0}}),institution:'Example Bank'}
 ]);
 assert.equal(numbers.checking.balance,1820.55);
 assert.equal(numbers.checking.accounts,2);
 assert.equal(numbers.savings.balance,4100.07);
 assert.equal(numbers.savings.accounts,1);
 assert.equal(numbers.savings.mask,'5678');
});
test('Cards do not turn a nonexistent balance into zero',()=>{
 const src=readFileSync(new URL('../bank-balances.js',import.meta.url),'utf8');
 const ctx=vm.createContext({});
 vm.runInContext(src,ctx);
 const x=ctx.LifeOSBankBalances.summarize([account({...savings,balances:{current:null,available:null}})]);
 assert.equal(x.savings.balance,null);
 assert.equal(x.checking.balance,null);
});
test('Money has both checking and savings cards and the PWA installs the balance code',()=>{
 const bank=readFileSync(new URL('../bank-ui.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
 assert.ok(bank.includes("card('checking','Checking')"));
 assert.ok(bank.includes("card('savings','Savings')"));
 assert.ok(bank.includes("balanceCards()+"));
 assert.ok(!bank.includes("await run('exchange',{publicToken,institution:metadata?.institution?.name||'Bank'});await run('refresh')"));
 for(const s of [html,worker,build])assert.ok(s.includes('bank-balances.js'));
});
