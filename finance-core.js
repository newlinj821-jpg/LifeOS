/* LifeOS finance calculations — private data never leaves the device. */
(function(root){
  'use strict';
  const round=(n)=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  // Support plain numbers and familiar currency input like "$2,450.75".
  // Never accept negative amounts, arithmetic, or exponent notation.
  const parseMoneyInput=v=>{
    if(typeof v==='number')return Number.isFinite(v)&&v>=0&&v<=100000000?v:null;
    if(typeof v!=='string')return null;
    const text=v.trim().replace(/^\$/,'').replace(/,/g,'').trim();
    if(!/^(?:\d+)(?:\.\d{0,2})?$/.test(text))return null;
    const value=Number(text);
    return Number.isFinite(value)&&value>=0&&value<=100000000?value:null;
  };
  const validAmount=v=>parseMoneyInput(v)!==null;
  const amount=v=>validAmount(v)?round(parseMoneyInput(v)):0;
  const validMonth=(v)=>typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v);
  const localParts=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return null;const y=+m[1],mo=+m[2],d=+m[3];if(y<1900||y>2100||mo<1||mo>12||d<1||d>31)return null;const date=new Date(y,mo-1,d,12);return date.getFullYear()===y&&date.getMonth()===mo-1&&date.getDate()===d?date:null};
  const stamp=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const makeMonth=(month)=>validMonth(month)?month:(new Date()).getFullYear()+'-'+String((new Date()).getMonth()+1).padStart(2,'0');
  const monthStart=month=>{const [y,m]=makeMonth(month).split('-').map(Number);return new Date(y,m-1,1,12)};
  const endOfMonth=(month)=>{const [y,m]=makeMonth(month).split('-').map(Number);return new Date(y,m,0,12)};
  const isSavings=x=>x&&x.kind==='bill'&&String(x.category||'').trim().toLowerCase()==='savings';
  function datesForBill(bill,month){
    if(!bill||bill.kind!=='bill')return [];
    const start=localParts(bill.dueAt);
    const m=makeMonth(month),end=endOfMonth(m),begin=monthStart(m);
    const repeat=bill.repeat||'none';
    if(!start){
      // A bill without a scheduled date is listed, but does not enter a month forecast.
      return [];
    }
    if(start>end)return [];
    if(repeat==='none')return stamp(start).slice(0,7)===m?[stamp(start)]:[];
    if(repeat==='monthly'){
      const day=Math.min(start.getDate(),end.getDate());
      return [stamp(new Date(end.getFullYear(),end.getMonth(),day,12))];
    }
    if(repeat==='weekly'||repeat==='daily'||repeat==='weekdays'){
      let d=new Date(start),count=0,found=[];
      while(d<=end&&count++<11000){
        if(d>=begin&&(repeat!=='weekdays'||![0,6].includes(d.getDay())))found.push(stamp(d));
        d.setDate(d.getDate()+(repeat==='weekly'?7:1));
        d.setHours(12,0,0,0);
      }
      return found;
    }
    return stamp(start).slice(0,7)===m?[stamp(start)]:[];
  }
  function paidCount(bill,occurrences,month){
    if(!occurrences.length)return 0;
    if(bill.repeat&&bill.repeat!=='none'){
      const done=new Set((bill.completedDates||[]).filter(x=>typeof x==='string'&&x.startsWith(month)));
      // Monthly completion dates may differ from scheduled dates; the month itself is decisive.
      if(bill.repeat==='monthly')return done.size>0?1:0;
      return Math.min(done.size,occurrences.length);
    }
    return bill.done===true||bill.status==='Completed'?1:0;
  }
  const profile=value=>{
    const v=value&&typeof value==='object'?value:{};
    return {monthlyIncome:amount(v.monthlyIncome),savingsBalance:amount(v.savingsBalance),savingsGoal:amount(v.savingsGoal)};
  };
  function summary(allItems,finances,month){
    const p=profile(finances),m=makeMonth(month);
    let planned=0,paid=0,pending=0,plannedSavings=0,paidSavings=0;
    const rows=[];
    for(const bill of (Array.isArray(allItems)?allItems:[]).filter(x=>x?.kind==='bill')){
      const occurrences=datesForBill(bill,m),cost=amount(bill.amount);
      const saved=isSavings(bill);
      const plannedTotal=round(cost*occurrences.length),paidOccurrences=paidCount(bill,occurrences,m);
      const paidTotal=round(cost*paidOccurrences);
      planned=round(planned+plannedTotal);paid=round(paid+paidTotal);
      pending=round(pending+(plannedTotal-paidTotal));
      if(saved){plannedSavings=round(plannedSavings+plannedTotal);paidSavings=round(paidSavings+paidTotal);}
      if(occurrences.length){
        rows.push({id:bill.id,title:bill.title||'Untitled expense',category:bill.category||'Other',
         amount:cost,planned:plannedTotal,paid:paidTotal,remaining:round(plannedTotal-paidTotal),
         occurrences:occurrences.length,paidOccurrences,savings:saved,repeat:bill.repeat||'none',first:occurrences[0]});
      }
    }
    const income=p.monthlyIncome;
    return {month:m,income,planned,paid,pending,plannedSavings,paidSavings,
      otherExpenses:round(planned-plannedSavings),
      available:round(income-planned),
      afterPaid:round(income-paid),
      savingsBalance:p.savingsBalance,savingsGoal:p.savingsGoal,
      savingsProgress:p.savingsGoal?Math.min(100,Math.round(p.savingsBalance/p.savingsGoal*100)):0,
      rows:rows.sort((a,b)=>a.first.localeCompare(b.first))};
  }
  root.LifeOSFinanceCore=Object.freeze({amount,validAmount,parseMoneyInput,validMonth,profile,summary,datesForBill,isSavings});
})(typeof window!=='undefined'?window:globalThis);
