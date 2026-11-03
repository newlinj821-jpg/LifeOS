import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanItems,clock,quiet,notification,recurrence,dueReminders,validZone} from '../netlify/lib/core.mjs';

const reminder={id:'exercise-2026',title:'Upper-body workout',details:'Strength · 45 minutes · Bench, rows and shoulders',date:'2026-11-03',time:'18:00',repeat:'daily',kind:'workout',lead:15,priority:'normal',enabled:true};
test('accepts only valid device-reminder data',()=>{
 const clean=cleanItems([reminder,{...reminder,id:'!'},{...reminder,title:''},{...reminder,time:'30:98'}]);
 assert.equal(clean.length,1);
 assert.equal(clean[0].title,'Upper-body workout');
 assert.equal(clean[0].lead,15);
});
test('formats category-specific reminders without misleading minute counts',()=>{
 const at=notification(reminder,false);
 assert.match(at.title,/workout/i);
 assert.match(at.body,/15 minutes/i);
 assert.match(at.body,/45 minutes/i);
 assert.match(at.url,/#reminders/);
 const dayBefore=notification({...reminder,lead:1440},false);
 assert.match(dayBefore.body,/tomorrow/i);
 assert.doesNotMatch(dayBefore.body,/1440 minutes/);
 const privateMessage=notification(reminder,true);
 assert.doesNotMatch(privateMessage.title,/Upper-body/i);
 assert.doesNotMatch(privateMessage.body,/Bench/i);
});
test('quiet hours across midnight and not during the daytime',()=>{
 assert.equal(quiet({minutes:23*60},'22:00','07:00'),true);
 assert.equal(quiet({minutes:6*60+59},'22:00','07:00'),true);
 assert.equal(quiet({minutes:7*60},'22:00','07:00'),false);
 assert.equal(quiet({minutes:12*60},'22:00','07:00'),false);
});
test('recurring weekday schedule excludes Saturday and Sunday',()=>{
 const weekdays={...reminder,repeat:'weekdays'};
 assert.equal(recurrence(weekdays,'2026-11-04'),true);
 assert.equal(recurrence(weekdays,'2026-11-07'),false);
 assert.equal(recurrence(weekdays,'2026-11-08'),false);
});
test('advance notifications fire before the actual scheduled time in a chosen timezone',()=>{
 const due=dueReminders([reminder],'America/Chicago',new Date('2026-11-03T23:45:10.000Z'),2);
 assert.equal(due.length,1);
 assert.equal(due[0].reminder.title,'Upper-body workout');
 const early=dueReminders([reminder],'America/Chicago',new Date('2026-11-03T23:40:10.000Z'),2);
 assert.equal(early.length,0);
});
test('timezone validation prevents invalid IANA identifiers',()=>{
 assert.equal(validZone('America/Chicago'),true);
 assert.equal(validZone('Never/Nowhere'),false);
});
