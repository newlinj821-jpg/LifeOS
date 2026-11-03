/* LifeOS reference database. Public reference records only; personal entries remain separate. */
(function(root){
'use strict';
const DB_NAME='LifeOSReferenceDB',DB_VERSION=1;
let opened=null,volatile=false;
const fallback={records:new Map(),favorites:new Map()};
function canUseIDB(){return typeof indexedDB!=='undefined'&&typeof indexedDB.open==='function';}
function open(){
 if(opened)return opened;
 if(!canUseIDB()){volatile=true;return Promise.resolve(null);}
 opened=new Promise(resolve=>{
   let req;
   try{req=indexedDB.open(DB_NAME,DB_VERSION);}catch(e){volatile=true;resolve(null);return;}
   req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains('records')){const s=d.createObjectStore('records',{keyPath:'key'});s.createIndex('type','type',{unique:false});}
      if(!d.objectStoreNames.contains('favorites'))d.createObjectStore('favorites',{keyPath:'key'});
   };
   req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();opened=null;};resolve(db);};
   req.onerror=()=>{volatile=true;resolve(null);};
   req.onblocked=()=>{volatile=true;resolve(null);};
 });
 return opened;
}
async function withStore(name,access,run){
 const db=await open();if(!db)return null;
 return new Promise((resolve,reject)=>{
  try{
   const tx=db.transaction(name,access),store=tx.objectStore(name),req=run(store);
   let result;
   if(req){req.onsuccess=()=>{result=req.result;};}
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error||new Error('Local reference database unavailable'));
   tx.onabort=()=>reject(tx.error||new Error('Reference database transaction aborted'));
  }catch(e){reject(e);}
 });
}
function goodEntry(x){return x&&typeof x==='object'&&typeof x.key==='string'&&x.key.length<150&&['food','exercise','holiday','template'].includes(x.type)&&typeof x.title==='string'&&x.title.length<=250;}
async function saveMany(items){
 const records=(Array.isArray(items)?items:[]).filter(goodEntry).slice(0,500);
 const db=await open();
 if(!db){records.forEach(x=>fallback.records.set(x.key,x));return records.length;}
 await new Promise((resolve,reject)=>{
  const tx=db.transaction('records','readwrite'),s=tx.objectStore('records');
  records.forEach(x=>s.put(x));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
 return records.length;
}
async function readAll(){
 const records=await withStore('records','readonly',s=>s.getAll());
 return records||[...fallback.records.values()];
}
async function find(type='',q='',limit=120){
 const all=await readAll(),needle=String(q||'').trim().toLowerCase();
 return all.filter(x=>(!type||x.type===type)&&(!needle||(x.title+' '+(x.description||'')+' '+(x.category||'')+' '+(x.provider||'')).toLowerCase().includes(needle)))
  .sort((a,b)=>(b.fetchedAt||0)-(a.fetchedAt||0)).slice(0,Math.max(1,Math.min(300,limit)));
}
async function favorites(){
 const list=await withStore('favorites','readonly',s=>s.getAll());
 return list||[...fallback.favorites.values()];
}
async function favorite(entry,enabled){
 if(!goodEntry(entry))throw Error('Not a valid reference entry');
 const db=await open();
 if(!db){if(enabled)fallback.favorites.set(entry.key,entry);else fallback.favorites.delete(entry.key);return;}
 await withStore('favorites','readwrite',s=>enabled?s.put(entry):s.delete(entry.key));
}
async function isFavorite(key){const results=await favorites();return results.some(x=>x.key===key);}
async function stats(){const [r,f]=await Promise.all([readAll(),favorites()]);return {cached:r.length,favorites:f.length,persistent:!volatile};}
async function exportLibrary(){return {version:1,type:'LifeOSReferenceBackup',exportedAt:new Date().toISOString(),records:await readAll(),favorites:await favorites()};}
async function importLibrary(input){
 if(!input||input.type!=='LifeOSReferenceBackup'||!Array.isArray(input.records)||!Array.isArray(input.favorites))throw Error('Not a valid reference backup');
 await saveMany(input.records.slice(0,2000));
 for(const item of input.favorites.slice(0,500))if(goodEntry(item))await favorite(item,true);
}
root.LifeOSReferenceDB=Object.freeze({open,saveMany,find,favorites,favorite,isFavorite,stats,exportLibrary,importLibrary});
})(typeof window!=='undefined'?window:globalThis);
