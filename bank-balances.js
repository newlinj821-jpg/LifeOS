/* Bank-reported checking and savings balances, kept separate from manual Money. */
(function(root){
 'use strict';
 const balance=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
 function kind(a){
  const name=String(a?.subtype||a?.name||'').toLowerCase();
  if(/check(?:ing)?|current account/.test(name))return 'checking';
  if(/sav(?:ing)?s|money.market|high.yield/.test(name))return 'savings';
  return null;
 }
 function summarize(accounts){
  const all=Array.isArray(accounts)?accounts:[];
  const result={checking:[],savings:[]};
  for(const a of all){
   const target=kind(a);
   if(target)result[target].push(a);
  }
  return Object.fromEntries(Object.entries(result).map(([name,list])=>{
   const sources=list.map(a=>({a,value:balance(a.current)??balance(a.available)}));
   const included=sources.filter(x=>x.value!==null);
   const total=included.length?Math.round(included.reduce((n,x)=>n+x.value,0)*100)/100:null;
   const single=list.length===1?list[0]:null;
   const lastReportedAt=list.map(a=>Number(a.lastReportedAt)||0).filter(Boolean).sort((a,b)=>b-a)[0]||null;
   return [name,{kind:name,balance:total,accounts:list.length,complete:included.length===list.length,
    name:single?.name||null,mask:single?.mask||null,institution:single?.institution||null,
    lastReportedAt,stale:list.some(a=>a.stale===true)}];
  }));
 }
 root.LifeOSBankBalances=Object.freeze({kind,summarize});
})(typeof window!=='undefined'?window:globalThis);
