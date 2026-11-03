import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../input-reliability.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../app-mobile.css',import.meta.url),'utf8');

function harness(){
 let renders=0;
 const listeners={},timers=[];
 const element={disabled:false,readOnly:false,matches:()=>true,closest:sel=>sel==='#view'?{}:null,
   scrollIntoView:()=>{}};
 const button={disabled:false,readOnly:false,matches:()=>false,closest:sel=>sel==='#view'?{}:null};
 const body={classList:{toggle:()=>{}}};
 const doc={activeElement:button,body,addEventListener:(event,cb)=>{listeners[event]=cb}};
 const env={document:doc,window:{matchMedia:()=>({matches:true}),addEventListener:()=>{}},
  currentPage:'money',render:()=>renders++,setTimeout:fn=>{timers.push(fn);return timers.length},
  clearTimeout:()=>{},requestAnimationFrame:fn=>fn()};
 vm.runInNewContext(script,env,{filename:'input-reliability.js'});
 return {env,doc,element,button,listeners,timers,get renders(){return renders;}};
}
test('A focused text field remains mounted during automatic background refreshes',()=>{
 const h=harness();
 h.doc.activeElement=h.element;
 h.listeners.focusin({target:h.element});
 h.env.render();h.env.render();h.env.render();
 assert.equal(h.renders,0,'No pending notification/bank refresh may replace the active input');
 assert.equal(h.doc.activeElement,h.element);
});
test('Deferred update resumes after text editing ends, not per keystroke',()=>{
 const h=harness();
 h.doc.activeElement=h.element;
 h.env.render();
 h.doc.activeElement=h.button;
 h.listeners.focusout({target:h.element});
 h.timers.forEach(fn=>fn());
 assert.equal(h.renders,1,'Redraw occurs only after keyboard/input focus has ended');
});
test('Explicit navigation to another page is never blocked by input protection',()=>{
 const h=harness();
 h.doc.activeElement=h.element;
 h.env.currentPage='settings';
 h.env.render();
 assert.equal(h.renders,1,'Changing pages still renders immediately');
});
test('Native fields remain keyboard-editable and no fixed viewport lock remains',()=>{
 assert.ok(css.includes('overflow-y:auto!important'));
 assert.ok(css.includes('user-select:text!important'));
 assert.ok(css.includes('touch-action:auto!important'));
 assert.ok(css.includes('lifeos-keyboard-open .mobile-bottom'));
 assert.ok(!css.includes('/* Mobile shell v2: ONE scroll container'));
});
test('Repair script is bundled, loaded after all render wrappers and reinstalled offline',()=>{
 assert.ok(html.includes('<script defer src="/input-reliability.js"></script>'));
 assert.ok(html.indexOf('/input-reliability.js')>html.indexOf('/bank-ui.js'));
 assert.ok(build.includes("'input-reliability.js'"));
 assert.ok(worker.includes("'/input-reliability.js'"));
});
test('Plaid and Money forms preserve keyboard focus and do not require a bank connection',()=>{
 const bank=readFileSync(new URL('../bank-ui.js',import.meta.url),'utf8');
 const finance=readFileSync(new URL('../finance-ui.js',import.meta.url),'utf8');
 assert.ok(bank.includes('existing.contains(active)'), 'Async bank redraw must not replace a focused field');
 for(const input of ['lifeBankKey','bankExpectedPay','bankSpendingThreshold','bankLowThreshold'])assert.ok(bank.includes(input),input);
 for(const input of ['financeIncome','financeSavingsBalance','financeSavingsGoal'])assert.ok(finance.includes(input),input);
 assert.ok(finance.includes("event.preventDefault()"),'Money form retains submit handling');
});
