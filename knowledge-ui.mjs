import {templates,searchTemplates,providers} from './knowledge-core.mjs';

const bridge=window.LifeOSKnowledgeBridge;
const store=window.LifeOSReferenceDB;
const state={tab:'template',query:'',results:[],favorites:[],cached:0,searching:false,loaded:false,notice:'',cacheStatus:'',
 country:'US',year:new Date().getFullYear(),shown:24,lastSearch:''};
const icons={food:'◈',exercise:'↗',holiday:'▦',template:'▤'};
const tabs=[['template','Starter templates'],['food','Food data'],['exercise','Exercises'],['holiday','Holidays'],['saved','Saved references']];
const esc=s=>bridge.safe(s);
const title=x=>x.type==='food'?'Food':x.type==='exercise'?'Exercise':x.type==='holiday'?'Holiday':'Life template';
const num=x=>x==null||!Number.isFinite(Number(x))?'—':(+x).toLocaleString(undefined,{maximumFractionDigits:1});
const localDate=d=>new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const sourceLink=x=>{try{const u=new URL(x.sourceUrl);return u.protocol==='https:'&&['fdc.nal.usda.gov','wger.de','nagerholidays.com'].includes(u.hostname)?'<a href="'+esc(u.toString())+'" target="_blank" rel="noopener noreferrer">Source ↗</a>':'';}catch{return '';}};
const keyOf=x=>String(x.key||'');
const match=(arr,q)=>{q=q.trim().toLowerCase();return q?arr.filter(x=>(x.title+' '+(x.description||'')+' '+(x.category||'')+' '+(x.provider||'')).toLowerCase().includes(q)):arr;};
function header(){
 return '<div class="page-head"><div><div class="eyebrow">LIFEOS / KNOWLEDGE</div><h1>Reference Library</h1>'+
 '<p>Real food data, exercises, holidays and reusable routines—without a complicated setup.</p></div>'+
 '<div class="head-actions"><button class="outline-btn" data-kn-action="backup">Export references</button></div></div>';
}
function bar(){
 const current=state.tab;
 return '<nav class="kn-tabs" aria-label="Reference categories">'+tabs.map(([id,label])=>
 '<button type="button" class="kn-tab '+(id===current?'active':'')+'" data-kn-tab="'+id+'" aria-pressed="'+(id===current)+'">'+label+'</button>').join('')+'</nav>';
}
function controls(){
 const isHoliday=state.tab==='holiday',isSaved=state.tab==='saved',isTemplate=state.tab==='template';
 const description={template:'Browse reusable ideas and routines. Nothing is added until you choose it.',
 food:'Look up USDA nutrition records. Use a weighed portion to log a meal.',
 exercise:'Find public exercise references from wger and add them to a workout.',
 holiday:'Look up official public holidays by country and year.',
 saved:'Find references you previously bookmarked.'}[state.tab];
 let inputs=isHoliday?'<div class="kn-controls-row"><label>Country <input id="knCountry" class="field" maxlength="2" value="'+esc(state.country)+'" placeholder="US" aria-label="Two-letter country code"></label>'+
 '<label>Year <input id="knYear" class="field" type="number" min="2024" max="2037" value="'+state.year+'"></label>'+
 '<button class="primary-btn" data-kn-action="search">Find holidays</button></div>':
 '<form id="knSearch" class="kn-search-form"><input id="knQuery" class="field" maxlength="80" value="'+esc(state.query)+'" placeholder="'+
 esc(isTemplate?'Search starter routines...':isSaved?'Search saved references...':state.tab==='food'?'E.g. eggs, oatmeal or chicken':'E.g. squat, row, shoulder')+
 '" aria-label="Search reference database"><button class="primary-btn" type="submit">'+(isTemplate||isSaved?'Search':'Search database')+'</button></form>';
 return '<section class="panel panel-pad kn-search-panel"><div class="kn-search-head"><h2>'+tabs.find(x=>x[0]===state.tab)[1]+'</h2>'+
 '<span class="kn-note">'+(isTemplate?'Available offline':isSaved?'On this device':'Live reference lookup')+'</span></div>'+
 '<p class="fine" style="margin:7px 0 12px">'+description+'</p>'+inputs+
 '<div class="kn-source-note">'+(providers[state.tab]?
 'Source: <a target="_blank" rel="noopener noreferrer" href="'+esc(providers[state.tab].url)+'">'+esc(providers[state.tab].name)+'</a> · '+esc(providers[state.tab].license):
 'Your saved sources remain on this device.')+'</div></section>';
}
function card(item,i){
 const saved=state.favorites.some(x=>x.key===item.key),source=item.provider||'Reference',description=String(item.description||'').slice(0,390);
 const metric=item.type==='food'?'<div class="kn-metrics"><span>'+num(item.metrics?.calories)+' kcal</span><span>'+num(item.metrics?.protein)+' g protein</span><span>'+num(item.metrics?.carbs)+' g carbs</span><span>'+num(item.metrics?.fat)+' g fat</span></div><p class="kn-measure">USDA reference values per 100 g; check the record and product.</p>':
 item.type==='exercise'?'<div class="kn-tags">'+(item.category?'<span>'+esc(item.category)+'</span>':'')+
 (item.equipment||[]).slice(0,3).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>':
 item.type==='holiday'?'<div class="kn-tags"><span>'+esc(item.date)+'</span><span>'+esc(item.country)+'</span></div>':
 '<div class="kn-tags"><span>'+esc(item.category||'Routine')+'</span>'+(item.repeat&&item.repeat!=='none'?'<span>Repeat: '+esc(item.repeat)+'</span>':'')+'</div>';
 const portion=item.type==='food'?'<label class="kn-portion">Portion (g)<input class="field" id="kn-grams-'+i+'" type="number" min="1" max="5000" step="1" value="100"></label>':'';
 const action=item.type==='food'?'Log food':item.type==='exercise'?'Add workout':item.type==='holiday'?'Add to calendar':'Use template';
 return '<article class="kn-card"><div class="kn-card-top"><span class="kn-type">'+icons[item.type]+' '+title(item)+'</span>'+
 '<button class="kn-save '+(saved?'selected':'')+'" data-kn-fav="'+i+'" aria-label="'+(saved?'Remove from saved':'Save reference')+'" title="'+(saved?'Unsave':'Save')+'">'+(saved?'★':'☆')+'</button></div>'+
 '<h3>'+esc(item.title)+'</h3>'+(description?'<p class="kn-description">'+esc(description)+'</p>':'')+metric+
 '<div class="kn-card-bottom"><span class="kn-source">'+esc(source)+
 (item.fetchedAt?'<small> · '+localDate(item.fetchedAt)+'</small>':'')+'</span>'+sourceLink(item)+'</div>'+
 '<div class="kn-use-row">'+portion+'<button class="primary-btn" data-kn-use="'+i+'">'+action+'</button></div></article>';
}
function content(){
 const arr=state.results.slice(0,state.shown),list=arr.map(card).join('');
 const note=state.tab==='exercise'?'Exercise results come from a sampled public catalog, not a complete search index.':
 state.tab==='food'?'Nutrient values may be missing or incomplete. A portion is not automatically a serving size.':
 state.tab==='holiday'?'Holidays depend on jurisdiction; confirm regional observances.':
 state.tab==='template'?'LifeOS-authored templates are starting points, not medical or legal guidance.':'';
 return '<div class="kn-result-head"><div><strong>'+state.results.length+' results</strong><small> · '+(state.searching?'Searching...':state.cacheStatus||'Ready')+'</small></div>'+
 '<span class="tiny">'+state.cached+' stored references · '+state.favorites.length+' saved</span></div>'+
 (state.notice?'<div class="kn-message" role="status">'+esc(state.notice)+'</div>':'')+
 (note?'<p class="kn-caveat">'+note+'</p>':'')+
 (state.searching?'<div class="kn-loading">Looking up the reference source…</div>':'')+
 (list?'<div class="kn-grid">'+list+'</div>':!state.searching?
 '<div class="empty"><div class="empty-icon">⌕</div><strong>No references shown</strong><p>'+
 (state.tab==='food'||state.tab==='exercise'?'Enter a search, or use cached results while offline.':'Try a different keyword or category.')+
 '</p></div>':'')+
 (state.results.length>state.shown?'<div class="kn-showmore"><button class="outline-btn" data-kn-action="more">Show more ('+(state.results.length-state.shown)+' remaining)</button></div>':'')+
 '<div class="kn-footnote">Public reference sources are separate from your private LifeOS records. Saving or using a reference never sends your personal notes or finances to the source.</div>';
}
function render(){
 return header()+bar()+controls()+content()+'<input hidden type="file" accept=".json,application/json" id="knImportFile">'+
 '<div class="kn-backup-foot"><button class="ghost-btn" data-kn-action="import">Restore reference backup</button>'+
 '<button class="ghost-btn" data-kn-action="offline">Search cached records</button></div>';
}
async function redraw(){state.favorites=await store.favorites();state.cached=(await store.stats()).cached;bridge.redraw();}
async function init(){
 if(!bridge||!store)return;
 bridge.registerRenderer(render);
 try{await store.saveMany(templates);state.loaded=true;await selectTab('template');}
 catch(e){state.notice='Local reference storage is limited on this device. Templates are still available for this session.';state.results=templates;bridge.redraw();}
}
async function selectTab(tab){
 if(!tabs.some(x=>x[0]===tab))return;
 state.tab=tab;state.shown=24;state.cacheStatus='';state.query='';state.notice='';
 if(tab==='template'){state.results=templates;state.cacheStatus='51 built-in starter templates';}
 else if(tab==='saved'){state.results=await store.favorites();state.cacheStatus='Saved on this device';}
 else{state.results=(await store.find(tab,'',25));state.cacheStatus=state.results.length?'Showing saved offline references':'Ready for search';}
 await redraw();
}
async function search(){
 if(state.searching)return;
 const input=document.querySelector('#knQuery');if(input)state.query=input.value.trim();
 if(state.tab==='template'){state.results=searchTemplates(state.query);state.cacheStatus='Offline starter library';state.shown=24;await redraw();return;}
 if(state.tab==='saved'){state.results=match(await store.favorites(),state.query);state.cacheStatus='Your saved references';state.shown=24;await redraw();return;}
 if(state.tab==='holiday'){
  const country=(document.querySelector('#knCountry')?.value||'US').trim().toUpperCase(),year=Number(document.querySelector('#knYear')?.value||new Date().getFullYear());
  if(!/^[A-Z]{2}$/.test(country)||!Number.isInteger(year)||year<2024||year>2037){state.notice='Enter a two-letter country code and a year from 2024 to 2037.';await redraw();return;}
  state.country=country;state.year=year;
 }else if(state.query.length<2||state.query.length>80){state.notice='Enter at least two characters to search.';await redraw();return;}
 state.searching=true;state.notice='';state.lastSearch=state.query;bridge.redraw();
 let endpoint='/.netlify/functions/knowledge?source='+encodeURIComponent(state.tab);
 if(state.tab==='holiday')endpoint+='&country='+state.country+'&year='+state.year;
 else endpoint+='&query='+encodeURIComponent(state.query);
 try{
  const res=await fetch(endpoint,{cache:'no-store'});
  const data=await res.json().catch(()=>({error:'The source returned an unreadable result'}));
  if(!res.ok)throw Error(data.error||'Source temporarily unavailable ('+res.status+')');
  state.results=Array.isArray(data.results)?data.results:[];state.cacheStatus=(data.cache==='stale'?'Saved data':data.cache==='fresh'?'Cached reference':'Updated from source');
  state.notice=data.warning||data.coverage||'';
  if(state.results.length)await store.saveMany(state.results);
 }catch(e){
  const cached=await store.find(state.tab,state.tab==='holiday'?'':state.query);
  state.results=cached;state.cacheStatus=cached.length?'Offline cache':'Source unavailable';
  state.notice=String(e.message||e)+(cached.length?' Showing saved records instead.':'');
 }
 state.shown=24;state.searching=false;await redraw();
}
async function useEntry(i){
 const x=state.results[i];if(!x)return;
 let grams=100;
 if(x.type==='food'){grams=Number(document.querySelector('#kn-grams-'+i)?.value||0);if(!Number.isFinite(grams)||grams<1||grams>5000){state.notice='Enter a portion from 1 to 5000 grams.';await redraw();return;}}
 try{
 const item=bridge.addReference(x,{grams});await store.favorite(x,true);
 await redraw();bridge.toast(x.type==='food'?'Food logged with USDA reference values.':x.type==='exercise'?'Workout draft added.':x.type==='holiday'?'Holiday added to calendar.':'Template added to LifeOS.');
 if(x.type==='food')bridge.go('food');
 else if(x.type==='exercise')bridge.go('fitness');
 else if(x.type==='holiday')bridge.go('calendar');
 else bridge.go(item.kind==='pet'?'pets':item.kind==='chore'?'home':item.kind==='bill'?'money':item.kind==='workout'?'fitness':item.kind==='habit'?'routines':'planner');
 }catch(e){state.notice='Cannot add reference: '+String(e.message||e);await redraw();}
}
async function toggleFavorite(i){
 const x=state.results[i];if(!x)return;
 try{const saved=await store.isFavorite(x.key);await store.favorite(x,!saved);
 if(state.tab==='saved'&&saved)state.results=state.results.filter(y=>y.key!==x.key);
 await redraw();}catch(e){state.notice='Unable to save reference: '+String(e.message||e);await redraw();}
}
function exportFile(data,name){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
document.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-kn-tab]');if(nav){await selectTab(nav.dataset.knTab);return;}
 const use=e.target.closest('[data-kn-use]');if(use){await useEntry(Number(use.dataset.knUse));return;}
 const fav=e.target.closest('[data-kn-fav]');if(fav){await toggleFavorite(Number(fav.dataset.knFav));return;}
 const act=e.target.closest('[data-kn-action]');if(!act)return;
 if(act.dataset.knAction==='search'){await search();return;}
 if(act.dataset.knAction==='more'){state.shown+=24;bridge.redraw();return;}
 if(act.dataset.knAction==='offline'){state.results=await store.find(state.tab==='saved'?'':state.tab,state.query,200);state.cacheStatus='Saved on this device';state.notice='Offline results may be out of date; sources are provided for verification.';await redraw();return;}
 if(act.dataset.knAction==='backup'){exportFile(await store.exportLibrary(),'LifeOS-reference-backup-'+new Date().toISOString().slice(0,10)+'.json');return;}
 if(act.dataset.knAction==='import'){document.querySelector('#knImportFile')?.click();}
});
document.addEventListener('submit',async e=>{if(e.target.id==='knSearch'){e.preventDefault();await search();}});
document.addEventListener('change',async e=>{
 if(e.target.id!=='knImportFile'||!e.target.files?.[0])return;
 const f=e.target.files[0];if(f.size>6_000_000){state.notice='Reference backup is too large (6 MB maximum).';await redraw();return;}
 try{await store.importLibrary(JSON.parse(await f.text()));state.notice='Reference backup restored.';await selectTab(state.tab);}
 catch(error){state.notice='Backup import failed: '+String(error.message||error);await redraw();}
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
