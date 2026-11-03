/* Chrome DevTools Protocol smoke test: actual mobile text insertion and saving.
 * No Playwright dependency, no bank connection, no external network.
 * This tests Chromium mobile emulation, NOT physical iPhone Safari. */
import {createServer} from 'node:http';
import {readFileSync,statSync,createReadStream,mkdtempSync,rmSync} from 'node:fs';
import {join,extname,resolve} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const root=resolve('dist');
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
 if(path.startsWith('/.netlify/')){res.writeHead(404,{'content-type':'application/json'});res.end('{}');return;}
 const full=resolve(join(root,path==='/'?'index.html':path.replace(/^\//,'')));
 if(!full.startsWith(root+'/')&&full!==root){res.writeHead(403);res.end();return;}
 let stat;
 try{stat=statSync(full);if(!stat.isFile())throw Error('Not file');}
 catch{res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':mime[extname(full)]||'application/octet-stream','cache-control':'no-store'});
 createReadStream(full).pipe(res);
});
let chrome,ws,sessionDir;
let nextId=0;const pending=new Map();
function chromePath(){
 for(const binary of ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser']){
  try{execFileSync(binary,['--version'],{stdio:'ignore'});return binary;}catch{}
 }
 throw Error('Headless Chrome/Chromium not installed on this runner');
}
function command(method,params={}){
 return new Promise((resolve,reject)=>{
  const id=++nextId;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},12000);
  pending.set(id,{resolve:data=>{clearTimeout(timer);resolve(data);},reject:error=>{clearTimeout(timer);reject(error);}});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression,awaitPromise=false){
 const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise});
 if(result.exceptionDetails)throw Error('Browser JS error: '+JSON.stringify(result.exceptionDetails.text));
 return result.result?.value;
}
async function until(expression,label,limitMs=10000){
 const start=Date.now();
 while(Date.now()-start<limitMs){
  const result=await evaluate(expression);
  if(result)return result;
  await wait(120);
 }
 throw Error('Timed out waiting for '+label);
}
async function insert(selector,text){
 const present=await until(`document.querySelector(${JSON.stringify(selector)})!==null`,selector);
 if(!present)throw Error('Missing '+selector);
 const focus=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});for(const d of document.querySelectorAll('dialog[open]'))d.close();e.value='';e.focus();return document.activeElement===e})()`);
 if(!focus)throw Error(selector+' could not focus');
 await command('Input.insertText',{text});
 const value=await evaluate(`document.querySelector(${JSON.stringify(selector)})?.value`);
 if(value!==text)throw Error(selector+' input rejected text: '+JSON.stringify(value));
 await evaluate('render()');
 const after=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e&&e.value===${JSON.stringify(text)}&&document.activeElement===e})()`);
 if(!after)throw Error(selector+' lost focus or text during unrelated render');
 console.log('PASS: actual text typed and preserved in',selector);
}
try{
 const script=readFileSync(join(root,'index.html'),'utf8');
 if(!script.includes('input-reliability.js'))throw Error('Production HTML missing focus repair');
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const binary=chromePath();
 sessionDir=mkdtempSync(join(tmpdir(),'lifeos-smoke-'));
 chrome=spawn(binary,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run',
  '--disable-background-networking','--remote-debugging-port=9222','--user-data-dir='+sessionDir,
  '--window-size=430,930','about:blank'],{stdio:'ignore'});
 let pages;
 for(let i=0;i<90;i++){
  try{pages=await (await fetch('http://127.0.0.1:9222/json/list')).json();if(pages?.[0]?.webSocketDebuggerUrl)break;}catch{}
  await wait(100);
 }
 if(!pages?.[0]?.webSocketDebuggerUrl)throw Error('Chromium debugging endpoint unavailable');
 ws=new WebSocket(pages[0].webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=event=>{
  const payload=JSON.parse(event.data);
  if(payload.id&&pending.has(payload.id)){
   const req=pending.get(payload.id);pending.delete(payload.id);
   payload.error?req.reject(Error(payload.error.message)):req.resolve(payload.result||{});
  }
 };
 await command('Runtime.enable');
 await command('Page.enable');
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
 await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await command('Page.addScriptToEvaluateOnNewDocument',{source:`
  (()=>{const original=window.fetch.bind(window);
   window.fetch=(input,init)=>{const url=String(typeof input==='string'?input:input?.url||'');
    if(url.includes('/.netlify/functions/plaid')){
     const action=JSON.parse(init?.body||'{}').action;
     return Promise.resolve(new Response(JSON.stringify(action==='config'?{configured:true,environment:'sandbox'}:{error:'Mock: not connected'}),{status:action==='config'?200:401,headers:{'content-type':'application/json'}}));
    }
    return original(input,init);
   };
  })();`});
 await command('Page.navigate',{url:'http://127.0.0.1:'+port+'/#money'});
 await until("document.querySelector('#financeIncome')!==null",'Money form',15000);
 await insert('#financeIncome','2410.55');
 // Simulate user saving the income rather than merely setting a DOM value.
 await evaluate("document.querySelector('#financeIncome').blur();document.querySelector('#financeSetupForm button[type=submit]').click()");
 await until("(()=>{try{return JSON.parse(localStorage.getItem('lifeos.data.v1')||'{}').finance?.monthlyIncome===2410.55}catch{return false}})()", 'Income save',4000);
 console.log('PASS: income saved to the actual LifeOS database');
 await insert('#lifeBankKey','validPrivateBankUnlockKey123');
 await evaluate("document.querySelector('#lifeBankKey').blur();setPage('settings')");
 await until("document.querySelector('#settingName')!==null",'Settings name');
 await insert('#settingName','Keyboard works');
 await evaluate("document.querySelector('#settingName').blur();openEntry('note')");
 await until("document.querySelector('#entry-title')!==null",'entry form');
 await insert('#entry-title','Typing in a note');
 console.log('PASS: Money, banking, Settings and modal entry typing checks completed');
}finally{
 try{ws?.close();}catch{}
 try{chrome?.kill('SIGKILL');}catch{}
 try{server.close();}catch{}
 if(sessionDir)try{rmSync(sessionDir,{recursive:true,force:true});}catch{}
}
