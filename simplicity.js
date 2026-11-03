/* LifeOS progressive experience: simple by default, depth on demand. */
(() => {
  'use strict';
  const logic=window.LifeOSModes;
  if (!logic || typeof db==='undefined') { console.error('LifeOS modes could not initialize.'); return; }
  const TITLES={
    fitness:'Fitness',food:'Food & water',money:'Finances',home:'Home & chores',
    pets:'Pets',wellness:'Wellness',routines:'Routines',projects:'Projects',
    goals:'Goals',vault:'Notes',journal:'Journal'
  };
  const ICONS={task:'☑',reminder:'♧',meal:'◌',workout:'↗',pet:'♧',bill:'＄',chore:'⌑',note:'◇',event:'▦',habit:'↻'};
  const titlePlaceholders={
    task:'What needs doing?',reminder:'What should LifeOS remind you about?',
    meal:'What did you eat?',workout:'What workout did you complete?',
    bill:'What payment needs attention?',pet:'What does your pet need?',
    chore:'What household task?',note:'What do you want to remember?',
    event:'What is the event?',habit:'Which routine?'
  };
  const logged=new Set(['meal','workout','note']);
  const starterRules=[
    {id:'hydration',trigger:'workout',title:'Drink water after your workout',delay:10,explain:'A hydration reminder 10 minutes after you finish a workout.'},
    {id:'post-meal',trigger:'meal',title:'Take a short walk or stretch',delay:20,explain:'A gentle follow-up 20 minutes after logging a meal.'},
    {id:'pet-water',trigger:'pet',title:'Check the pet water bowls',delay:60,explain:'A follow-up an hour after completing pet care.'}
  ];
  let showCustomAutomation=false;
  const dataSettings=db.settings;
  if(!dataSettings.mode)dataSettings.mode='simple';
  if(!Array.isArray(dataSettings.focusModules))dataSettings.focusModules=['fitness','food','money'];
  if(db.items.length && dataSettings.onboarded===undefined)dataSettings.onboarded=true;
  META.explore={label:'All modules',icon:'▦',group:'CORE',desc:'Find every LifeOS tool when you want it.'};
  const currentMode=()=>logic.mode(db.settings.mode);
  const focus=()=>logic.interests(db.settings.focusModules);
  const allPageKeys=()=>Object.keys(META).filter(k=>k!=='settings');
  const saveChoices=()=>save();
  const menuNav=navHTML;
  navHTML=function(){
    const level=currentMode(),show=logic.visible(level,focus(),db.settings.hidden,allPageKeys());
    const sections=level==='advanced'?
       [['YOUR DAY',show.filter(k=>META[k].group==='CORE')],['EVERYDAY',show.filter(k=>META[k].group==='EVERYDAY')],['BUILD & GROW',show.filter(k=>META[k].group==='BUILD & GROW')],['TOOLS',show.filter(k=>META[k].group==='TOOLS')]]:
       [['YOUR DAY',show.filter(k=>['today','planner','dayplan','calendar','reminders','capture','insights','explore'].includes(k))],['YOUR AREAS',show.filter(k=>!['today','planner','dayplan','calendar','reminders','capture','insights','explore'].includes(k))]];
    return sections.filter(x=>x[1].length).map(([label,keys])=>
      '<div class="nav-group-title">'+label+'</div>'+keys.map(k=>
        '<button class="side-link '+(currentPage===k?'active':'')+'" data-nav="'+k+'"><span class="nav-icon">'+META[k].icon+'</span><span>'+safe(META[k].label)+'</span></button>'
      ).join('')
    ).join('');
  };
  const baseRender=render;
  render=function(){
    document.body.dataset.lifeMode=currentMode();
    if(currentPage==='explore'){
      document.documentElement.dataset.theme=db.settings.theme||'dark';
      $('#sidebarNav').innerHTML=navHTML();
      $('#breadcrumb').textContent='All modules';
      $('#todayLabel').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
      $('#avatarButton').textContent=(db.settings.name||'L').slice(0,1).toUpperCase();
      $('#bellDot').style.display=db.items.some(x=>x.alert&&x.dueAt&&!doneOn(x))?'block':'none';
      document.querySelectorAll('.mobile-tab[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===currentPage));
      $('#view').innerHTML=explorePage();
      return;
    }
    baseRender();
    if(currentMode()==='simple'){if(currentPage==='today')$('#view').innerHTML=simpleToday();else if(currentPage==='planner')$('#view').innerHTML=simplePlanner();else if(currentPage==='reminders')$('#view').innerHTML=simpleReminders();}
    if(currentPage==='settings'&&currentMode()==='simple'){
      const oldSection=[...document.querySelectorAll('#view section')].find(x=>x.querySelector('h2')?.textContent==='Show or hide modules');
      if(oldSection)oldSection.hidden=true;
    }
  };
  const originalAutomationPage=lifeAutomationPage;
  lifeAutomationPage=function(){
    if(currentMode()==='advanced'||showCustomAutomation)return originalAutomationPage();
    const rules=db.automations||[];
    const templates=starterRules.map(r=>{
      const already=rules.some(x=>x.trigger===r.trigger&&x.title===r.title&&x.delay===r.delay);
      return '<div class="simple-rule-template"><div><strong>'+safe(r.title)+'</strong><p>'+safe(r.explain)+'</p></div>'+
        '<button class="outline-btn" data-life-template="'+r.id+'" '+(already?'disabled':'')+'>'+(already?'Added':'Use template')+'</button></div>';
    }).join('');
    const saved=rules.length?rules.map(r=>
      '<div class="simple-reminder-row"><span class="simple-reminder-symbol">⚡</span><span class="simple-reminder-text"><strong>'+safe(r.title)+'</strong>'+
      '<small>After '+safe(KIND[r.trigger]?.label||r.trigger)+' · '+r.delay+' minutes</small></span>'+
      '<button class="ghost-btn" data-action="life-rule-remove:'+safe(r.id)+'">Remove</button></div>'
    ).join(''):'<p class="simple-list-placeholder">No automations enabled.</p>';
    return header('Easy automations','Useful follow-ups without complicated setup.')+
      '<div class="simple-content-grid"><section class="panel panel-pad"><h2>Ready-made rules</h2><p class="fine" style="margin:7px 0 12px">Choose only the suggestions you want. Nothing is enabled automatically.</p>'+
      templates+'</section><section class="panel"><div class="panel-head"><h2>Your automations</h2>'+
      '<button class="minor" data-life-custom-rules>Build a custom rule</button></div>'+saved+'</section></div>'+
      '<p class="fine" style="margin-top:15px">Automations run when you complete an item inside LifeOS. Their follow-up reminders can be synced for background push delivery.</p>';
  };
  const baseSettings=settingsPage;
  settingsPage=function(){
    const html=baseSettings(),at=html.indexOf('<div class="settings-grid">');
    return at<0?html:html.slice(0,at)+modeSettingsPanel()+html.slice(at);
  };
  function modeSettingsPanel(){
    return '<section class="panel panel-pad experience-settings"><div class="experience-settings-head"><div><div class="eyebrow">YOUR EXPERIENCE</div><h2>Keep LifeOS as simple as you want</h2><p class="fine" style="margin-top:7px">Switch modes any time. Your information, reminders, and automations stay intact.</p></div></div>'+
      '<div class="life-mode-grid">'+['simple','standard','advanced'].map(m=>modeTile(m)).join('')+'</div>'+
      '<h3 class="simple-subtitle">Your quick-access areas</h3><p class="fine">Choose what belongs in your navigation. Everything else is still available under All modules.</p>'+
      '<div class="simple-interest-list">'+logic.FOCUS.map(k=>
        '<label class="simple-interest"><input type="checkbox" data-life-focus="'+k+'" '+(focus().includes(k)?'checked':'')+'><span>'+TITLES[k]+'</span></label>').join('')+'</div>'+
      '<div class="simple-secondary-row"><span class="fine">Simple Mode shows up to 3 chosen areas. Standard shows all selected areas.</span><button type="button" class="outline-btn" data-life-setup>Run setup again</button></div></section>';
  }
  function modeTile(m, onboarding=false){
    const desc={simple:'Only what you need day to day.',standard:'More tools, still organized.',advanced:'Every section and full controls.'};
    return '<button type="button" class="life-mode-choice '+(m===(onboarding?onboardingMode:currentMode())?'selected':'')+'" '+(onboarding?'data-life-onboard-mode':'data-life-mode')+'="'+m+'" aria-pressed="'+(m===(onboarding?onboardingMode:currentMode()))+'"><strong>'+m[0].toUpperCase()+m.slice(1)+'</strong><span>'+desc[m]+'</span></button>';
  }
  function explorePage(){
    const areas=[['Daily life',['today','planner','dayplan','calendar','reminders','capture','routines']],
      ['Personal care',['fitness','food','wellness','pets']],
      ['Responsibilities',['money','home','projects','goals']],
      ['Your space',['vault','journal','insights','automations']]];
    return header('All LifeOS modules','Every feature is here when you need it. No need to change modes just to open one.')+
      '<div class="simple-explore-grid">'+areas.map(([label,keys])=>
        '<section class="panel panel-pad simple-explore-section"><h2>'+label+'</h2><div class="simple-explore-links">'+keys.filter(k=>META[k]).map(k=>
         '<button type="button" data-nav="'+k+'" class="simple-explore-link"><span class="simple-explore-icon">'+META[k].icon+'</span><span><strong>'+safe(META[k].label)+'</strong><small>'+safe(META[k].desc)+'</small></span><b>›</b></button>'
        ).join('')+'</div></section>'
      ).join('')+'</div>'+
      '<div class="simple-explore-footer"><p class="fine">Want more controls visible all the time?</p><button class="outline-btn" data-nav="settings">Change display mode</button></div>';
  }
  function simplePlanner(){
    const today=dayKey(new Date()),types=new Set(['task','habit','chore']);
    const pending=db.items.filter(x=>types.has(x.kind)&&!doneOn(x));
    const due=pending.filter(x=>x.dueAt&&dayKey(new Date(x.dueAt))<=today).sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt));
    const later=pending.filter(x=>x.dueAt&&dayKey(new Date(x.dueAt))>today).sort((a,b)=>new Date(a.dueAt)-new Date(b.dueAt));
    const unscheduled=pending.filter(x=>!x.dueAt);
    const section=(name,arr,buttonText,kind)=>'<section class="panel"><div class="panel-head"><h2>'+name+'</h2>'+
      (buttonText?'<button class="minor" data-life-mini="'+kind+'">'+buttonText+'</button>':'')+'</div>'+
      (arr.length?arr.slice(0,20).map(compactItem).join(''):'<p class="simple-list-placeholder">Nothing here.</p>')+'</section>';
    return header('Your tasks','Everything you need to do, without project-management overhead.',
      '<button class="primary-btn" data-life-mini="task">＋ Add task</button>')+
      '<div class="simple-plan-layout"><div class="stack">'+section('Due or overdue',due,'Add','task')+
      section('Coming up',later,'','task')+'</div><div class="stack">'+
      section('Whenever you have time',unscheduled,'Add task','task')+
      '<section class="panel panel-pad"><h2>Need a realistic schedule?</h2><p class="fine" style="margin:8px 0 15px">LifeOS can suggest what fits your day based on available time and energy.</p>'+
      '<button class="outline-btn" data-nav="dayplan">✦ Build my day</button></section></div></div>';
  }
  function simpleReminders(){
    const active=db.items.filter(x=>x.alert&&x.dueAt&&(!doneOn(x)||x.repeat&&x.repeat!=='none'))
      .map(x=>({item:x,next:nextOccurrence(x)})).filter(x=>x.next instanceof Date&&!Number.isNaN(+x.next))
      .sort((a,b)=>a.next-b.next);
    const rows=active.map(({item,next})=>
      '<button class="simple-reminder-row" data-edit="'+safe(item.id)+'"><span class="simple-reminder-symbol">♧</span>'+
      '<span class="simple-reminder-text"><strong>'+safe(item.title)+'</strong><small>'+
      safe(dateLabel(next))+' · '+safe(timeLabel(next))+
      (item.repeat&&item.repeat!=='none'?' · '+safe(item.repeat):'')+
      '</small></span><span class="simple-chevron">›</span></button>').join('');
    const status=pushEnabled?
      'Background push is connected to this device. Changes are synced to your notification schedule.':
      'To receive alerts when LifeOS is closed, enable background notifications in Settings.';
    return header('Reminders','What to remember, when to remember it, and nothing else to configure unless you want to.',
      '<button class="primary-btn" data-life-mini="reminder">＋ New reminder</button>')+
      '<div class="simple-reminder-status"><span class="'+(pushEnabled?'connected':'not-connected')+'"></span><p>'+status+'</p>'+
      '<button class="outline-btn" data-nav="settings">Settings</button></div>'+
      '<section class="panel"><div class="panel-head"><h2>Scheduled reminders</h2><span class="tiny">'+active.length+' active</span></div>'+
      (rows||'<div class="simple-empty compact"><p>No scheduled reminders. Add one above.</p></div>')+'</section>';
  }
  function simpleToday(){
    const date=dayKey(new Date()), hour=new Date().getHours(),greet=hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';
    const dateText=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date());
    const due=dueItemsFor(date);
    const incomplete=due.filter(x=>!doneOn(x,date)).sort((a,b)=>(a.priority==='Urgent'?-1:0)-(b.priority==='Urgent'?-1:0));
    const upcoming=db.items.filter(x=>x.dueAt&&!doneOn(x)&&nextOccurrence(x)).sort((a,b)=>nextOccurrence(a)-nextOccurrence(b));
    const water=db.water[date]||0,waterTarget=db.settings.dailyWater||8,completed=due.filter(x=>doneOn(x,date)).length;
    const priorities=incomplete.length?incomplete.slice(0,5).map(x=>compactItem(x)).join(''):
      '<div class="simple-empty"><span>✓</span><strong>You’re caught up for now.</strong><p>Add something you want to accomplish today.</p><button class="outline-btn" data-life-mini="task">Add a task</button></div>';
    const next=upcoming.length?upcoming.slice(0,4).map(x=>
      '<button class="simple-upcoming-item" data-edit="'+safe(x.id)+'"><span class="simple-upcoming-icon">'+safe(KIND[x.kind]?.icon||'◌')+'</span><span><strong>'+safe(x.title)+'</strong><small>'+safe(timeLabel(nextOccurrence(x)))+' · '+safe(dateLabel(nextOccurrence(x)))+'</small></span><span class="simple-chevron">›</span></button>'
     ).join(''):'<div class="simple-empty compact"><p>Nothing scheduled next.</p></div>';
    const focusLinks=logic.selectedExtras(focus(),'simple').filter(k=>META[k]).map(k=>
      '<button class="simple-focus-link" data-nav="'+k+'"><span>'+META[k].icon+'</span>'+safe(META[k].label)+'</button>').join('');
    return '<section class="simple-today-hero"><div class="eyebrow">'+safe(dateText).toUpperCase()+'</div><h1>'+greet+(db.settings.name?', '+safe(db.settings.name):'')+'.</h1><p>'+ (db.settings.lowEnergy?'Essentials first. Keep today manageable.':'Here is what matters today. You can handle the rest when you need it.')+'</p><div class="simple-hero-actions">'+
      '<button class="primary-btn" data-life-mini="task">＋ Add task</button><button class="outline-btn" data-nav="dayplan">✦ Plan my day</button><button class="ghost-btn" data-nav="capture">Quick capture</button></div></section>'+
      '<div class="simple-stats"><div class="simple-stat"><span>Today’s tasks</span><strong>'+completed+' / '+due.length+'</strong></div><div class="simple-stat"><span>Still to do</span><strong>'+incomplete.length+'</strong></div><div class="simple-stat"><span>Water</span><strong>'+water+' / '+waterTarget+'</strong></div></div>'+
      '<div class="simple-content-grid"><section class="panel"><div class="panel-head"><h2>Your next priorities</h2><button class="minor" data-nav="planner">View all</button></div>'+priorities+'</section>'+
      '<section class="panel panel-pad"><h2>Quick log</h2><p class="fine" style="margin-top:6px">Everyday things should take seconds.</p><div class="simple-quick-grid">'+
      '<button data-life-water><span>◌</span><strong>Water +1</strong></button>'+
      '<button data-life-mini="meal"><span>◈</span><strong>Meal</strong></button>'+
      '<button data-life-mini="workout"><span>↗</span><strong>Workout</strong></button>'+
      '<button data-life-mini="reminder"><span>♧</span><strong>Reminder</strong></button></div>'+
      '<div class="simple-next"><div class="simple-inline-heading"><h3>Coming up</h3><button class="minor" data-nav="calendar">Calendar</button></div>'+next+'</div></section></div>'+
      '<div class="simple-focus-row">'+(focusLinks||'<span class="fine">Choose your favorite areas in Settings.</span>')+
      '<button class="simple-focus-link explore" data-nav="explore"><span>▦</span>All modules</button></div>';
  }
  function compactItem(item){
    const dueDate=nextOccurrence(item),recurring=Boolean(item.repeat&&item.repeat!=='none');
    return '<div class="simple-item"><input class="tick" type="checkbox" data-complete="'+safe(item.id)+'" aria-label="Complete '+safe(item.title)+'" '+(doneOn(item)?'checked':'')+'>'+
      '<button class="simple-item-copy" data-edit="'+safe(item.id)+'"><strong>'+safe(item.title)+'</strong><span>'+
      safe(KIND[item.kind]?.label||'Task')+(dueDate?' · '+safe(timeLabel(dueDate)):'')+(recurring?' · Repeats':'')+'</span></button>'+
      '<button class="entry-action" data-edit="'+safe(item.id)+'" aria-label="Edit '+safe(item.title)+'">›</button></div>';
  }
  function openQuickPicker(){
    const shown=['task','reminder','meal','workout','pet','bill','chore','note'];
    $('#quickDialogContent').innerHTML='<div class="modal-top"><div><div class="eyebrow">QUICK ADD</div><h2>What would you like to add?</h2></div><button class="icon-btn" type="button" data-life-close="quick">×</button></div>'+
      '<div class="modal-content"><div class="simple-picker-grid">'+shown.map(k=>
      '<button class="simple-picker-item" data-life-mini="'+k+'"><span>'+ICONS[k]+'</span><strong>'+safe(KIND[k].label)+'</strong></button>').join('')+
      '</div><div class="simple-secondary-row"><button class="ghost-btn" data-life-more-types>More entry types</button><button class="ghost-btn" data-nav="capture">Write a sentence instead</button></div></div>';
    $('#quickDialog').showModal();
  }
  function nextReminderTime(){
    const d=new Date(Date.now()+45*60000);
    d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);
    return localDateTime(d);
  }
  function openMini(kind,initial={}){
    if(!KIND[kind])return;
    if($('#quickDialog').open)$('#quickDialog').close();
    const itemLabel=KIND[kind].label,forLog=logged.has(kind),when=initial.dueAt??(forLog||['task','habit','chore','pet'].includes(kind)?localDateTime(new Date()):kind==='reminder'?nextReminderTime():'');
    const repeat=initial.repeat||'none';
    const showRepeat=['reminder','task','habit','pet','bill','chore','workout','meal'].includes(kind);
    const defaultAlert=kind==='reminder'||kind==='event';
    const name=initial.title||'';
    let html='<div class="modal-top"><div><div class="eyebrow">QUICK ENTRY</div><h2>'+safe(itemLabel)+'</h2></div><button class="icon-btn" type="button" data-life-close="mini">×</button></div>'+
      '<form id="lifeMiniForm"><div class="modal-content life-mini-form"><label for="lifeMiniTitle">What '+(kind==='meal'?'did you eat?':kind==='workout'?'did you do?':'needs to be remembered?')+'</label>'+
      '<input class="field" id="lifeMiniTitle" required maxlength="150" value="'+safe(name)+'" placeholder="'+safe(titlePlaceholders[kind]||'Add a description')+'">'+
      '<label for="lifeMiniWhen">'+(forLog?'When did it happen?':'When? (optional unless sending an alert)')+'</label><input class="field" id="lifeMiniWhen" type="datetime-local" value="'+safe(when)+'">'+
      (showRepeat?'<label for="lifeMiniRepeat">Repeat</label><select id="lifeMiniRepeat" class="field">'+[['none','Just once'],['daily','Every day'],['weekdays','Weekdays'],['weekly','Every week'],['monthly','Every month']].map(([k,label])=>'<option value="'+k+'" '+(k===repeat?'selected':'')+'>'+label+'</option>').join('')+'</select>':'')+
      '<label class="simple-toggle"><input type="checkbox" id="lifeMiniAlert" '+(initial.alert??defaultAlert?'checked':'')+'><span>Send a notification</span></label>'+
      '<div class="fine">You can add notes, priority, calories, costs and other details later.</div></div>'+
      '<div class="modal-actions"><button type="button" class="ghost-btn" data-life-expand="'+kind+'">More options</button><button type="submit" class="primary-btn">Save '+(forLog?'log':'entry')+'</button></div></form>';
    let dlg=$('#lifeMiniDialog');if(!dlg){dlg=document.createElement('dialog');dlg.className='dialog life-mini-dialog';dlg.id='lifeMiniDialog';document.body.append(dlg);}
    dlg.innerHTML=html;dlg.showModal();$('#lifeMiniTitle').focus();
    const form=$('#lifeMiniForm');
    form.addEventListener('submit',ev=>{
      ev.preventDefault();
      const title=$('#lifeMiniTitle').value.trim(),dueAt=$('#lifeMiniWhen').value,alert=$('#lifeMiniAlert').checked;
      if(!title){toast('Add a short description first.');return;}
      if(alert&&!dueAt){toast('Choose a date and time for the notification.');$('#lifeMiniWhen').focus();return;}
      const item={
        id:uid(),kind,title,dueAt:dueAt||'',repeat:$('#lifeMiniRepeat')?.value||'none',
        notes:initial.notes||'',details:'',alert,leadMinutes:0,priority:'Normal',
        done:forLog&&!alert&&(!dueAt||new Date(dueAt)<=new Date()),createdAt:Date.now(),updatedAt:Date.now()
      };
      db.items.push(item);dlg.close();save();if(item.done)lifeRunRules(item);if(alert||pushEnabled)syncReminder(item);
      toast((forLog?'Logged ':'Saved ')+title+(alert?'. Notification scheduled if push is enabled.':'.'));
    });
  }
  function expandMini(kind){
    const draft={title:$('#lifeMiniTitle')?.value||'',dueAt:$('#lifeMiniWhen')?.value||'',repeat:$('#lifeMiniRepeat')?.value||'none',alert:!!$('#lifeMiniAlert')?.checked};
    $('#lifeMiniDialog')?.close();openEntry(kind);
    const a=$('#entry-title'),b=$('#entry-dueAt'),c=$('#entry-repeat'),d=$('#entryForm [name="alert"]');
    if(a)a.value=draft.title;if(b)b.value=draft.dueAt;if(c)c.value=draft.repeat;if(d)d.checked=draft.alert;
  }
  let onboardingMode=currentMode();
  let onboardingFocus=focus();
  function welcomeMarkup(){
    return '<div class="simple-welcome-inner"><div class="simple-welcome-top"><div class="simple-welcome-mark">✳</div><div><div class="eyebrow">WELCOME TO LIFEOS</div><h2>One place for what matters.</h2><p>Choose how much you want to see. You can change everything later.</p></div></div>'+
      '<h3>How would you like LifeOS to feel?</h3><div class="life-mode-grid onboarding">'+['simple','standard','advanced'].map(m=>modeTile(m,true)).join('')+'</div>'+
      '<h3>Which areas matter most to you?</h3><p class="fine">Choose a few to put near the top. Nothing else disappears.</p>'+
      '<div class="simple-interest-list onboarding">'+logic.FOCUS.map(k=>
      '<label class="simple-interest"><input type="checkbox" data-life-onboard-focus="'+k+'" '+(onboardingFocus.includes(k)?'checked':'')+'><span>'+TITLES[k]+'</span></label>').join('')+'</div>'+
      '<div class="simple-welcome-footer"><button class="ghost-btn" data-life-skip>Skip setup</button><button class="primary-btn" data-life-finish>Start LifeOS</button></div></div>';
  }
  function openOnboarding(){
    onboardingMode=currentMode();onboardingFocus=focus();
    let dlg=$('#lifeWelcomeDialog');
    if(!dlg){dlg=document.createElement('dialog');dlg.className='simple-welcome-dialog';dlg.id='lifeWelcomeDialog';document.body.append(dlg);}
    dlg.innerHTML=welcomeMarkup();if(!dlg.open)dlg.showModal();
  }
  function closeOnboarding(skip){
    if(!skip){db.settings.mode=logic.mode(onboardingMode);db.settings.focusModules=logic.interests(onboardingFocus);}
    db.settings.onboarded=true;$('#lifeWelcomeDialog')?.close();saveChoices();
    if(!skip)toast('LifeOS is ready. You can change your setup in Settings.');
  }
  const oldCaptureReview=reviewLifeCapture;
  reviewLifeCapture=function(){
    if(currentMode()!=='simple')return oldCaptureReview();
    const text=$('#lifeSentence')?.value.trim();
    if(!text){toast('Write something first.');return;}
    const parsed=parseLifeSentence(text);
    openMini(parsed.kind,{title:parsed.title,dueAt:parsed.due,repeat:parsed.repeat,notes:'Captured from: '+text,alert:true});
    toast('Check the proposed details before saving.');
  };
  quickAdd=function(){if(currentMode()==='advanced')return openQuickPicker();openQuickPicker();};
  $('#newButton').onclick=openQuickPicker;
  $('#mobileAdd').onclick=openQuickPicker;
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-life-mini],[data-life-water],[data-life-close],[data-life-expand],[data-life-more-types],[data-life-mode],[data-life-focus],[data-life-setup],[data-life-onboard-mode],[data-life-onboard-focus],[data-life-skip],[data-life-finish],[data-life-template],[data-life-custom-rules]');
    if(!target)return;
    if(target.hasAttribute('data-life-mini')){openMini(target.dataset.lifeMini);return;}
    if(target.hasAttribute('data-life-water')){const key=dayKey(new Date());db.water[key]=(db.water[key]||0)+1;save();toast('Water serving logged.');return;}
    if(target.hasAttribute('data-life-close')){$('#'+(target.dataset.lifeClose==='quick'?'quickDialog':'lifeMiniDialog'))?.close();return;}
    if(target.hasAttribute('data-life-expand')){expandMini(target.dataset.lifeExpand);return;}
    if(target.hasAttribute('data-life-more-types')){$('#quickDialog')?.close();const list=Object.entries(KIND);
      $('#quickDialogContent').innerHTML='<div class="modal-top"><h2>All entry types</h2><button class="icon-btn" data-life-close="quick">×</button></div><div class="modal-content"><div class="simple-picker-grid">'+list.map(([k,v])=>
        '<button class="simple-picker-item" data-life-open-full="'+k+'"><span>'+v.icon+'</span><strong>'+safe(v.label)+'</strong></button>').join('')+'</div></div>';
      $('#quickDialog').showModal();return;}
    if(target.hasAttribute('data-life-custom-rules')){showCustomAutomation=true;render();return;}
    if(target.hasAttribute('data-life-template')){
      const rule=starterRules.find(r=>r.id===target.dataset.lifeTemplate);
      if(!rule)return;
      db.automations=Array.isArray(db.automations)?db.automations:[];
      if(db.automations.some(x=>x.trigger===rule.trigger&&x.title===rule.title&&x.delay===rule.delay)){toast('That template is already added.');return;}
      db.automations.push({id:uid(),trigger:rule.trigger,title:rule.title,delay:rule.delay});
      saveChoices();toast('Automation added: '+rule.title);return;
    }
    if(target.hasAttribute('data-life-mode')){db.settings.mode=logic.mode(target.dataset.lifeMode);saveChoices();toast('Switched to '+db.settings.mode+' mode.');return;}
    if(target.hasAttribute('data-life-setup')){openOnboarding();return;}
    if(target.hasAttribute('data-life-onboard-mode')){onboardingMode=logic.mode(target.dataset.lifeOnboardMode);$('#lifeWelcomeDialog').innerHTML=welcomeMarkup();return;}
    if(target.hasAttribute('data-life-skip')){closeOnboarding(true);return;}
    if(target.hasAttribute('data-life-finish')){closeOnboarding(false);return;}
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('#quickDialog [data-nav="capture"]'))$('#quickDialog')?.close();
  });
  document.addEventListener('click',event=>{
    const full=event.target.closest('[data-life-open-full]');
    if(!full)return;$('#quickDialog').close();openEntry(full.dataset.lifeOpenFull);
  });
  document.addEventListener('change',event=>{
    const input=event.target;
    if(input.hasAttribute('data-life-focus')){
      const k=input.dataset.lifeFocus,chosen=new Set(focus());
      input.checked?chosen.add(k):chosen.delete(k);
      db.settings.focusModules=[...chosen];
      if(input.checked)db.settings.hidden=(db.settings.hidden||[]).filter(x=>x!==k);
      saveChoices();return;
    }
    if(input.hasAttribute('data-life-onboard-focus')){
      const k=input.dataset.lifeOnboardFocus,chosen=new Set(onboardingFocus);
      input.checked?chosen.add(k):chosen.delete(k);onboardingFocus=[...chosen];return;
    }
  });
  if(location.hash.slice(1)==='explore')currentPage='explore';
  render();
  if(logic.shouldShowOnboarding(db.settings,db.items.length)){
    requestAnimationFrame(()=>openOnboarding());
  }
})();
