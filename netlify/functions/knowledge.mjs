/* LifeOS open reference gateway. Reads only vetted public sources; stores no private life records. */
import {getStore} from '@netlify/blobs';
import {createHash} from 'node:crypto';
import {json as respond} from '../lib/core.mjs';
import {normalizeResults,providers,validSearch} from '../../knowledge-core.mjs';
const cacheName='lifeos-public-reference-v1';
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,32);
const ttl={food:7*86400_000,exercise:24*3600_000,holiday:14*86400_000};
const now=()=>Date.now();
async function getCached(key){
 try{return await getStore(cacheName).get(key,{type:'json'});}catch(e){console.warn('LifeOS public cache read unavailable',String(e.message).slice(0,120));return null;}
}
async function putCached(key,value){
 try{await getStore(cacheName).setJSON(key,value);}catch(e){console.warn('LifeOS public cache write unavailable',String(e.message).slice(0,120));}
}
async function remote(url,ms=10000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);
 try{
 const r=await fetch(url,{headers:{accept:'application/json'},signal:controller.signal,redirect:'error'});
 if(!r.ok){const error=new Error('Data source returned '+r.status);error.status=r.status;throw error;}
 const contentType=r.headers.get('content-type')||'';
 if(!contentType.includes('json'))throw Error('Data source returned unexpected content');
 const raw=await r.text();if(raw.length>5_000_000)throw Error('Data response exceeded safety limit');
 return JSON.parse(raw);
 }finally{clearTimeout(timer);}
}
const response=(body,status=200)=>respond(body,status);
export default async function handler(request){
 if(request.method!=='GET')return response({error:'GET requests only'},405);
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return response({error:'Requests must originate from LifeOS'},403);
 const args=new URL(request.url).searchParams;
 const kind=String(args.get('source')||'').toLowerCase(),q=String(args.get('query')||'').trim();
 if(!['food','exercise','holiday'].includes(kind))return response({error:'Choose food, exercise, or holiday'},400);
 if(kind!=='holiday'&&!validSearch(q))return response({error:'Enter a search of 2–80 characters'},400);
 const country=String(args.get('country')||'US').toUpperCase(),year=Number(args.get('year')||new Date().getFullYear());
 if(kind==='holiday'&&(!/^[A-Z]{2}$/.test(country)||!Number.isInteger(year)||year<2024||year>2037))return response({error:'Enter a country code and year 2024–2037'},400);
 const source=providers[kind],key='public-'+kind+'-'+digest(kind==='holiday'?country+':'+year:kind==='exercise'?'catalog':q.toLowerCase());
 const cached=await getCached(key);
 if(cached?.updatedAt&&now()-cached.updatedAt<ttl[kind])return response({...finalize(kind,q,cached.data,source),cache:'fresh',updatedAt:cached.updatedAt});
 try{
 let payload;
 if(kind==='food'){
 const u=new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
 u.searchParams.set('api_key',process.env.FDC_API_KEY||'DEMO_KEY');
 u.searchParams.set('query',q);u.searchParams.set('pageSize','40');
 payload=await remote(u.toString(),9500);
 }else if(kind==='exercise'){
 try{payload=await remote('https://wger.de/api/v2/exerciseinfo/?limit=250&language=2',11000);}
 catch(e){console.warn('wger detail endpoint unavailable, attempting list endpoint',String(e.message).slice(0,120));
 payload=await remote('https://wger.de/api/v2/exercise/?limit=250&language=2',11000);}
 }else{
 payload=await remote('https://nagerholidays.com/api/v4/Holidays/'+country+'/'+year,8500);
 }
 const normalized=normalizeResults(kind,payload);
 const saved={updatedAt:now(),data:normalized};
 // Shared cache is reference data only; never store a user's activity here.
 await putCached(key,saved);
 return response({...finalize(kind,q,normalized,source),cache:'live',updatedAt:saved.updatedAt});
 }catch(e){
 if(cached?.data)return response({...finalize(kind,q,cached.data,source),cache:'stale',updatedAt:cached.updatedAt,warning:'The external source is unavailable. Showing previously cached reference records.'});
 const code=e.status===429?429:e.status===403?502:503;
 const hint=kind==='food'?(process.env.FDC_API_KEY?'USDA is temporarily unavailable or rate limited. Try again later.':'USDA DEMO_KEY has a very low shared rate limit. Add a free FDC_API_KEY in Netlify for dependable food lookup.'):kind==='exercise'?'The public exercise reference is temporarily unavailable. Saved entries remain accessible.':'Holiday lookup is temporarily unavailable. Try again later.';
 console.error('LifeOS knowledge lookup',kind,String(e.message).slice(0,160));
 return response({source:kind,error:hint,code:'SOURCE_UNAVAILABLE'},code);
 }
}
function finalize(kind,query,records,source){
 const filtered=kind==='exercise'?records.filter(x=>(x.title+' '+x.category+' '+x.description+' '+(x.muscles||[]).join(' ')+' '+(x.equipment||[]).join(' ')).toLowerCase().includes(query.toLowerCase())).slice(0,60):kind==='food'?records.slice(0,40):records.slice(0,100);
 return {source:kind,provider:source,query:kind==='holiday'?null:query,results:filtered,count:filtered.length,coverage:kind==='exercise'?'Searches a limited sample of the wger catalog; results are not exhaustive.':kind==='food'?'USDA values are reference estimates; verify quantities and product details.':null};
}
