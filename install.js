/* LifeOS install experience — iOS and Android, no subscription or app store required. */
(() => {
 'use strict';
 let deferredInstall=null;
 const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function markPlatform(){
  document.body.classList.toggle('standalone-app',isStandalone());
  document.body.classList.toggle('standalone-ios',isStandalone()&&isIOS());
  document.body.classList.toggle('standalone-android',isStandalone()&&!isIOS());
 }
 function installPanel(){
  const installed=isStandalone(),ios=isIOS();
  const status=installed?'Installed and running without a browser address bar.':ios?'Install from Safari so LifeOS opens as its own app.':'Add LifeOS to your Home Screen for one-tap access.';
  const steps=installed?'':ios?
   '<ol><li>Open this LifeOS site in <strong>Safari</strong>.</li><li>Tap the Share button and choose <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> enabled, then tap Add.</li></ol>':
   '<ol><li>Open LifeOS in Chrome or another supported browser.</li><li>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home Screen</strong>.</li><li>Open LifeOS from the new icon.</li></ol>';
  return '<section class="panel panel-pad installer-panel" id="installLifeOS"><div class="eyebrow">LIFEOS ON YOUR DEVICE</div><h2 style="margin-top:6px">'+
   (installed?'Your LifeOS app is installed':'Open LifeOS like a real app')+'</h2><p class="fine" style="margin-top:8px">'+status+'</p>'+
   steps+'<div class="install-actions">'+(!installed&&!ios&&deferredInstall?
   '<button class="primary-btn" data-life-install>Install LifeOS</button>':'')+
   '<button class="outline-btn" data-life-reload>Check for app updates</button></div>'+
   '<p class="install-status">Your personal entries stay on this device when you update. To move to another phone, export a backup from Settings.</p></section>';
 }
 function injectInstallPanel(){
  if(typeof currentPage!=='undefined'&&currentPage==='settings'){
   const view=document.querySelector('#view'),head=view?.querySelector('.page-head');
   if(head&&!view.querySelector('#installLifeOS'))head.insertAdjacentHTML('afterend',installPanel());
  }
 }
 const previousRender=render;
 render=function(){markPlatform();previousRender();injectInstallPanel();};
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;if(currentPage==='settings')render();});
 window.addEventListener('appinstalled',()=>{deferredInstall=null;markPlatform();if(currentPage==='settings')render();});
 document.addEventListener('click',async event=>{
  if(event.target.closest('[data-life-install]')){
   if(!deferredInstall)return;
   const prompt=deferredInstall;deferredInstall=null;
   try{await prompt.prompt();}catch(e){console.warn('LifeOS install prompt unavailable');}
   if(currentPage==='settings')render();
  }
  if(event.target.closest('[data-life-reload]')){
   try{const reg=await navigator.serviceWorker?.getRegistration();await reg?.update();}catch(e){}
   location.reload();
  }
 });
 markPlatform();
 injectInstallPanel();
})();
