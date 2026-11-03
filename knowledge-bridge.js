/* Connect the public reference library to existing LifeOS data without exposing private records to source APIs. */
(() => {
 'use strict';
 META.library={label:'Reference Library',icon:'⌕',group:'TOOLS',desc:'Search sourced foods, exercises, holidays and useful templates.'};
 const priorRender=render;
 let libraryRenderer=()=>'<section class="panel panel-pad"><h2>Loading reference library…</h2></section>';
 function chrome(){
  document.documentElement.dataset.theme=db.settings.theme||'dark';
  $('#sidebarNav').innerHTML=navHTML();
  $('#breadcrumb').textContent='Reference Library';
  $('#todayLabel').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
  $('#avatarButton').textContent=(db.settings.name||'L').slice(0,1).toUpperCase();
  $('#bellDot').style.display=db.items.some(x=>x.alert&&x.dueAt&&!doneOn(x))?'block':'none';
  document.querySelectorAll('.mobile-tab[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===currentPage));
 }
 render=function(){
  if(currentPage==='library'){chrome();$('#view').innerHTML=libraryRenderer();return;}
  priorRender();
  if(currentPage==='explore'){
    const list=$('#view .simple-explore-grid');
    if(list&&!list.querySelector('[data-nav="library"]')){
      list.insertAdjacentHTML('beforeend','<section class="panel panel-pad simple-explore-section">'+
        '<h2>Open reference data</h2><div class="simple-explore-links">'+
        '<button type="button" class="simple-explore-link" data-nav="library"><span class="simple-explore-icon">⌕</span>'+
        '<span><strong>Reference Library</strong><small>Explore exercises, food nutrition, holidays and reusable routine templates.</small></span><b>›</b></button></div></section>');
    }
  }
  if(currentPage==='food'||currentPage==='fitness'){
    const actions=$('#view .head-actions');
    if(actions&&!actions.querySelector('[data-nav="library"]'))actions.insertAdjacentHTML('afterbegin',
      '<button class="outline-btn" data-nav="library">⌕ Search '+(currentPage==='food'?'foods':'exercises')+'</button>');
  }
 };
 function addReference(x,opts={}){
  if(!x||!['food','exercise','holiday','template'].includes(x.type)||!x.title)throw Error('Unsupported reference record');
  const d=new Date(),today=localDateTime(d);
  const sourceNotes=['Reference: '+(x.provider||'LifeOS'),x.sourceUrl||'',x.description||''].filter(Boolean).join(' | ').slice(0,1300);
  let item={id:uid(),kind:'task',title:String(x.title).slice(0,150),repeat:'none',priority:'Normal',
    dueAt:today,createdAt:Date.now(),updatedAt:Date.now(),alert:false,leadMinutes:0,
    details:sourceNotes,notes:sourceNotes,done:false,referenceKey:x.key||'',referenceProvider:x.provider||''};
  if(x.type==='food'){
    const grams=Number(opts.grams);if(!Number.isFinite(grams)||grams<=0||grams>5000)throw Error('Enter a portion from 1 to 5000 grams');
    const scale=grams/100,m=x.metrics||{};
    item={...item,kind:'meal',category:'Other',title:x.title+' ('+grams+' g)',
      details:'USDA reference amounts per 100 g × '+scale.toFixed(2)+' | '+sourceNotes,
      notes:'Portion: '+grams+' g. Values estimated from reference. '+sourceNotes,
      calories:m.calories==null?'':Math.round(m.calories*scale),
      protein:m.protein==null?'':Math.round(m.protein*scale*10)/10,
      fat:m.fat==null?'':Math.round(m.fat*scale*10)/10,
      carbs:m.carbs==null?'':Math.round(m.carbs*scale*10)/10,
      grams,done:true};
  }else if(x.type==='exercise'){
    item={...item,kind:'workout',duration:30,category:x.category||'Other',details:'Exercise reference: '+sourceNotes,done:false};
  }else if(x.type==='holiday'){
    item={...item,kind:'event',dueAt:x.date+'T09:00',allDay:true,location:'',notes:'All-day calendar reference; 9 AM is a display placeholder, not an event time. '+sourceNotes};
  }else{
    const permitted=['task','habit','workout','meal','pet','bill','chore','event','project','checkin','reminder'];
    item={...item,kind:permitted.includes(x.kind)?x.kind:'task',repeat:x.repeat||'none',
      dueAt:today,details:x.description||'',notes:'Editable starter template. '+sourceNotes,
      duration:x.duration||undefined};
  }
  db.items.push(item);save();
  if(typeof syncReminder==='function')syncReminder(item);
  return item;
 }
 window.LifeOSKnowledgeBridge=Object.freeze({
  registerRenderer(fn){if(typeof fn==='function')libraryRenderer=fn;},
  redraw(){if(currentPage==='library')render();},
  current(){return currentPage;},
  go(page){setPage(page);},
  addReference,
  safe,
  toast,
  dayKey,
  getMode(){return db.settings.mode||'simple';}
 });
})();
