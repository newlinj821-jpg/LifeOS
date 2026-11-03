/* LifeOS enhancements: adaptive planner, sentence capture, personal automations. */
META.dayplan={label:'Adaptive day',icon:'✦',group:'CORE',desc:'Plan realistically around time, energy and priorities.'};
META.capture={label:'Quick capture',icon:'✧',group:'CORE',desc:'Turn everyday sentences into structured entries.'};
META.automations={label:'Automations',icon:'⚡',group:'TOOLS',desc:'Create follow-ups from completed actions.'};
db.automations=Array.isArray(db.automations)?db.automations:[];
db.automationHistory=Array.isArray(db.automationHistory)?db.automationHistory:[];
const originalLifeOSRender=render;
render=function(){
 if(!['dayplan','capture','automations'].includes(currentPage)){return originalLifeOSRender();}
 document.documentElement.dataset.theme=db.settings.theme||'dark';
 $('#sidebarNav').innerHTML=navHTML();
 $('#breadcrumb').textContent=META[currentPage].label;
 $('#todayLabel').textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric'}).format(new Date());
 $('#avatarButton').textContent=(db.settings.name||'L').slice(0,1).toUpperCase();
 $('#bellDot').style.display=db.items.some(i=>i.alert&&i.dueAt&&!doneOn(i))?'block':'none';
 document.querySelectorAll('.mobile-tab[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===currentPage));
 $('#view').innerHTML=currentPage==='dayplan'?lifeDayPage():currentPage==='capture'?lifeCapturePage():lifeAutomationPage();
};
function lifeDayPage(){
 const todayKey=dayKey(new Date()),plan=db.focusPlanDate===todayKey?(db.focusPlan||[]):[];
 const controls='<div class="modal-grid"><div class="form-group"><label>Energy available</label><select id="lifeEnergy" class="field"><option value="low">Low — essentials only</option><option value="medium" selected>Medium — balanced</option><option value="high">High — ambitious</option></select></div><div class="form-group"><label>Hours available</label><input class="field" id="lifeHours" type="number" min="1" max="14" value="5"></div><div class="form-group"><label>Begin at</label><input class="field" id="lifeStart" type="time" value="09:00"></div></div>';
 const timeline=plan.length?plan.map(x=>'<div class="entry-row"><span class="tag purple">'+safe(x.time)+'</span><div class="entry-main"><div class="entry-title">'+safe(x.title)+'</div><div class="entry-meta">'+safe(x.reason)+' · '+x.duration+' min</div></div></div>').join(''):empty('No daily plan yet','Select the time and energy you have, then generate a realistic schedule.');
 return header('Adaptive day planner','Build a practical day based on your existing responsibilities, priorities, energy and available hours.')+
 '<div class="grid-two"><section class="panel panel-pad"><h2>What can you do today?</h2><p class="fine" style="margin:9px 0 15px">Lower-energy settings preserve breathing room. Appointments remain fixed; tasks are fitted around them.</p>'+controls+'<div class="button-row" style="margin-top:16px">'+btn('✦ Build my day','life-plan-build','primary-btn')+'</div><p class="fine" style="margin-top:14px">The proposed plan is saved for today only. It never changes your deadlines or silently completes tasks.</p></section>'+panel("Your proposed timeline",timeline)+'</div>';
}
function buildLifePlan(){
 const energy=$('#lifeEnergy').value,available=Math.min(14,Math.max(1,Number($('#lifeHours').value)||5)),start=$('#lifeStart').value||'09:00';
 const key=dayKey(new Date()),items=db.items.filter(i=>!doneOn(i)&&i.dueAt&&dayKey(new Date(i.dueAt))<=key&&['task','habit','event','workout','pet','chore','bill','reminder'].includes(i.kind));
 const rank=x=>(x.kind==='event'?90:0)+(x.priority==='Urgent'?45:x.priority==='High'?22:0)+(dayKey(new Date(x.dueAt))<key?24:0);
 items.sort((a,b)=>rank(b)-rank(a));
 const fixed=items.filter(i=>i.kind==='event').map(x=>{const d=new Date(x.dueAt);return {start:d.getHours()*60+d.getMinutes(),duration:Math.min(240,Math.max(15,+x.duration||60))};});
 let budget=available*60*(energy==='low'?.6:energy==='medium'?.85:1),cursor=+start.slice(0,2)*60+(+start.slice(3)),plan=[];
 for(const item of items){
  const d=new Date(item.dueAt),duration=Math.min(180,Math.max(10,+item.duration||30));
  if(item.kind!=='event'&&duration>budget)continue;
  if(item.kind==='event')cursor=Math.max(cursor,d.getHours()*60+d.getMinutes());
  else{let count=0;while(fixed.some(x=>cursor<x.start+x.duration&&cursor+duration>x.start)&&count++<30)cursor+=15;}
  const t=String(Math.floor(cursor/60)%24).padStart(2,'0')+':'+String(cursor%60).padStart(2,'0');
  plan.push({time:t,title:item.title,id:item.id,duration,reason:item.kind==='event'?'Fixed appointment':item.priority==='Urgent'?'Urgent':item.kind==='habit'?'Recurring routine':'Priority task'});
  budget-=duration;cursor+=duration+(energy==='low'?20:energy==='medium'?10:5);if(budget<=0)break;
 }
 db.focusPlan=plan.sort((a,b)=>a.time.localeCompare(b.time));db.focusPlanDate=key;save();toast(plan.length+' activities placed on your proposed schedule.');
}
function lifeCapturePage(){
 return header('Universal quick capture','Write naturally. LifeOS recognizes common times, recurrence, and categories, then lets you review before saving.')+
 '<section class="panel panel-pad"><h2>Capture what is on your mind</h2><p class="fine" style="margin:9px 0 15px">Examples: “Workout tomorrow at 9am”, “Feed the dogs every day at 6pm”, “Pay the electric bill Friday at noon.”</p><textarea id="lifeSentence" class="field" rows="4" placeholder="Something I need to remember..."></textarea><div class="button-row" style="margin-top:15px">'+btn('✧ Review capture','life-capture-review','primary-btn')+'</div><p class="fine" style="margin-top:13px">Simple phrase recognition, not an AI model. Check the suggested date and details before saving.</p></section>';
}
function parseLifeSentence(text){
 const low=text.toLowerCase(),due=new Date();let kind='task',repeat='none';
 if(/\btomorrow\b/.test(low))due.setDate(due.getDate()+1);
 else if(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(low)){
  const n=low.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)[1],d=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(n);due.setDate(due.getDate()+((d-due.getDay()+7)%7||7));
 }else if(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(low)){
  const n=low.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)[1],d=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(n);due.setDate(due.getDate()+(d-due.getDay()+7)%7);
 }else if(/\bin\s+\d+\s+days?\b/.test(low))due.setDate(due.getDate()+Math.min(365,+low.match(/\bin\s+(\d+)\s+days?\b/)[1]));
 let match=low.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
 if(!match&&/\bat\s+(\d{1,2}):(\d{2})\b/.test(low))match=low.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
 if(match){let hour=+match[1],minute=+(match[2]||0);if(match[3])hour=hour%12+(match[3]==='pm'?12:0);due.setHours(Math.min(23,hour),Math.min(59,minute),0,0);}
 else if(/noon/.test(low))due.setHours(12,0,0,0);else if(/midnight/.test(low))due.setHours(0,0,0,0);else due.setHours(9,0,0,0);
 if(/every\s+day|daily/.test(low))repeat='daily';else if(/weekdays|every weekday/.test(low))repeat='weekdays';else if(/every\s+week|weekly/.test(low))repeat='weekly';else if(/every\s+month|monthly/.test(low))repeat='monthly';
 if(/workout|gym|exercise|lift|training/.test(low))kind='workout';else if(/breakfast|lunch|dinner|meal|eat\b/.test(low))kind='meal';else if(/dog|cat|pet|vet/.test(low))kind='pet';else if(/pay|bill|mortgage|rent|insurance/.test(low))kind='bill';else if(/appointment|meeting|doctor|dentist/.test(low))kind='event';else if(/clean|dishes|trash|laundry|vacuum/.test(low))kind='chore';else if(/remind|remember/.test(low))kind='reminder';
 const title=text.replace(/\b(tomorrow|today|next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in \d+ days?|every day|daily|weekdays|every week|weekly|every month|monthly)\b/gi,'').replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,'').replace(/\bat\s+\d{1,2}:\d{2}\b/gi,'').replace(/\s+/g,' ').trim();
 return {kind,title:title||text,due:localDateTime(due),repeat};
}
function reviewLifeCapture(){
 const text=$('#lifeSentence')?.value.trim();if(!text){toast('Enter a sentence first.');return;}
 const x=parseLifeSentence(text);openEntry(x.kind);
 const title=$('#entry-title'),due=$('#entry-dueAt'),repeat=$('#entry-repeat'),note=$('#entry-notes');
 if(title)title.value=x.title;if(due)due.value=x.due;if(repeat)repeat.value=x.repeat;if(note)note.value='Original capture: '+text;
 const check=$('#entryForm [name="alert"]');if(check)check.checked=true;
 toast('Review the details and save the entry.');
}
function lifeAutomationPage(){
 const rules=db.automations||[];
 const options=Object.entries(KIND).filter(([k])=>!['note','journal'].includes(k)).map(([k,v])=>'<option value="'+k+'">'+safe(v.label)+'</option>').join('');
 const content=rules.length?rules.map(r=>'<div class="entry-row"><div class="entry-main"><div class="entry-title">'+safe(r.title)+'</div><div class="entry-meta">Completing '+safe(KIND[r.trigger]?.label||r.trigger)+' → Follow up after '+r.delay+' minutes</div></div>'+btn('Delete','life-rule-remove:'+safe(r.id),'danger-btn')+'</div>').join(''):empty('No automation rules yet','Create a follow-up rule so tasks lead into the next useful action.');
 return header('Personal automation builder','Connect completed activities with meaningful follow-ups, without giving away control.')+
 '<div class="grid-two"><section class="panel panel-pad"><h2>Create an automation</h2><div class="modal-grid"><div class="form-group"><label>When completing</label><select class="field" id="lifeRuleKind">'+options+'</select></div><div class="form-group"><label>Wait this many minutes</label><input class="field" id="lifeRuleDelay" type="number" min="0" max="10080" value="30"></div><div class="form-group full"><label>Create this follow-up reminder</label><input class="field" id="lifeRuleTitle" maxlength="130" placeholder="Drink water and eat after my workout"></div></div><div class="button-row" style="margin-top:15px">'+btn('Save automation','life-rule-save','primary-btn')+'</div><p class="fine" style="margin-top:13px">These rules run when you mark an item complete in LifeOS. The resulting reminder can deliver a background push even after you close the app.</p></section>'+panel('Saved rules',content)+'</div>';
}
function lifeRunRules(item){
 db.automations=db.automations||[];db.automationHistory=db.automationHistory||[];let count=0;
 for(const rule of db.automations){if(rule.trigger!==item.kind)continue;
  const key=rule.id+':'+item.id+':'+dayKey(new Date());if(db.automationHistory.includes(key))continue;
  const due=new Date(Date.now()+rule.delay*60000);
  db.items.push({id:uid(),kind:'reminder',title:rule.title,dueAt:localDateTime(due),repeat:'none',priority:'Normal',details:'Triggered after completing: '+item.title,alert:true,leadMinutes:0,createdAt:Date.now(),updatedAt:Date.now()});db.automationHistory.push(key);count++;
 }
 db.automationHistory=db.automationHistory.slice(-350);if(count){save();if(pushEnabled)syncAllReminders(true);toast(count+' follow-up reminder'+(count>1?'s':'')+' created.');}
}
const previousLifeAction=action;
action=function(name){
 if(name==='life-plan-build'){buildLifePlan();return;}
 if(name==='life-capture-review'){reviewLifeCapture();return;}
 if(name==='life-rule-save'){const title=$('#lifeRuleTitle')?.value.trim();if(!title){toast('Enter a follow-up title.');return;}
  db.automations.push({id:uid(),title,trigger:$('#lifeRuleKind').value,delay:Math.max(0,Math.min(10080,+$('#lifeRuleDelay').value||0))});save();toast('Automation saved.');return;}
 if(name.startsWith('life-rule-remove:')){db.automations=db.automations.filter(r=>r.id!==name.slice('life-rule-remove:'.length));save();toast('Automation deleted.');return;}
 return previousLifeAction(name);
};
const previousLifeCompletion=completion;
completion=function(item){
 const before=doneOn(item);previousLifeCompletion(item);
 if(!before&&doneOn(item))lifeRunRules(item);
};
if(META[location.hash.slice(1)])currentPage=location.hash.slice(1);
render();
