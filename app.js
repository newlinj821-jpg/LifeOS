/* LifeOS — local-first personal operating system */
const STORE='lifeos.data.v1', SESSION_STORE='lifeos.auth.v1', PUSH_TOKEN='lifeos.push.manageToken';
const META={
 today:{label:'Today',icon:'⌂',group:'CORE',desc:'Your personal command center.'},
 planner:{label:'Planner',icon:'☑',group:'CORE',desc:'Tasks, priorities and everything coming up.'},
 calendar:{label:'Calendar',icon:'▦',group:'CORE',desc:'A unified view of your commitments.'},
 routines:{label:'Routines',icon:'↻',group:'EVERYDAY',desc:'Build consistency without punishing yourself for a missed day.'},
 fitness:{label:'Fitness',icon:'↗',group:'EVERYDAY',desc:'Movement plans, workouts and progress.'},
 food:{label:'Food & Water',icon:'◌',group:'EVERYDAY',desc:'Meals, nutrition notes and hydration.'},
 money:{label:'Money',icon:'＄',group:'EVERYDAY',desc:'Bills, expenses and your financial picture.'},
 home:{label:'Home',icon:'⌑',group:'EVERYDAY',desc:'Chores, maintenance and household responsibilities.'},
 pets:{label:'Pets',icon:'♧',group:'EVERYDAY',desc:'Care schedules, feeding and important pet reminders.'},
 wellness:{label:'Wellness',icon:'♡',group:'EVERYDAY',desc:'Daily check-ins, rest and reflection.'},
 projects:{label:'Projects',icon:'▤',group:'BUILD & GROW',desc:'Everything you are creating, in one organized space.'},
 goals:{label:'Goals',icon:'◎',group:'BUILD & GROW',desc:'Ambitions made measurable.'},
 vault:{label:'BrainVault',icon:'◇',group:'BUILD & GROW',desc:'Keep ideas, research and personal notes together.'},
 journal:{label:'Journal',icon:'✎',group:'BUILD & GROW',desc:'A record of the days and thoughts that matter.'},
 reminders:{label:'Reminders',icon:'♧',group:'TOOLS',desc:'Detailed alerts that actually mean something.'},
 insights:{label:'Insights',icon:'▥',group:'TOOLS',desc:'Patterns, progress and useful life statistics.'},
 settings:{label:'Settings',icon:'⚙',group:'TOOLS',desc:'Make LifeOS work the way you do.'}
};
const KIND={
 task:{label:'Task',section:'planner',icon:'☑',fields:[['category','Category','text','Personal'],['priority','Priority','select',['Normal','High','Urgent']]]},
 event:{label:'Event',section:'calendar',icon:'▦',fields:[['location','Location','text','Address or online link'],['duration','Duration (minutes)','number','60']]},
 habit:{label:'Routine',section:'routines',icon:'↻',fields:[['category','Area of life','text','Morning, home, self-care'],['target','Daily target','number','1']]},
 workout:{label:'Workout',section:'fitness',icon:'↗',fields:[['duration','Duration (minutes)','number','45'],['category','Workout type','select',['Strength','Cardio','Mobility','Walking','Sports','Other']],['details','Exercises or plan','textarea','Exercises, sets, reps, equipment...']]},
 meal:{label:'Meal',section:'food',icon:'◌',fields:[['category','Meal type','select',['Breakfast','Lunch','Dinner','Snack','Other']],['calories','Calories','number','0'],['protein','Protein (g)','number','0'],['details','Food / recipe details','textarea','Ingredients, portions or what you ate...']]},
 bill:{label:'Bill or expense',section:'money',icon:'＄',fields:[['amount','Amount ($)','number','0'],['category','Category','select',['Housing','Utilities','Transport','Food','Health','Subscriptions','Pets','Shopping','Other']],['details','Payment details','textarea','Payee, payment method, or confirmation...']]},
 chore:{label:'Household task',section:'home',icon:'⌑',fields:[['category','Room or area','text','Kitchen, bathroom, yard...'],['details','Instructions / supplies','textarea','What is needed...']]},
 pet:{label:'Pet care',section:'pets',icon:'♧',fields:[['petName','Pet name','text','Name of pet'],['category','Care type','select',['Feeding','Bathroom','Medication','Walk','Grooming','Vet','Other']],['details','Care instructions','textarea','Amounts, instructions or additional details...']]},
 checkin:{label:'Wellness check-in',section:'wellness',icon:'♡',fields:[['mood','Mood (1-5)','select',['1','2','3','4','5']],['energy','Energy (1-5)','select',['1','2','3','4','5']],['sleep','Sleep hours','number','8'],['details','Reflection','textarea','What affected today?']]},
 project:{label:'Project',section:'projects',icon:'▤',fields:[['category','Area','text','Personal, building, creative...'],['status','Status','select',['Not started','In progress','Paused','Completed']],['progress','Progress (%)','number','0'],['details','Next steps','textarea','Milestones and next actions...']]},
 goal:{label:'Goal',section:'goals',icon:'◎',fields:[['target','Target value','number','10'],['current','Current value','number','0'],['unit','Unit','text','times, dollars, books...'],['details','Why this matters','textarea','Motivation and milestones...']]},
 note:{label:'Note',section:'vault',icon:'◇',fields:[['category','Folder / category','text','Ideas, books, research...'],['details','Note content','textarea','Write freely...']]},
 journal:{label:'Journal entry',section:'journal',icon:'✎',fields:[['mood','Mood (1-5)','select',['1','2','3','4','5']],['details','Your entry','textarea','Write about your day...']]},
 reminder:{label:'Reminder',section:'reminders',icon:'♧',fields:[['category','Category','select',['Personal','Workout','Meal','Medication','Home','Pet care','Payment','Appointment','Other']],['details','Specific instructions','textarea','What needs doing? Include context that helps you act.']]}
};
const SECTION_KINDS={planner:['task'],calendar:['event'],routines:['habit'],fitness:['workout'],food:['meal'],money:['bill'],home:['chore'],pets:['pet'],wellness:['checkin'],projects:['project'],goals:['goal'],vault:['note'],journal:['journal'],reminders:['reminder']};
const $=sel=>document.querySelector(sel);
let currentPage='today', filter='all', keyword='', selectedDay=dayKey(new Date()), calendarCursor=new Date(), config={}, pushEnabled=false, toastHandle=0, pendingSync=false;
const defaults=()=>({version:1,items:[],water:{},settings:{name:'',theme:'dark',budget:0,lowEnergy:false,hidden:[],dailyWater:8,privatePush:false,quietEnabled:false,quietStart:'22:00',quietEnd:'07:00'},fired:{},createdAt:Date.now()});
function load(){try{const obj=JSON.parse(localStorage.getItem(STORE));if(obj&&Array.isArray(obj.items))return {...defaults(),...obj,settings:{...defaults().settings,...obj.settings}};}catch(e){}return defaults();}
let db=load();
function save(){try{localStorage.setItem(STORE,JSON.stringify(db));}catch(e){toast('Storage is full. Export a backup and clear unused records.');}render();}
function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function dayKey(d){const z=new Date(d);return Number.isNaN(+z)?'':z.getFullYear()+'-'+String(z.getMonth()+1).padStart(2,'0')+'-'+String(z.getDate()).padStart(2,'0');}
function localDateTime(d){const a=new Date(d);return dayKey(a)+'T'+String(a.getHours()).padStart(2,'0')+':'+String(a.getMinutes()).padStart(2,'0');}
function dateLabel(v,opt={}){if(!v)return 'No date';const d=new Date(v);return isNaN(+d)?'Unknown date':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',...opt}).format(d);}
function timeLabel(v){if(!v)return 'Any time';const d=new Date(v);return isNaN(+d)?'':new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(d);}
function money(n){return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n)||0);}
function uid(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():'item-'+Date.now()+'-'+Math.random().toString(36).slice(2);}
function items(kind){return db.items.filter(x=>!kind||x.kind===kind);}
function isRepeat(item){return item.repeat&&item.repeat!=='none';}
function addDays(d,n){const a=new Date(d);a.setDate(a.getDate()+n);return a;}
function nextOccurrence(item,from=new Date()){
 if(!item.dueAt)return null;
 let d=new Date(item.dueAt);if(Number.isNaN(+d))return null;
 if(!isRepeat(item))return d;
 const threshold=new Date(from);threshold.setHours(0,0,0,0);
 let runs=0;
 while(d<threshold&&runs++<1600){
  if(item.repeat==='daily'||item.repeat==='weekdays')d=addDays(d,1);
  else if(item.repeat==='weekly')d=addDays(d,7);
  else if(item.repeat==='monthly'){const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}
  else return d;
 }
 if(item.repeat==='weekdays'){while([0,6].includes(d.getDay()))d=addDays(d,1);}
 return d;
}
function doneOn(item,key=dayKey(new Date())){return isRepeat(item)?(item.completedDates||[]).includes(key):Boolean(item.done||item.status==='Completed');}
function happensOn(item,key){const d=nextOccurrence(item,new Date(key+'T00:00:00'));return d&&dayKey(d)===key;}
function dueItemsFor(key){return db.items.filter(i=>i.dueAt&&happensOn(i,key)).sort((a,b)=>(a.dueAt||'').localeCompare(b.dueAt||''));}
function completion(item){const key=dayKey(new Date());if(isRepeat(item)){const dates=new Set(item.completedDates||[]);dates.has(key)?dates.delete(key):dates.add(key);item.completedDates=[...dates].slice(-400);}else{item.done=!item.done;if(item.kind==='project')item.status=item.done?'Completed':'In progress';}item.updatedAt=Date.now();save();syncReminder(item);}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('visible');clearTimeout(toastHandle);toastHandle=setTimeout(()=>e.classList.remove('visible'),3800);}
function setPage(page){if(!META[page])page='today';currentPage=page;filter='all';keyword='';history.replaceState(null,'','#'+page);$('#sidebar').classList.remove('open');$('#shade').classList.remove('show');render();window.scrollTo({top:0,behavior:'instant'});}
function btn(text,action,cls='outline-btn'){return '<button type="button" class="'+cls+'" data-action="'+action+'">'+text+'</button>';}
function newBtn(kind,label='＋ Add new'){return '<button type="button" class="primary-btn" data-create="'+kind+'">'+label+'</button>';}
function empty(title,body,kind){return '<div class="empty"><div class="empty-icon">◇</div><strong>'+safe(title)+'</strong><p>'+safe(body)+'</p>'+(kind?'<button class="outline-btn" data-create="'+kind+'">＋ Create your first '+safe(KIND[kind].label.toLowerCase())+'</button>':'')+'</div>';}
function header(title,description,actions=''){return '<div class="page-head"><div><div class="eyebrow">YOUR PERSONAL SPACE</div><h1>'+safe(title)+'</h1><p>'+safe(description)+'</p></div><div class="head-actions">'+actions+'</div></div>';}
function panel(title,body,right='',subtitle=''){return '<section class="panel"><div class="panel-head"><h2>'+title+'</h2>'+right+'</div>'+(subtitle?'<div class="panel-sub">'+subtitle+'</div>':'')+body+'</section>';}
function metric(icon,value,label){return '<article class="metric"><div class="metric-top"><div class="metric-icon">'+icon+'</div><span class="tiny">LIFEOS</span></div><div class="metric-value">'+value+'</div><div class="metric-label">'+label+'</div></article>';}
function progress(p){return '<div class="progress-track"><div class="progress-fill" style="width:'+Math.min(100,Math.max(0,Number(p)||0))+'%"></div></div>';}
function row(item,opts={}){
 const when=nextOccurrence(item), completed=doneOn(item), title=safe(item.title);
 const details=[KIND[item.kind]?.label||'Item',when?dateLabel(when)+(item.dueAt?' · '+timeLabel(when):''):'',item.category,item.petName].filter(Boolean).join(' · ');
 const check=['task','habit','chore','pet','bill','reminder'].includes(item.kind);
 return '<div class="entry-row">'+(check?'<input type="checkbox" class="tick" data-complete="'+safe(item.id)+'" aria-label="Mark '+title+' complete" '+(completed?'checked':'')+'>':'<span class="feature-icon" style="height:29px;width:29px;font-size:14px">'+(KIND[item.kind]?.icon||'◇')+'</span>')+'<div class="entry-main" data-edit="'+safe(item.id)+'"><div class="entry-title '+(completed?'done':'')+'">'+title+'</div><div class="entry-meta">'+safe(details)+(item.kind==='bill'?' · '+money(item.amount):'')+'</div></div>'+(item.alert&&item.dueAt?'<span class="tag purple" title="Reminder enabled">♧ Alert</span>':'')+'<button type="button" class="entry-action" data-edit="'+safe(item.id)+'" aria-label="Edit">›</button></div>';
}
function list(rows,kind){return rows.length?rows.map(x=>row(x)).join(''):empty('Nothing here yet','Start with something small. Your entries will show up here.',kind);}
function navHTML(){
 const groups=[...new Set(Object.values(META).map(x=>x.group))];
 return groups.map(g=>'<div class="nav-group-title">'+g+'</div>'+Object.entries(META).filter(([k,x])=>x.group===g&&k!=='settings'&&!(db.settings.hidden||[]).includes(k)).map(([k,x])=>'<button class="side-link '+(currentPage===k?'active':'')+'" data-nav="'+k+'"><span class="nav-icon">'+x.icon+'</span><span>'+x.label+'</span></button>').join('')).join('');
}
function today(){
 const name=db.settings.name?.trim(), hour=new Date().getHours(), greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
 const key=dayKey(new Date()), due=dueItemsFor(key), tasks=due.filter(i=>['task','chore','pet','reminder','habit'].includes(i.kind)), completed=tasks.filter(i=>doneOn(i,key)).length;
 const upcoming=db.items.filter(i=>i.dueAt&&nextOccurrence(i)&&nextOccurrence(i)>=new Date(Date.now()-86400000)&&!doneOn(i)).sort((a,b)=>nextOccurrence(a)-nextOccurrence(b)).slice(0,5);
 const bills=items('bill').filter(i=>!doneOn(i)&&i.dueAt).sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt)).slice(0,3);
 const active=items('project').filter(x=>x.status!=='Completed'&&!x.done).slice(0,3);
 const water=db.water[key]||0, target=db.settings.dailyWater||8;
 return '<div class="welcome"><div class="eyebrow">TODAY · '+safe(new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date()))+'</div><h1>'+greet+(name?', '+safe(name):'')+'.</h1><p>'+ (db.settings.lowEnergy?'Low-energy mode is on. Prioritize essentials, make the rest optional, and count small wins.':'Your day, your pace. Everything important is within reach, without the clutter.')+'</p><div class="welcome-buttons">'+newBtn('task','＋ Add a priority')+btn(db.settings.lowEnergy?'◉ Low-energy mode on':'◯ Low-energy mode','energy','outline-btn')+'</div></div>'+
 '<div class="metrics">'+metric('☑',completed+'/'+tasks.length,'Daily responsibilities')+metric('♧',db.items.filter(x=>x.alert&&x.dueAt&&!doneOn(x)).length,'Active reminders')+metric('◌',water+'/'+target,'Water servings today')+metric('◎',items('goal').length,'Goals tracked')+'</div>'+
 '<div class="grid-two"><div class="stack">'+panel('Your priorities',list(tasks,'task'),'<button class="minor" data-nav="planner">Open planner →</button>','Things scheduled for today · '+completed+' completed')+
 panel('Coming up',upcoming.length?upcoming.map(row).join(''):empty('Your calendar is clear','Add a dated task, event or reminder to see it here.','event'),'<button class="minor" data-nav="calendar">Full calendar →</button>')+
 panel('Quick capture','<div class="panel-pad"><div class="quick-grid">'+[['task','☑','Task'],['reminder','♧','Reminder'],['meal','◌','Meal'],['note','◇','Idea'],['workout','↗','Workout'],['bill','＄','Expense'],['journal','✎','Journal'],['event','▦','Event']].map(x=>'<button class="quick-item" data-create="'+x[0]+'"><strong>'+x[1]+'</strong><span>'+x[2]+'</span></button>').join('')+'</div></div>')+
 '</div><div class="stack">'+panel('Hydration','<div class="panel-pad"><div class="row-between"><div><div class="big-number">'+water+' <span class="muted" style="font-size:13px">/ '+target+' servings</span></div><p class="fine">Log a glass whenever you have one.</p></div><div class="feature-icon" style="font-size:26px">◌</div></div><div style="margin:17px 0">'+progress(water/target*100)+'</div><div class="button-row">'+btn('＋ Add water','water+','outline-btn')+btn('− Undo','water-','ghost-btn')+'</div></div>')+
 panel('Bills & payments',bills.length?bills.map(row).join(''):empty('No upcoming unpaid bills','Track a bill or monthly payment here.','bill'),'<button class="minor" data-nav="money">Money hub →</button>')+
 panel('Active projects',active.length?active.map(x=>'<div class="entry-row"><div class="entry-main" data-edit="'+safe(x.id)+'"><div class="entry-title">'+safe(x.title)+'</div><div class="entry-meta">'+safe(x.status||'In progress')+'</div><div style="margin-top:9px">'+progress(x.progress||0)+'</div></div><span class="tag purple">'+(x.progress||0)+'%</span></div>').join(''):empty('Space to build','Add a personal or creative project to track.','project'),'<button class="minor" data-nav="projects">Projects →</button>')+
 panel('Your day in one tap','<div class="panel-pad"><p class="fine">Capture how you feel today. You can add sleep, energy and a private reflection.</p><div class="button-row">'+newBtn('checkin','＋ Daily check-in')+btn('25-minute focus','focus','outline-btn')+'</div></div>')+'</div></div>';
}
function sectionPage(page){
 const kinds=SECTION_KINDS[page]||[],kind=kinds[0],m=META[page],subset=db.items.filter(x=>kinds.includes(x.kind));
 let shown=subset;
 if(keyword)shown=shown.filter(x=>JSON.stringify(x).toLowerCase().includes(keyword.toLowerCase()));
 if(filter==='active')shown=shown.filter(x=>!doneOn(x));
 if(filter==='done')shown=shown.filter(x=>doneOn(x));
 if(filter==='upcoming')shown=shown.filter(x=>x.dueAt&&nextOccurrence(x)>=new Date());
 shown=shown.sort((a,b)=>(nextOccurrence(a)||new Date('3000-01-01'))-(nextOccurrence(b)||new Date('3000-01-01')));
 let top='';
 if(page==='food'){const meals=subset.filter(x=>x.dueAt&&dayKey(new Date(x.dueAt))===dayKey(new Date()));const c=meals.reduce((n,x)=>n+(+x.calories||0),0),p=meals.reduce((n,x)=>n+(+x.protein||0),0);top='<div class="metrics">'+metric('◌',meals.length,'Meals logged today')+metric('∑',c,'Calories logged')+metric('↗',p+' g','Protein logged')+metric('◌',db.water[dayKey(new Date())]||0,'Water servings')+'</div>';}
 if(page==='fitness'){const recent=subset.filter(x=>x.dueAt&&new Date(x.dueAt)>=addDays(new Date(),-7));top='<div class="metrics">'+metric('↗',recent.length,'Workouts this week')+metric('◷',recent.reduce((a,x)=>a+(+x.duration||0),0),'Minutes logged')+metric('◎',subset.length,'Total sessions')+metric('♧',subset.filter(x=>x.alert).length,'Workout reminders')+'</div>';}
 if(page==='money'){const month=dayKey(new Date()).slice(0,7),spent=subset.filter(x=>x.dueAt?.startsWith(month)&&doneOn(x)).reduce((s,x)=>s+(+x.amount||0),0);const upcoming=subset.filter(x=>!doneOn(x)).reduce((s,x)=>s+(+x.amount||0),0);top='<div class="metrics">'+metric('＄',money(spent),'Paid this month')+metric('◷',money(upcoming),'Open amounts tracked')+metric('▣',money(db.settings.budget||0),'Monthly budget')+metric('▦',subset.length,'Bills & expenses')+'</div>';}
 if(page==='routines'){top='<div class="metrics">'+metric('↻',subset.length,'Routines')+metric('☑',subset.filter(x=>doneOn(x)).length,'Completed today')+metric('◎',subset.reduce((s,x)=>s+streak(x),0),'Combined streak days')+metric('♧',subset.filter(x=>x.alert).length,'Timed prompts')+'</div>';}
 if(page==='goals'){top='<div class="metrics">'+metric('◎',subset.length,'Active goals')+metric('✓',subset.filter(x=>(+x.current||0)>=(+x.target||1)).length,'Reached target')+metric('▥',subset.length?Math.round(subset.reduce((s,x)=>s+Math.min(1,(+x.current||0)/Math.max(1,+x.target||1)),0)/subset.length*100)+'%':'0%','Average progress')+metric('↗','∞','Room to grow')+'</div>';}
 const tools='<div class="list-tools"><input id="listSearch" class="search-field" placeholder="Search '+safe(m.label.toLowerCase())+'..." value="'+safe(keyword)+'" aria-label="Search items">'+[['all','All'],['active','Open'],['done','Completed'],['upcoming','Upcoming']].map(x=>'<button class="chip '+(filter===x[0]?'active':'')+'" data-filter="'+x[0]+'">'+x[1]+'</button>').join('')+'</div>';
 let body='';
 if(['projects','goals','vault','journal','wellness'].includes(page)){body='<div class="card-list">'+(shown.length?shown.map(featureCard).join(''):empty('Nothing added yet',m.desc,kind))+'</div>';}
 else body=panel(m.label+' entries',list(shown,kind),'',shown.length+' of '+subset.length+' entries');
 const advice=page==='reminders'?'<div class="status" style="margin-bottom:17px"><strong>Detailed reminder delivery:</strong> Each item can include a due time, repeat schedule, advance notice and useful context. Lock-screen push requires one-time cloud configuration in Settings. Local alerts are available while LifeOS is open.</div>':'';
 return header(m.label,m.desc,newBtn(kind,'＋ New '+KIND[kind].label.toLowerCase()))+top+advice+tools+body;
}
function featureCard(item){
 const v=item.kind,desc=item.details||item.notes||item.category||'Open this entry to add details.',when=nextOccurrence(item);
 const pct=v==='goal'?Math.round(Math.min(100,Math.max(0,(+item.current||0)/Math.max(1,+item.target||1)*100))):(+item.progress||0);
 return '<article class="feature-card"><div class="feature-card-head"><div class="feature-icon">'+KIND[v].icon+'</div><button class="entry-action" data-edit="'+safe(item.id)+'">•••</button></div><div data-edit="'+safe(item.id)+'" style="cursor:pointer"><h3>'+safe(item.title)+'</h3><p style="margin-top:6px">'+safe(String(desc).slice(0,145))+'</p></div>'+(['goal','project'].includes(v)?progress(pct):'')+'<div class="feature-bottom"><span class="pill">'+safe(v==='goal'?(item.current||0)+' / '+(item.target||0)+' '+(item.unit||''):when?dateLabel(when):item.category||KIND[v].label)+'</span><span class="tiny">'+(v==='goal'||v==='project'?pct+'%':'PRIVATE')+'</span></div></article>';
}
function streak(item){if(item.kind!=='habit')return 0;const done=new Set(item.completedDates||[]);let d=new Date();if(!done.has(dayKey(d)))d=addDays(d,-1);let n=0;while(done.has(dayKey(d))&&n<400){n++;d=addDays(d,-1);}return n;}
function calendarPage(){
 const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth();
 const first=new Date(year,month,1),start=addDays(first,-first.getDay());
 const cells=Array.from({length:42},(_,i)=>addDays(start,i));
 const current=dayKey(new Date()),selected=selectedDay;
 const grid='<div class="calendar-week">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="calendar-grid">'+cells.map(d=>{const key=dayKey(d),arr=dueItemsFor(key);return '<button class="day '+(d.getMonth()!==month?'other ':'')+(key===current?'current ':'')+(key===selected?'selected':'')+'" data-day="'+key+'"><span class="day-number">'+d.getDate()+'</span>'+arr.slice(0,2).map(x=>'<div class="cal-event '+(x.kind==='bill'?'warn':'')+'">'+safe(x.title)+'</div>').join('')+(arr.length>2?'<div class="tiny">+'+(arr.length-2)+' more</div>':'')+'</button>';}).join('')+'</div>';
 const dayItems=dueItemsFor(selected);
 return header('Calendar','All of your scheduled life events, in one chronological view.',newBtn('event','＋ New event'))+
 '<div class="grid-two"><section class="panel panel-pad"><div class="month-bar"><div><div class="eyebrow">YOUR SCHEDULE</div><h2>'+new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'}).format(first)+'</h2></div><div class="button-row"><button class="outline-btn" data-action="prev-month">‹</button><button class="outline-btn" data-action="today-month">Today</button><button class="outline-btn" data-action="next-month">›</button></div></div>'+grid+'</section>'+
 panel(dateLabel(selected,{weekday:'long',year:'numeric'}),dayItems.length?dayItems.map(row).join(''):empty('No plans on this day','Choose any day on the calendar or add an event.','event'),'<button class="minor" data-create="event">Add event ＋</button>')+'</div>';
}
function reminderPage(){
 const all=db.items.filter(x=>x.dueAt&&x.alert&&!doneOn(x)),scheduled=all.map(x=>({...x,next:nextOccurrence(x)})).filter(x=>x.next).sort((a,b)=>a.next-b.next);
 const itemsHtml=scheduled.map(x=>'<article class="feature-card"><div class="feature-card-head"><div class="feature-icon">♧</div><span class="tag purple">'+safe(x.repeat==='none'?'One-time':x.repeat||'One-time')+'</span></div><h3>'+safe(buildNotification(x).title)+'</h3><p>'+safe(buildNotification(x).body)+'</p><div class="feature-bottom"><span class="pill">'+dateLabel(x.next)+' · '+timeLabel(x.next)+'</span><button class="entry-action" data-edit="'+safe(x.id)+'">›</button></div></article>').join('');
 return header('Reminders','A useful notification should tell you what, when and why—not just beep.',newBtn('reminder','＋ New reminder'))+
 '<div class="metrics">'+metric('♧',scheduled.length,'Scheduled prompts')+metric('↻',scheduled.filter(x=>isRepeat(x)).length,'Recurring')+metric('◷',scheduled.filter(x=>(+x.leadMinutes||0)>0).length,'Advance alerts')+metric(pushEnabled?'✓':'○',pushEnabled?'On':'Off','Background push')+'</div>'+
 '<div class="status '+(pushEnabled?'good':'warn')+'" style="margin-bottom:17px">'+(pushEnabled?'Push is enabled on this device. Your scheduled reminders are synced to the notification server.':'Background push is not active yet. Open Settings → Notifications, install the app, and enable delivery even when LifeOS is closed.')+'</div>'+
 '<div class="list-tools">'+btn('Configure push notifications','go-notifications')+btn('Send a test notification','test-notification')+'</div>'+
 '<div class="card-list">'+(scheduled.length?itemsHtml:empty('No scheduled reminders','Create an alert here, or attach a notification to any task, workout, meal, bill, event or pet-care entry.','reminder'))+'</div>';
}
function insightsPage(){
 const today=new Date(),period=Array.from({length:7},(_,i)=>addDays(today,i-6));
 const completed=db.items.filter(x=>doneOn(x)).length,all=db.items.length;
 const bars=period.map(d=>{const k=dayKey(d),count=db.items.filter(x=>doneOn(x,k)&&happensOn(x,k)).length;return {day:new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(d),count};});
 const max=Math.max(1,...bars.map(x=>x.count));
 const pie=Object.entries(KIND).map(([k,v])=>({name:v.label,n:items(k).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,8);
 const hist=Array.from({length:7},(_,i)=>{const k=dayKey(addDays(today,i-6));return db.water[k]||0;});
 return header('Life insights','Understand what you have tracked, with no mysterious scores or fabricated results.')+
 '<div class="metrics">'+metric('▦',all,'Entries created')+metric('☑',completed,'Completed entries')+metric('↻',items('habit').length,'Daily routines')+metric('◌',hist.reduce((a,b)=>a+b,0),'Water servings, 7 days')+'</div>'+
 '<div class="grid-two"><div class="stack">'+panel('Completed responsibilities · 7 days','<div class="panel-pad"><div class="stat-bars">'+bars.map(x=>'<div class="stat-bar-wrap"><span class="tiny">'+x.count+'</span><div class="stat-bar" style="height:'+Math.max(3,(x.count/max*90))+'px"></div><small>'+x.day+'</small></div>').join('')+'</div></div>')+
 panel('Activity by category','<div class="panel-pad">'+(pie.length?pie.map(x=>'<div class="summary-line"><span>'+safe(x.name)+'</span><strong>'+x.n+'</strong></div>'+progress(x.n/all*100)).join(''):empty('No data yet','Start tracking life activities to see category breakdowns.'))+'</div>')+'</div>'+
 '<div class="stack">'+panel('Hydration · 7 days','<div class="panel-pad"><div class="stat-bars">'+hist.map((x,i)=>'<div class="stat-bar-wrap"><span class="tiny">'+x+'</span><div class="stat-bar" style="height:'+Math.max(3,x/Math.max(1,...hist)*90)+'px"></div><small>'+bars[i].day+'</small></div>').join('')+'</div></div>')+
 panel('A note about your data','<div class="panel-pad"><p class="fine">Charts reflect what you have manually logged in LifeOS. Missing entries are not treated as missed responsibilities. No health or financial conclusions are inferred from these numbers.</p></div>')+'</div></div>';
}
function settingsPage(){
 const s=db.settings,modules=Object.entries(META).filter(([k])=>!['today','settings'].includes(k));
 const configured=!!(config.configured&&config.publicKey);
 const status=pushEnabled?'Background push is connected to this device. LifeOS automatically syncs enabled reminders.':!configured?'The notification service needs its three VAPID settings added to Netlify before lock-screen push can work.':'The notification service is ready. Enable push from your device; on iPhone, open LifeOS from its Home Screen icon.';
 const moduleLines=modules.map(([k,v])=>'<label class="toggle-line"><div><strong>'+v.icon+' '+v.label+'</strong><p>'+safe(v.desc)+'</p></div><input class="toggle" type="checkbox" data-module="'+k+'" '+(!s.hidden.includes(k)?'checked':'')+'></label>').join('');
 return header('Settings','Your personal preferences, privacy controls and notification delivery.')+
 '<div class="settings-grid"><section class="panel panel-pad"><h2>Personalize LifeOS</h2><p class="fine" style="margin:7px 0 14px">Choose a display name, preferred color theme and personal targets.</p><div class="modal-grid"><div class="form-group"><label for="settingName">Display name</label><input id="settingName" class="field" maxlength="45" value="'+safe(s.name)+'" placeholder="Your name"></div><div class="form-group"><label for="settingTheme">Appearance</label><select id="settingTheme" class="field"><option value="dark" '+(s.theme==='dark'?'selected':'')+'>Midnight dark</option><option value="light" '+(s.theme==='light'?'selected':'')+'>Daylight light</option></select></div><div class="form-group"><label for="settingBudget">Monthly budget ($)</label><input id="settingBudget" class="field" type="number" min="0" step=".01" value="'+(s.budget||0)+'"></div><div class="form-group"><label for="settingWater">Water target (servings)</label><input id="settingWater" class="field" type="number" min="1" max="30" value="'+(s.dailyWater||8)+'"></div></div><div class="button-row">'+btn('Save preferences','save-settings')+'</div><div class="hr"></div><label class="toggle-line"><div><strong>Low-energy mode</strong><p>Offer a smaller, more forgiving daily focus.</p></div><input type="checkbox" class="toggle" data-setting="lowEnergy" '+(s.lowEnergy?'checked':'')+'></label></section>'+
 '<section class="panel panel-pad" id="notificationSettings"><h2>Detailed push notifications</h2><p class="fine" style="margin:7px 0 12px">Push alerts can appear on your phone even when LifeOS is closed. Times follow your device timezone; the server checks schedules approximately every minute, not at second-level precision.</p><div class="status '+(pushEnabled?'good':configured?'':'warn')+'">'+safe(status)+'</div><div class="detail-lines" style="margin:15px 0"><div><strong>Notification server:</strong> '+(configured?'Configured':'Needs configuration')+'</div><div><strong>This device:</strong> '+(pushEnabled?'Subscribed':'Not subscribed')+'</div><div><strong>Browser permission:</strong> '+safe('Notification' in window?Notification.permission:'Unsupported')+'</div><div><strong>Timezone:</strong> '+safe(Intl.DateTimeFormat().resolvedOptions().timeZone)+'</div></div>'+
 '<div class="button-row">'+btn(pushEnabled?'Refresh subscription':'Enable background push','enable-push','primary-btn')+btn('Send a test','test-notification')+btn('Sync schedules','sync-all')+'</div><div class="button-row">'+btn('Repair push setup','repair-push')+(pushEnabled?btn('Disable this device','disable-push','danger-btn'):'')+'</div><div class="hr"></div><h3>Notification preferences</h3><label class="toggle-line"><div><strong>Quiet hours</strong><p>Silence normal-priority alerts during your selected hours. Urgent alerts still come through. Suppressed alerts are not automatically replayed.</p></div><input type="checkbox" class="toggle" data-setting="quietEnabled" '+(s.quietEnabled?'checked':'')+'></label><div class="modal-grid" style="margin-top:12px"><div class="form-group"><label for="quietStart">Quiet from</label><input id="quietStart" type="time" class="field" value="'+safe(s.quietStart||'22:00')+'"></div><div class="form-group"><label for="quietEnd">Quiet until</label><input id="quietEnd" type="time" class="field" value="'+safe(s.quietEnd||'07:00')+'"></div></div><label class="toggle-line"><div><strong>Private lock-screen content</strong><p>Hide reminder titles and personal details from the notification preview; show only the category.</p></div><input type="checkbox" class="toggle" data-setting="privatePush" '+(s.privatePush?'checked':'')+'></label><div class="button-row">'+btn('Save notification preferences','save-notification-settings','primary-btn')+'</div><div class="hr"></div><p class="fine"><strong>On iPhone:</strong> Open your deployed LifeOS site in Safari → Share → Add to Home Screen → open the installed LifeOS icon → tap Enable background push. An ordinary Safari tab cannot receive iPhone Web Push.</p><p class="fine" style="margin-top:10px">Only opted-in reminder titles, schedules, brief notes, timezone and push subscription data are stored on the notification service. Your journal, notes, financial records and other LifeOS data stay local unless you include them in reminder details.</p></section>'+
 '<section class="panel panel-pad"><h2>Show or hide modules</h2><p class="fine" style="margin:7px 0 14px">Customize navigation. Hidden sections retain their entries.</p>'+moduleLines+'</section>'+
 '<section class="panel panel-pad"><h2>Your data & backups</h2><p class="fine" style="margin:7px 0 14px">Personal records are stored in this browser. Keep backups before changing phones, clearing browsing data, or resetting a device. Exported files may contain private information.</p><div class="button-row">'+btn('Export complete backup','export-data','primary-btn')+'<label class="outline-btn" style="display:inline-block;cursor:pointer">Import backup<input type="file" id="importFile" accept=".json,application/json" style="display:none"></label></div><div class="hr"></div><div class="danger-zone"><h3>Clear local data</h3><p class="fine" style="margin:5px 0 12px">Removing browser data cannot revoke a push subscription already saved on the server. Disable push first to stop its reminders.</p>'+btn('Erase local data','clear-data','danger-btn')+'</div></section></div>';
}
function render(){
 document.documentElement.dataset.theme=db.settings.theme||'dark';
 $('#sidebarNav').innerHTML=navHTML();
 $('#breadcrumb').textContent=META[currentPage]?.label||'Today';
 $('#todayLabel').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
 $('#avatarButton').textContent=(db.settings.name||'L').slice(0,1).toUpperCase();
 $('#bellDot').style.display=db.items.some(i=>i.alert&&i.dueAt&&!doneOn(i))?'block':'none';
 document.querySelectorAll('.mobile-tab[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===currentPage));
 let content=currentPage==='today'?today():currentPage==='calendar'?calendarPage():currentPage==='insights'?insightsPage():currentPage==='settings'?settingsPage():currentPage==='reminders'?reminderPage():sectionPage(currentPage);
 $('#view').innerHTML=content;
}
function optionField(name,label,type,defaultVal,val){
 const id='entry-'+name,v=val??'',opts=Array.isArray(defaultVal)?defaultVal:null;
 const ctrl=type==='select'?'<select class="field" id="'+id+'" name="'+name+'">'+(name==='priority'?defaultVal:defaultVal).map(x=>'<option value="'+safe(x)+'" '+(String(v)===String(x)?'selected':'')+'>'+safe(x)+'</option>').join('')+'</select>':type==='textarea'?'<textarea class="field" id="'+id+'" name="'+name+'" maxlength="4000" placeholder="'+safe(defaultVal||'')+'">'+safe(v)+'</textarea>':'<input class="field" id="'+id+'" name="'+name+'" '+(type==='number'?'min="0" step="any"':'')+' type="'+type+'" value="'+safe(v)+'" placeholder="'+safe(defaultVal||'')+'">';
 return '<div class="form-group '+(type==='textarea'?'full':'')+'"><label for="'+id+'">'+safe(label)+'</label>'+ctrl+'</div>';
}
function openEntry(kind,id){
 if(!KIND[kind])return;
 const old=db.items.find(x=>x.id===id),item=old||{kind,repeat:'none',priority:'Normal',alert:['reminder','event','bill','pet'].includes(kind),leadMinutes:0};
 const edit=!!old;
 let fields=optionField('title','What is it?','text','Give it a clear title',item.title||'')+
 optionField('dueAt',kind==='journal'?'Date & time':'Scheduled date & time','datetime-local','',item.dueAt||'')+
 KIND[kind].fields.map(x=>optionField(x[0],x[1],x[2],x[3],item[x[0]])).join('')+
 optionField('notes','Additional context / notes','textarea','Anything you want to remember...',item.notes||'');
 const generic='<div class="form-group"><label for="entry-repeat">Repeat</label><select class="field" id="entry-repeat" name="repeat">'+[['none','Does not repeat'],['daily','Every day'],['weekdays','Weekdays'],['weekly','Every week'],['monthly','Every month']].map(x=>'<option value="'+x[0]+'" '+((item.repeat||'none')===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
 '<div class="form-group"><label for="entry-lead">Notify before</label><select class="field" id="entry-lead" name="leadMinutes">'+[[0,'At scheduled time'],[5,'5 minutes before'],[10,'10 minutes before'],[15,'15 minutes before'],[30,'30 minutes before'],[60,'1 hour before'],[1440,'1 day before']].map(x=>'<option value="'+x[0]+'" '+((+item.leadMinutes||0)===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></div>'+
 '<div class="form-group full"><label class="toggle-line"><div><strong>Send a detailed reminder</strong><p>Include the item type, schedule and your instructions. Background push needs setup in Settings.</p></div><input type="checkbox" name="alert" class="toggle" '+(item.alert?'checked':'')+'></label></div>';
 const dialog=$('#entryDialog');
 $('#entryDialogContent').innerHTML='<div class="modal-top"><div><div class="eyebrow">'+(edit?'EDIT ENTRY':'NEW ENTRY')+'</div><h2>'+safe(KIND[kind].label)+'</h2></div><button type="button" class="icon-btn" data-close="entry">×</button></div><form id="entryForm"><div class="modal-content"><div class="modal-grid">'+fields+generic+'</div><p class="form-help" style="margin-top:15px">A date and time are needed to schedule a notification. Repeating alerts are timezone-aware on the server.</p></div><div class="modal-actions">'+(edit?'<button type="button" class="danger-btn" data-delete="'+safe(id)+'">Delete</button>':'')+'<button type="button" class="outline-btn" data-close="entry">Cancel</button><button class="primary-btn" type="submit">'+(edit?'Save changes':'Create entry')+'</button></div></form>';
 $('#entryForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),obj={...item,id:old?.id||uid(),kind,createdAt:old?.createdAt||Date.now(),updatedAt:Date.now()};for(const [k,v] of f.entries()){obj[k]=typeof v==='string'?v.trim():v;}obj.alert=f.has('alert');if(!obj.title){toast('Please enter a title.');return;}if(obj.title.length>140){toast('Use a shorter title.');return;}if(obj.alert&&!obj.dueAt){toast('Choose a date and time for a notification.');return;}if(obj.dueAt&&Number.isNaN(+new Date(obj.dueAt))){toast('Please enter a valid date and time.');return;}if(obj.alert&&!isRepeat(obj)&&new Date(obj.dueAt).getTime()<=Date.now()-60000){toast('Choose a future time for a one-time alert.');return;}if(old)db.items=db.items.map(x=>x.id===obj.id?obj:x);else db.items.unshift(obj);dialog.close();save();syncReminder(obj);toast(edit?'Entry updated.':'Entry added to LifeOS.');};
 dialog.showModal();
}
function quick(html){$('#quickDialogContent').innerHTML=html;$('#quickDialog').showModal();}
function quickAdd(){quick('<div class="modal-top"><div><div class="eyebrow">QUICK CAPTURE</div><h2>Add something to your life</h2></div><button class="icon-btn" data-close="quick">×</button></div><div class="modal-content"><div class="quick-grid">'+Object.entries(KIND).map(([k,v])=>'<button class="quick-item" data-create="'+k+'"><strong>'+v.icon+'</strong><span>'+safe(v.label)+'</span></button>').join('')+'</div></div>');}
function searchAll(){
 quick('<div class="modal-top"><div><div class="eyebrow">UNIVERSAL SEARCH</div><h2>Find anything</h2></div><button class="icon-btn" data-close="quick">×</button></div><div class="modal-content"><input class="field" autofocus id="globalSearch" placeholder="Search tasks, notes, events and more..."><div id="globalResults" style="margin-top:13px">'+empty('Start typing','Search matches titles, notes and other fields.')+'</div></div>');
 $('#globalSearch').focus();
 $('#globalSearch').oninput=e=>{const q=e.target.value.toLowerCase().trim();const matches=q?db.items.filter(x=>Object.entries(x).some(([k,v])=>typeof v==='string'&&v.toLowerCase().includes(q))).slice(0,35):[];$('#globalResults').innerHTML=matches.length?matches.map(row).join(''):empty(q?'No matching records':'Start typing','Searches all saved categories.');};
}
function action(name){
 const todayKey=dayKey(new Date());
 if(name==='energy'){db.settings.lowEnergy=!db.settings.lowEnergy;save();return;}
 if(name==='water+'||name==='water-'){db.water[todayKey]=Math.max(0,(db.water[todayKey]||0)+(name==='water+'?1:-1));save();return;}
 if(name==='prev-month'||name==='next-month'||name==='today-month'){if(name==='today-month')calendarCursor=new Date();else calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+(name==='next-month'?1:-1),1);render();return;}
 if(name==='focus'){const end=new Date(Date.now()+25*60000);openEntry('reminder');setTimeout(()=>{const due=$('#entry-dueAt'),title=$('#entry-title'),details=$('#entry-details');if(due&&title){due.value=localDateTime(end);title.value='Focus session finished';if(details)details.value='You have completed 25 minutes of focused work. Take a short break and choose what comes next.';}},50);return;}
 if(name==='go-notifications'){setPage('settings');requestAnimationFrame(()=>$('#notificationSettings')?.scrollIntoView({behavior:'smooth'}));return;}
 if(name==='save-settings'){db.settings.name=$('#settingName').value.trim().slice(0,45);db.settings.theme=$('#settingTheme').value;db.settings.budget=Math.max(0,+$('#settingBudget').value||0);db.settings.dailyWater=Math.min(30,Math.max(1,+$('#settingWater').value||8));save();toast('Preferences saved.');return;} if(name==='save-notification-settings'){db.settings.quietStart=$('#quietStart').value||'22:00';db.settings.quietEnd=$('#quietEnd').value||'07:00';save();syncAllReminders(true);toast('Notification preferences saved.');return;}
 if(name==='export-data'){const blob=new Blob([JSON.stringify({...db,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LifeOS-backup-'+dayKey(new Date())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Backup exported. Store it somewhere private.');return;}
 if(name==='clear-data'){if(!confirm('Erase all local LifeOS records on this device? Export a backup first. This cannot be undone.'))return;db=defaults();save();toast('Local records cleared.');return;}
 if(name==='enable-push'){if(pushEnabled)syncAllReminders();else enablePush();return;}
 if(name==='repair-push'){repairPush();return;}
 if(name==='disable-push'){disablePush();return;}
 if(name==='test-notification'){sendTestNotification();return;}
 if(name==='sync-all'){syncAllReminders();return;}
 
}
function notificationContext(item){
 const kind=item.kind, t=item.title, parts=[];
 if(kind==='workout'){parts.push('Workout plan');if(item.duration)parts.push(item.duration+' minutes');if(item.category)parts.push(item.category);}
 else if(kind==='meal'){parts.push((item.category||'Meal')+' scheduled');if(item.calories&&Number(item.calories)>0)parts.push(item.calories+' calories planned');}
 else if(kind==='bill'){parts.push('Payment reminder');if(item.amount)parts.push(money(item.amount));if(item.category)parts.push(item.category);}
 else if(kind==='pet'){parts.push('Pet care');if(item.petName)parts.push('For '+item.petName);if(item.category)parts.push(item.category);}
 else if(kind==='habit'){parts.push('Routine check-in');if(item.category)parts.push(item.category);}
 else if(kind==='event'){parts.push('Calendar event');if(item.location)parts.push(item.location);}
 else if(kind==='chore'){parts.push('Household task');if(item.category)parts.push(item.category);}
 else if(kind==='task'){parts.push('To-do');if(item.priority==='Urgent')parts.push('Urgent priority');}
 else if(kind==='reminder'){parts.push(item.category||'Personal reminder');}
 else parts.push(KIND[kind]?.label||'Reminder');
 return parts;
}
function buildNotification(item){
 const lead=+item.leadMinutes||0,occ=nextOccurrence(item);
 const title=(lead?'Coming up: ':'Time for: ')+item.title;
 const when=occ?'Scheduled '+dateLabel(occ,{weekday:'short'})+' at '+timeLabel(occ):'Scheduled reminder';
 const note=(item.details||item.notes||'').trim().replace(/\s+/g,' ').slice(0,230);
 const context=notificationContext(item).join(' · ');
 const body=when+' · '+context+(note?' · '+note:' · Open LifeOS to review or mark complete.');
 return {title:title.slice(0,130),body:body.slice(0,390)};
}
function checkForeground(){
 if(pushEnabled||!('Notification' in window)||Notification.permission!=='granted')return;
 for(const it of db.items){
  if(!it.alert||!it.dueAt||doneOn(it))continue;
  let t=nextOccurrence(it,new Date(Date.now()-86400000));if(!t)continue;
  const fire=t.getTime()-(+it.leadMinutes||0)*60000,diff=Date.now()-fire,id=it.id+'|'+fire;
  if(diff>=0&&diff<65000&&!db.fired[id]){db.fired[id]=Date.now();const n=buildNotification(it);navigator.serviceWorker?.ready.then(r=>r.showNotification(n.title,{body:n.body,icon:'/icon.svg',tag:'lifeos-'+it.id,data:{url:'/#reminders'}})).catch(()=>{});toast(n.title); }
 }
 const keys=Object.keys(db.fired);if(keys.length>200){db.fired=Object.fromEntries(keys.slice(-100).map(x=>[x,db.fired[x]]));}
 localStorage.setItem(STORE,JSON.stringify(db));
}
function getManageToken(){return localStorage.getItem('lifeos.pushToken')||'';}
function pushItems(){
 return db.items.filter(it=>it.alert&&it.dueAt&&(!doneOn(it)||isRepeat(it))).map(it=>{
  const when=new Date(it.dueAt);
  let kind={event:'appointment',chore:'home',reminder:'custom',checkin:'custom',journal:'custom',note:'custom',goal:'project'}[it.kind]||it.kind;
  if(it.kind==='reminder'){const cat=String(it.category||'').toLowerCase();if(cat==='medication')kind='medication';else if(cat==='workout')kind='workout';else if(cat==='meal')kind='meal';else if(cat==='pet care')kind='pet';else if(cat==='payment')kind='bill';}
  return {id:it.id,title:it.title,details:[notificationContext(it).join(' · '),it.details||it.notes||''].filter(Boolean).join(' · ').slice(0,180),date:dayKey(when),time:localDateTime(when).slice(11),repeat:it.repeat||'none',kind,lead:Number(it.leadMinutes)||0,priority:it.priority==='Urgent'?'high':it.priority==='High'?'high':'normal',enabled:true};
 }).filter(it=>it.date&&it.time);
}
async async function loadConfig(){
 try{const r=await fetch('/.netlify/functions/push',{cache:'no-store'});if(r.ok)config=await r.json();}catch(e){}
 render();
}
async function pushRequest(body){
 const r=await fetch('/.netlify/functions/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 let d={};try{d=await r.json();}catch(e){}
 if(!r.ok)throw Error(d.error||'Notification server returned '+r.status);
 return d;
}
function urlBase64ToUint8Array(s){const pad='='.repeat((4-s.length%4)%4);const raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0));}
async function getPushSub(){const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription();}
function pushPayload(action,sub){return {action,subscription:sub.toJSON(),manageToken:getManageToken(),reminders:pushItems(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,quiet:{enabled:!!db.settings.quietEnabled,start:db.settings.quietStart||'22:00',end:db.settings.quietEnd||'07:00'},privateMode:!!db.settings.privatePush};}
async function enablePush(){
 try{
  if(!config.configured||!config.publicKey)throw Error('Push server is not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in Netlify.');
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('Web Push is not available here. On iPhone, add the website to your Home Screen first.');
  if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!window.matchMedia('(display-mode: standalone)').matches&&!navigator.standalone)throw Error('On iPhone, open LifeOS from its installed Home Screen icon to enable push notifications.');
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error('Notification permission was denied. Review browser or device notification settings.');
  const reg=await navigator.serviceWorker.ready;
  const subscription=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(config.publicKey)});
  const d=await pushRequest(pushPayload('subscribe',subscription));
  localStorage.setItem('lifeos.pushToken',d.manageToken);pushEnabled=true;render();toast('Push is active. '+d.reminderCount+' detailed reminders synced.');
 }catch(e){toast(String(e.message||e));}
}
async function disablePush(){
 try{
  const sub=await getPushSub();
  if(sub){await pushRequest(pushPayload('unsubscribe',sub));await sub.unsubscribe();}
  localStorage.removeItem('lifeos.pushToken');pushEnabled=false;render();toast('Push subscription and cloud schedules removed for this device.');
 }catch(e){toast('Could not disable push: '+String(e.message||e));}
}
async function repairPush(){
 if(!confirm('Repair this device? Its old push subscription will be removed locally. This may leave an inaccessible old server subscription if its management token was lost.'))return;
 try{
  const sub=await getPushSub();
  if(sub&&getManageToken()){try{await pushRequest(pushPayload('unsubscribe',sub));}catch(e){}}
  if(sub)await sub.unsubscribe();
  localStorage.removeItem('lifeos.pushToken');pushEnabled=false;
  await enablePush();
 }catch(e){toast('Repair failed: '+String(e.message||e));}
}
let syncTimer;
function syncReminder(){if(!pushEnabled)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAllReminders(true),450);}
async function syncAllReminders(silent=false){
 if(!pushEnabled){if(!silent)toast('Enable background push first.');return;}
 try{
  const sub=await getPushSub();
  if(!sub)throw Error('Browser subscription missing. Use Repair push setup.');
  const d=await pushRequest(pushPayload('sync',sub));
  if(d.manageToken)localStorage.setItem('lifeos.pushToken',d.manageToken);
  if(!silent)toast('Synced '+d.reminderCount+' enabled schedules to this device.');
 }catch(e){toast('Schedule sync failed: '+String(e.message||e));}
}
async function sendTestNotification(){
 try{
  if(pushEnabled){
   const sub=await getPushSub();if(!sub)throw Error('Missing device subscription.');
   await pushRequest(pushPayload('test',sub));toast('Test push accepted by the provider. Check your lock screen.');return;
  }
  if(!('Notification' in window))throw Error('This browser does not support notifications.');
  const p=await Notification.requestPermission();if(p!=='granted')throw Error('Notification permission denied.');
  const reg=await navigator.serviceWorker.ready;
  await reg.showNotification('LifeOS · Local notification test',{body:'Notifications can appear while LifeOS is available. Enable background push for scheduled alerts even when it is closed.',icon:'/icon.svg',tag:'lifeos-test'});
  toast('Local test sent. This does not test background delivery.');
 }catch(e){toast(String(e.message||e));}
}
async function checkPushStatus(){
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!config.configured)return;
 try{
  const sub=await getPushSub();
  if(!sub||!getManageToken()){pushEnabled=false;render();return;}
  const d=await pushRequest(pushPayload('status',sub));
  pushEnabled=Boolean(d.enrolled);render();
 }catch(e){pushEnabled=false;render();}
}
function del(id){const obj=db.items.find(x=>x.id===id);if(!obj||!confirm('Delete "'+obj.title+'"? This cannot be undone.'))return;db.items=db.items.filter(x=>x.id!==id);$('#entryDialog').close();save();if(obj.alert)syncReminder({...obj,alert:false});toast('Entry deleted.');}
document.addEventListener('click',e=>{
 const node=e.target.closest('[data-nav],[data-create],[data-edit],[data-action],[data-close],[data-delete],[data-day],[data-filter]');
 if(!node)return;
 if(node.dataset.nav){setPage(node.dataset.nav);return;}
 if(node.dataset.create){$('#quickDialog').close();openEntry(node.dataset.create);return;}
 if(node.dataset.edit){$('#quickDialog').close();const o=db.items.find(x=>x.id===node.dataset.edit);if(o)openEntry(o.kind,o.id);return;}
 if(node.dataset.action){action(node.dataset.action);return;}
 if(node.dataset.close){$('#'+node.dataset.close+'Dialog').close();return;}
 if(node.dataset.delete){del(node.dataset.delete);return;}
 if(node.dataset.day){selectedDay=node.dataset.day;render();return;}
 if(node.dataset.filter){filter=node.dataset.filter;render();return;}
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.dataset.complete){const o=db.items.find(x=>x.id===el.dataset.complete);if(o)completion(o);}
 if(el.dataset.module){const s=new Set(db.settings.hidden||[]);el.checked?s.delete(el.dataset.module):s.add(el.dataset.module);db.settings.hidden=[...s];save();}
 if(el.dataset.setting==='lowEnergy'){db.settings.lowEnergy=el.checked;save();} if(el.dataset.setting==='quietEnabled'||el.dataset.setting==='privatePush'){db.settings[el.dataset.setting]=el.checked;save();syncAllReminders(true);}
 if(el.id==='importFile'&&el.files?.[0]){
  const file=el.files[0];if(file.size>5e6){toast('Backup is too large to import.');return;}
  file.text().then(t=>{let parsed;try{parsed=JSON.parse(t);}catch(e){toast('This is not valid JSON.');return;}if(!parsed||!Array.isArray(parsed.items)||!parsed.settings){toast('This is not a LifeOS backup.');return;}if(!confirm('Replace local LifeOS data with the contents of this backup?'))return;db={...defaults(),...parsed,settings:{...defaults().settings,...parsed.settings},items:parsed.items.filter(x=>x&&typeof x.id==='string'&&typeof x.kind==='string'&&KIND[x.kind])};save();toast('Backup imported. Re-sync push reminders in Settings.');}).catch(()=>toast('Cannot read backup file.'));
 }
});
document.addEventListener('input',e=>{if(e.target.id==='listSearch'){const val=e.target.value,focus=e.target.selectionStart;keyword=val;render();const el=$('#listSearch');el?.focus();el?.setSelectionRange(focus,focus);}});
document.addEventListener('submit',e=>{
 
});
$('#menuButton').onclick=()=>{$('#sidebar').classList.add('open');$('#shade').classList.add('show');};
$('#shade').onclick=()=>{$('#sidebar').classList.remove('open');$('#shade').classList.remove('show');};
$('#newButton').onclick=quickAdd;
$('#mobileAdd').onclick=quickAdd;
$('#mobileMore').onclick=()=>{$('#sidebar').classList.add('open');$('#shade').classList.add('show');};
$('#searchButton').onclick=searchAll;
$('#bellButton').onclick=()=>setPage('reminders');
$('#avatarButton').onclick=()=>setPage('settings');
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchAll();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='n'){e.preventDefault();quickAdd();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForeground();});
window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(META[page])setPage(page);});
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.warn));}
currentPage=META[location.hash.slice(1)]?location.hash.slice(1):'today';
render();loadConfig().then(checkPushStatus);checkForeground();setInterval(checkForeground,30000);
