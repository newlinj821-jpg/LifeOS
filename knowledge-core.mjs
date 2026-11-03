/* LifeOS public knowledge data: no personal records, no invented provider results. */
export const providers=Object.freeze({
 food:{name:'USDA FoodData Central',url:'https://fdc.nal.usda.gov/',license:'CC0 1.0',description:'Nutritional data, most values reported per 100 g'},
 exercise:{name:'wger',url:'https://wger.de/',license:'Source-specific licensing; visit wger for reuse details',description:'Public exercise descriptions and equipment'},
 holiday:{name:'Nager.Date',url:'https://nagerholidays.com/api',license:'Provider terms apply',description:'Public holidays by year and country'},
 template:{name:'LifeOS starter library',url:'',license:'LifeOS original reference templates',description:'Editable practical examples, not authoritative health advice'}
});
const clean=s=>String(s??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const numeric=v=>Number.isFinite(Number(v))?Number(v):null;
export function validSearch(input){return typeof input==='string'&&input.length>=2&&input.length<=80&&!/[<>\x00-\x1f]/.test(input);}
const findValue=(list,ids)=>{const x=(list||[]).find(n=>ids.includes(Number(n.nutrientId??n.nutrient?.id)));return x?numeric(x.value??x.amount):null;};
export function normalizeFood(f){
 if(!f||!Number.isFinite(Number(f.fdcId))||!f.description)return null;
 const ns=f.foodNutrients||[],desc=clean(f.description);
 if(!desc)return null;
 return {key:'usda:'+f.fdcId,id:String(f.fdcId),type:'food',title:desc.slice(0,150),description:clean([f.brandOwner||f.brandName,f.foodCategory,f.dataType].filter(Boolean).join(' · ')).slice(0,200),
 metrics:{calories:findValue(ns,[1008,2047,2048]),protein:findValue(ns,[1003]),carbs:findValue(ns,[1005]),fat:findValue(ns,[1004]),fiber:findValue(ns,[1079]),sodium:findValue(ns,[1093])},
 unit:'per 100 g (verify record basis)',provider:'USDA FoodData Central',sourceUrl:'https://fdc.nal.usda.gov/food-details/'+encodeURIComponent(f.fdcId)+'/nutrients',fetchedAt:Date.now()};
}
export function normalizeExercise(x){
 const translations=Array.isArray(x?.translations)?x.translations:[];
 const t=translations.find(z=>Number(z.language)===2&&z.name)||translations.find(z=>z.name);
 const title=clean(t?.name||x?.name);
 if(!title||!Number.isFinite(Number(x.id)))return null;
 const category=typeof x.category==='object'?x.category?.name: x.category_name || '';
 const muscles=(x.muscles||[]).map(z=>clean(z.name_en||z.name||'')).filter(Boolean).slice(0,8);
 const equipment=(x.equipment||[]).map(z=>clean(z.name||'')).filter(Boolean).slice(0,8);
 const description=clean(t?.description||x.description||'').slice(0,550);
 return {key:'wger:'+x.id,id:String(x.id),type:'exercise',title:title.slice(0,130),description,category:clean(category).slice(0,80),muscles,equipment,provider:'wger',sourceUrl:'https://wger.de/',fetchedAt:Date.now()};
}
export function normalizeHoliday(x){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x?.date||'')||!x.name)return null;
 const country=String(x.countryCode||'US').toUpperCase().slice(0,2);
 return {key:'holiday:'+country+':'+x.date+':'+clean(x.name).slice(0,60),id:x.date,type:'holiday',date:x.date,title:clean(x.name).slice(0,120),description:x.nationalHoliday===true||x.global===true?'National holiday':'Regional or other public holiday',country,provider:'Nager.Date',sourceUrl:'https://nagerholidays.com/api',fetchedAt:Date.now()};
}
const t=(id,title,category,kind,detail,repeat='none',duration=0)=>({
 key:'template:'+id,id,type:'template',title,category,kind,description:detail,repeat,duration,
 provider:'LifeOS starter library',sourceUrl:'',fetchedAt:0
});
export const templates=Object.freeze([
 t('daily-priorities','Identify three priorities','Planning','task','Choose a short, realistic list of what matters today.','daily'),
 t('weekly-review','Weekly reset and review','Planning','habit','Review unfinished tasks, upcoming obligations, and available time.','weekly'),
 t('tomorrow-plan','Plan tomorrow','Planning','task','Check tomorrow’s calendar and decide what needs preparing.','daily'),
 t('focus-session','Focused work block','Planning','task','Choose one clearly defined piece of work. Silence distractions for the block.','none',25),
 t('calendar-review','Check calendar and commitments','Planning','habit','Review appointments, travel time and anything that needs preparation.','daily'),
 t('capture-inbox','Process captured notes','Planning','task','Turn useful notes into tasks, events or reference material.','weekly'),
 t('monthly-goals','Monthly goals review','Planning','task','Update goals based on actual priorities and available capacity.','monthly'),
 t('payday-review','Payday money check','Finance','bill','Review incoming funds, bills and what remains available.','none'),
 t('bill-review','Review upcoming bills','Finance','task','Check due dates and balances; confirm payment status.','weekly'),
 t('subscription-audit','Subscription audit','Finance','task','Review renewals and cancel services you no longer use.','monthly'),
 t('expense-review','Review spending','Finance','task','Review recorded expenses and compare with your current budget.','weekly'),
 t('savings-check','Savings goal check-in','Finance','task','Check the goal, next action and any constraints.','monthly'),
 t('emergency-records','Update important records','Finance','task','Verify that documents and emergency contacts are current.','yearly'),
 t('walk','Go for a walk','Movement','workout','A flexible walk, adjusted to your ability, energy and conditions.','none',20),
 t('mobility','Mobility and stretch session','Movement','workout','Comfortable movement at a level appropriate to you.','none',15),
 t('bodyweight','Bodyweight movement session','Movement','workout','Choose exercises that suit your experience and physical limitations.','none',20),
 t('exercise-notes','Review workout notes','Movement','task','Review recent exercise logs before deciding what to do next.','weekly'),
 t('rest-day','Schedule recovery time','Movement','task','Plan rest and recovery, rather than filling every day with activity.','weekly'),
 t('meal-planning','Plan a few meals','Food','task','Decide what to cook and check ingredients you already have.','weekly'),
 t('grocery-check','Make a grocery list','Food','task','Check the pantry and note ingredients you need.','weekly'),
 t('kitchen-prep','Meal preparation','Food','task','Prepare ingredients or meals for the next few days.','weekly'),
 t('hydration-check','Water check-in','Food','habit','Log water consumed without aiming for an arbitrary number.','daily'),
 t('pantry-check','Check pantry supplies','Food','task','Identify staples that are running low.','weekly'),
 t('fridge-check','Check refrigerator for leftovers','Food','task','Review leftovers, food dates and meals to use soon.','weekly'),
 t('pet-feed','Pet feeding','Pets','pet','Confirm feeding according to the pet’s established routine.','daily'),
 t('pet-water','Fresh water for pets','Pets','pet','Check and refresh the water bowls.','daily'),
 t('pet-meds','Pet medication check','Pets','pet','Follow the veterinary instructions for any medications.','daily'),
 t('pet-supplies','Review pet supplies','Pets','task','Check food, waste bags and other supplies.','weekly'),
 t('pet-vet','Check pet care dates','Pets','task','Review veterinary appointments and due dates.','monthly'),
 t('pet-play','Pet enrichment time','Pets','pet','Plan appropriate play and mental stimulation.','daily'),
 t('dishes','Wash dishes','Household','chore','Clear and wash dishes and tidy the sink.','daily'),
 t('laundry','Laundry reset','Household','chore','Wash, dry and put away laundry.','weekly'),
 t('trash','Trash and recycling','Household','chore','Collect trash and confirm collection schedule.','weekly'),
 t('surfaces','Clean high-use surfaces','Household','chore','Wipe the surfaces used most often.','weekly'),
 t('bathroom','Bathroom cleaning','Household','chore','Clean bathroom fixtures and surfaces.','weekly'),
 t('floor','Floor cleaning','Household','chore','Vacuum, sweep or mop as needed.','weekly'),
 t('filters','Check filters and maintenance','Household','chore','Review filters and equipment based on manufacturer instructions.','monthly'),
 t('smoke-alarms','Safety equipment check','Household','task','Check smoke alarms and other household safety equipment according to manufacturer guidance.','monthly'),
 t('door-locks','Check doors and windows','Household','task','Check that doors and windows close securely.','monthly'),
 t('appointment-prep','Prepare for an appointment','Wellbeing','task','Collect questions, notes and documents you want to bring.','none'),
 t('energy-check','Energy and mood check-in','Wellbeing','checkin','Notice how you feel today, without needing a score or explanation.','daily'),
 t('quiet-time','Set aside quiet time','Wellbeing','habit','Take an intentional break from obligations.','daily'),
 t('reading','Read something you enjoy','Personal','habit','Read for enjoyment or learning.','daily'),
 t('creative-time','Creative session','Personal','task','Make time for writing, music, art or another hobby.','weekly'),
 t('reach-out','Catch up with someone','Social','task','Send a message or make a plan with someone you value.','none'),
 t('birthday-review','Review upcoming birthdays','Social','task','Check for dates or gifts that need preparation.','monthly'),
 t('trip-documents','Travel documents check','Travel','task','Review identification, reservations and any travel requirements.','none'),
 t('packing','Start a packing list','Travel','task','Collect practical essentials and planned activities.','none'),
 t('trip-budget','Trip budget review','Travel','task','Review travel costs and upcoming payments.','none'),
 t('project-next-step','Choose the next project step','Projects','project','Break a project into its smallest actionable next step.','none'),
 t('project-weekly','Weekly project review','Projects','task','Review the project status, blockers, and upcoming milestones.','weekly')
]);
export function searchTemplates(query='',category=''){
 const q=clean(query).toLowerCase(),c=clean(category).toLowerCase();
 return templates.filter(x=>(!q||(x.title+' '+x.description+' '+x.category).toLowerCase().includes(q))&&(!c||x.category.toLowerCase()===c));
}
export function normalizeResults(kind,payload){
 const input=kind==='food'?payload?.foods:kind==='exercise'?payload?.results:payload;
 if(!Array.isArray(input))return [];
 const fn=kind==='food'?normalizeFood:kind==='exercise'?normalizeExercise:normalizeHoliday;
 return input.map(fn).filter(Boolean).slice(0,300);
}
