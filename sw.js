const VERSION='lifeos-v1',SHELL=['/','/index.html','/styles.css','/app.js','/manifest.webmanifest','/icon.svg'];
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
event.waitUntil(self.registration.showNotification(payload.title,{body:payload.body,icon:'/icon.svg',badge:'/icon.svg',tag:payload.tag||'lifeos-reminder',renotify:true,data:{url:payload.url||'/'},requireInteraction:payload.priority==='high'}));
});
self.addEventListener('notificationclick',event=>{
event.notification.close();
event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
const url=new URL(event.notification.data?.url||'/',self.location.origin).href;
for(const client of clients){if(client.url.startsWith(self.location.origin)){await client.focus();await client.navigate(url);return;}}
await self.clients.openWindow(url);
}));
});
