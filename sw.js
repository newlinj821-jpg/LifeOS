const VERSION='lifeos-v11',SHELL=['/','/index.html','/styles.css','/simplicity.css','/knowledge.css','/mobile.css','/app-mobile.css','/calendar-share.css','/finance.css','/bank.css','/app.js','/enhancements.js','/mode-core.js','/simplicity.js','/reference-db.js','/knowledge-bridge.js','/calendar-share.js','/calendar-core.mjs','/finance-core.js','/finance-ui.js','/bank-ui.js','/install.js','/knowledge-core.mjs','/knowledge-ui.mjs','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png','/icon-maskable-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
const request=event.request,url=new URL(request.url);
if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/.netlify/'))return;
event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request).then(r=>r||caches.match('/'))));
});
self.addEventListener('push',event=>{
let payload={title:'LifeOS reminder',body:'Open LifeOS to review your reminder.',url:'/'};
try{if(event.data)payload={...payload,...event.data.json()};}catch{}
const display=self.registration.showNotification(payload.title,{body:payload.body,icon:'/icon.svg',badge:'/icon.svg',tag:payload.tag||'lifeos-reminder',renotify:false,data:{url:payload.url||'/'},requireInteraction:false});
const deliver=payload.type==='lifeos-device-verification'&&typeof payload.code==='string'&&/^[0-9]{6}$/.test(payload.code)
 ?self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const target=clients.find(client=>client.focused)||clients.find(client=>client.visibilityState==='visible')||clients[0];if(target)target.postMessage({type:'lifeos-device-verification',code:payload.code});})
 :Promise.resolve();
event.waitUntil(Promise.all([display,deliver]));
});
self.addEventListener('notificationclick',event=>{
event.notification.close();
event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
for(const client of clients){if(client.url.startsWith(self.location.origin)){await client.focus();await client.navigate(url);return;}}
await self.clients.openWindow(url);
}));
});
