import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {providers,templates,searchTemplates,normalizeFood,normalizeExercise,normalizeHoliday,normalizeResults,validSearch} from '../knowledge-core.mjs';
test('The source database includes distinct provenance and more than forty reusable offline routines',()=>{
 assert.ok(templates.length>=45);
 assert.ok(new Set(templates.map(x=>x.key)).size===templates.length);
 assert.ok(templates.every(x=>x.provider==='LifeOS starter library'&&x.sourceUrl===''));
 assert.equal(providers.food.license,'CC0 1.0');
 assert.ok(providers.exercise.url.startsWith('https://'));
});
test('Offline routines can be searched by meaningful keywords and category',()=>{
 assert.ok(searchTemplates('pet').length>=3);
 assert.ok(searchTemplates('bill','Finance').length>=1);
 assert.ok(searchTemplates('workout').length>=1);
 assert.deepEqual(searchTemplates('nonexistent-zzq'),[]);
});
test('USDA search records retain fdcId and nutrient units and never invent missing values',()=>{
 const food=normalizeFood({fdcId:123456,description:'Oatmeal, cooked',dataType:'Foundation',foodCategory:'Cereals',foodNutrients:[
   {nutrientId:1008,value:71},{nutrientId:1003,value:2.5},{nutrientId:1005,value:12},{nutrientId:1004,value:1.4}
 ]});
 assert.equal(food.key,'usda:123456');assert.equal(food.metrics.calories,71);
 assert.equal(food.metrics.protein,2.5);assert.equal(food.metrics.sodium,null);
 assert.match(food.unit,/100 g/i);assert.match(food.sourceUrl,/123456/);
});
test('Wger exercise catalog selects English translations and reduces markup to plain text',()=>{
 const x=normalizeExercise({id:2020,translations:[{language:1,name:'Kniebeuge'},{
   language:2,name:'Barbell Squat',description:'<p>Stand tall &amp; lower carefully.</p>'}],
   category:{name:'Legs'},muscles:[{name_en:'Quadriceps'}],equipment:[{name:'Barbell'}]});
 assert.equal(x.title,'Barbell Squat');
 assert.match(x.description,/Stand tall & lower carefully/);
 assert.doesNotMatch(x.description,/<p>/);
 assert.ok(x.equipment.includes('Barbell'));
});
test('Holiday data supports the newer public Nager.Date response',()=>{
 const data=normalizeHoliday({date:'2027-01-01',name:"New Year's Day",countryCode:'US',nationalHoliday:true});
 assert.equal(data.key,"holiday:US:2027-01-01:New Year's Day");
 assert.equal(data.description,'National holiday');
 assert.equal(data.date,'2027-01-01');
});
test('Input validation and response normalization reject malformed data',()=>{
 assert.equal(validSearch('squat'),true);
 assert.equal(validSearch('x'),false);
 assert.equal(validSearch('<svg>'),false);
 assert.equal(normalizeFood({fdcId:'bad'}),null);
 assert.deepEqual(normalizeResults('food',{foods:[{fdcId:3,description:'Egg',foodNutrients:[]}]}).map(x=>x.title),['Egg']);
});
test('Production references are packaged as a stand-alone module with linked styles',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/reference-db\.js/);
 assert.match(html,/knowledge-bridge\.js/);
 assert.match(html,/knowledge-ui\.mjs/);
 assert.match(html,/knowledge\.css/);
 const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
 for(const name of ['knowledge-core.mjs','knowledge-ui.mjs','knowledge.css','reference-db.js','knowledge-bridge.js'])assert.ok(build.includes(name),name);
});
