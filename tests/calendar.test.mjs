import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanCalendarEvents,escapeICSText,foldICSLine,generateICS,calendarPreview,ID_PATTERN} from '../netlify/lib/calendar.mjs';
const event={uid:'item_123456_2026_11_3',title:'Lunch, coffee; & notes',location:'The café, Downtown',
 start:'2026-11-03T19:00:00.000Z',end:'2026-11-03T20:00:00.000Z'};
test('calendar shares reject invalid, huge, and nonsensical events',()=>{
 const cleaned=cleanCalendarEvents([event,{...event,uid:'bad',start:'not-a-date'},{
  uid:'another-long-enough-id',start:'2026-11-03T22:00:00.000Z',end:'2026-11-03T20:00:00.000Z',title:'Bad'
 }]);
 assert.equal(cleaned.length,1);
 assert.equal(cleaned[0].uid,event.uid);
 assert.equal(ID_PATTERN.test('x'.repeat(32)),true);
 assert.equal(ID_PATTERN.test('guess'),false);
});
test('Busy-only is the default and does not leak titles or locations in the feed',()=>{
 const viewed=calendarPreview([event]);
 assert.equal(viewed[0].title,'Busy');
 assert.equal(viewed[0].location,'');
 const ics=generateICS(viewed,{updatedAt:Date.parse('2026-11-03T13:00:00.000Z')});
 assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
 assert.ok(ics.includes('VERSION:2.0\r\n'));
 assert.ok(ics.includes('SUMMARY:Busy\r\n'));
 assert.ok(!ics.includes('coffee'));
 assert.ok(!ics.includes('Downtown'));
});
test('Opted-in named events preserve title, location and UTC start time',()=>{
 const visible=calendarPreview([event],{shareNames:true,shareLocations:true});
 const ics=generateICS(visible);
 assert.ok(ics.includes('SUMMARY:Lunch\\, coffee\\; & notes'));
 assert.ok(ics.includes('LOCATION:The café\\, Downtown'));
 assert.ok(ics.includes('DTSTART:20261103T190000Z'));
 assert.ok(ics.includes('DTEND:20261103T200000Z'));
});
test('Location only never becomes visible when event titles are hidden',()=>{
 const viewed=calendarPreview([event],{shareNames:false,shareLocations:true});
 assert.equal(viewed[0].title,'Busy');
 assert.equal(viewed[0].location,'');
});
test('Lines are correctly UTF-8 folded within 75 bytes, and newline injection is escaped',()=>{
 const line='SUMMARY:'+ 'réunion'.repeat(28);
 const folded=foldICSLine(line);
 for(const segment of folded.split('\r\n')){
  assert.ok(Buffer.byteLength(segment,'utf8')<=75);
 }
 const all=escapeICSText('One, two; three\nnext');
 assert.equal(all,'One\\, two\\; three\\nnext');
});
test('Duplicated event UIDs do not produce duplicate subscribed calendar entries',()=>{
 const ics=generateICS([event,event]);
 assert.equal(ics.split('BEGIN:VEVENT').length-1,1);
});
test('Calendar source and offline styles are in build and HTML',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
 const config=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
 for(const p of ['calendar-share.js','calendar-share.css','app-mobile.css']){assert.ok(html.includes(p));assert.ok(build.includes(p));}
 assert.match(config,/calendar-share/);
 assert.match(html,/data-nav="calendar"/);
});
