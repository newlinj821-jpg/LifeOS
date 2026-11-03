import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../mode-core.js',import.meta.url),'utf8');
const context=vm.createContext({});
vm.runInContext(source,context,{filename:'mode-core.js'});
const modes=context.LifeOSModes;
const available=['today','planner','dayplan','calendar','reminders','capture','explore','insights',
  'routines','fitness','food','money','home','pets','wellness','projects','goals','vault','journal','automations'];

test('Simple is the default and never deletes access to All Modules',()=>{
  assert.equal(modes.mode(undefined),'simple');
  assert.equal(modes.mode('not-a-mode'),'simple');
  const shown=Array.from(modes.visible('simple',['fitness','food','money','pets'],[],available));
  for(const key of ['today','planner','dayplan','calendar','reminders','capture','explore'])
    assert.ok(shown.includes(key),key);
  for(const key of ['fitness','food','money'])assert.ok(shown.includes(key),key);
  assert.ok(!shown.includes('pets'),'Simple Mode limits favorite areas to three');
  assert.ok(!shown.includes('automations'),'Advanced tools do not crowd Simple Mode');
});
test('Standard exposes selected areas and insights, not an overwhelming catalog',()=>{
  const shown=Array.from(modes.visible('standard',['fitness','money','pets'],[],available));
  for(const key of ['fitness','money','pets','insights','explore'])
    assert.ok(shown.includes(key));
  assert.ok(!shown.includes('automations'));
  assert.ok(!shown.includes('journal'));
});
test('Advanced exposes all non-hidden sections without changing the underlying data',()=>{
  const all=[...available],hidden=['journal','money'];
  const shown=Array.from(modes.visible('advanced',['fitness'],hidden,available));
  assert.ok(shown.includes('automations'));
  assert.ok(shown.includes('projects'));
  assert.ok(!shown.includes('money'));
  assert.ok(!shown.includes('journal'));
  assert.deepEqual(available,all,'Visible navigation never mutates source modules');
  assert.deepEqual(hidden,['journal','money'],'User hidden list is not modified');
});
test('Only available, unique interest keys can be selected',()=>{
  assert.deepEqual(Array.from(modes.interests(['pets','pets','unknown','food'])),['pets','food']);
  assert.deepEqual(Array.from(modes.selectedExtras(['pets','food','fitness','money'],'simple')),['pets','food','fitness']);
  assert.equal(modes.selectedExtras(['pets','food','fitness','money'],'standard').length,4);
});
test('First-run setup is optional and never interrupts existing user records',()=>{
  assert.equal(modes.shouldShowOnboarding({},0),true);
  assert.equal(modes.shouldShowOnboarding({onboarded:false},1),false);
  assert.equal(modes.shouldShowOnboarding({onboarded:true},0),false);
});
test('Production markup loads feature scripts in dependency order',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const srcs=['app.js','enhancements.js','mode-core.js','simplicity.js'];
  let previous=-1;
  for(const src of srcs){const next=html.indexOf('src="/'+src+'"');assert.ok(next>previous,src+' must load in order');previous=next;}
  assert.match(html,/simplicity\.css/);
});
