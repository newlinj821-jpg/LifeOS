import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localCalendarEntries,validatePublished,makeICS,parseICS} from '../calendar-core.mjs';
const items=[
 {id:'event123456',kind:'event',title:'Dinner, games; friends',dueAt:'2026-11-15T18:30',duration:90,location:'Private home',notes:'Bring snacks',repeat:'weekly'},
 {id:'bill1234567',kind:'bill',title:'Mortgage payment',dueAt:'2026-11-15T08:00'},
 {id:'health12345',kind:'checkin',title:'Sensitive wellness notes',dueAt:'2026-11-15T09:00'},
 {id:'task1234567',kind:'task',title:'Review trip',dueAt:'2026-11-16T10:00'},
 {id:'pet12345678',kind:'pet',title:'Dog medication',dueAt:'2026-11-15T09:00'}
];
test('Default calendar export shares ONLY events, no other LifeOS modules or confidential locations',()=>{
 const list=localCalendarEntries(items);
 assert.equal(list.length,1);
 assert.equal(list[0].title,'Dinner, games; friends');
 assert.equal(list[0].description,'');
 assert.equal(list[0].location,'');
 assert.equal(list[0].repeat,'weekly');
 const xml=makeICS(list);
 assert.ok(!xml.includes('Mortgage'));
 assert.ok(!xml.includes('Sensitive wellness'));
 assert.ok(!xml.includes('Dog medication'));
 assert.ok(!xml.includes('Private home'));
 assert.ok(!xml.includes('Bring snacks'));
 assert.match(xml,/RRULE:FREQ=WEEKLY/);
 assert.match(xml,/SUMMARY:Dinner\\, games\\; friends/);
});
test('Busy-only feed omits all event titles and locations',()=>{
 const list=localCalendarEntries(items,{busyOnly:true,details:true});
 const ics=makeICS(list);
 assert.match(ics,/SUMMARY:Busy/);
 assert.ok(!ics.includes('Dinner'));
 assert.ok(!ics.includes('Private home'));
});
test('Opt-in inclusion of selected tasks still excludes money, wellness and pet information',()=>{
 const list=localCalendarEntries(items,{includeTasks:true});
 assert.deepEqual(list.map(x=>x.kind).sort(),['event','task']);
});
test('ICS import round-trip maintains event time, escaping, duration and recurrence',()=>{
 const list=localCalendarEntries(items,{details:true});
 const text=makeICS(list,{now:'2026-11-03T19:00:00.000Z'});
 assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'));
 assert.ok(text.includes('DTSTART:'));
 const decoded=parseICS(text);
 assert.equal(decoded.length,1);
 assert.equal(decoded[0].title,items[0].title);
 assert.equal(decoded[0].duration,90);
 assert.equal(decoded[0].repeat,'weekly');
 assert.equal(decoded[0].location,items[0].location);
 assert.equal(decoded[0].details,items[0].notes);
});
test('All-day events export as DATE instead of phantom 9 AM time',()=>{
 const entries=localCalendarEntries([{id:'holiday123456',kind:'event',title:'Holiday',
  dueAt:'2026-12-25T09:00',allDay:true,duration:60}]);
 const text=makeICS(entries);
 assert.match(text,/DTSTART;VALUE=DATE:20261225/);
 assert.match(text,/DTEND;VALUE=DATE:20261226/);
 const decoded=parseICS(text);
 assert.equal(decoded[0].allDay,true);
 assert.equal(decoded[0].dueAt.slice(0,10),'2026-12-25');
});
test('ICS import parses UTC and timezone-tagged events with a bounded size',()=>{
 const text='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:some-id\r\nSUMMARY:Doctor appointment\r\nDTSTART;TZID=America/Chicago:20261202T090000\r\nDTEND;TZID=America/Chicago:20261202T100000\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
 const imported=parseICS(text);
 assert.equal(imported.length,1);
 assert.equal(new Date(imported[0].dueAt).toISOString(),'2026-12-02T15:00:00.000Z');
 assert.equal(imported[0].duration,60);
 assert.throws(()=>parseICS('Not a calendar'),/valid/);
 assert.deepEqual(validatePublished([{id:'bad',startUTC:'invalid',endUTC:'invalid'}]),[]);
});
test('Installed web app includes exactly one calendar script and all mobile assets',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.equal((html.match(/src="\/calendar-share\.js"/g)||[]).length,1);
 assert.equal((html.match(/href="\/calendar-share\.css"/g)||[]).length,1);
 for(const p of ['calendar-share.js','calendar-share.css','calendar-core.mjs','mobile.css','install.js'])
  {assert.ok(build.includes(p),'build '+p);assert.ok(sw.includes('/'+p),'offline '+p);}
});
