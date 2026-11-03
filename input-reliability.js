/* LifeOS native input reliability for iPhone, Android and desktop.
   Prevent asynchronous status updates from replacing a field while it is being edited.
   This does not intercept typing, native selection, keyboard events or form submissions. */
(() => {
 'use strict';
 if(typeof document==='undefined'||typeof render!=='function')return;
 const editQuery='input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="submit"]):not([type="button"]),textarea,select,[contenteditable="true"]';
 const editable=node=>Boolean(node&&node.matches?.(editQuery)&&!node.disabled&&!node.readOnly);
 let deferred=false,scheduled=false,lastPage=typeof currentPage==='string'?currentPage:'';
 const inView=node=>Boolean(node?.closest?.('#view'));
 const previousRender=render;
 render=function(){
  const active=document.activeElement;
  // Several sections refresh asynchronously (push status, Plaid, calendar).
  // Replacing #view while a keyboard is open destroys the actual input and loses text.
  if(lastPage===currentPage&&inView(active)&&editable(active)){
   deferred=true;
   return;
  }
  lastPage=currentPage;
  deferred=false;
  previousRender();
 };
 const isPhone=()=>window.matchMedia?.('(max-width:880px)')?.matches||false;
 let blurHandle;
 function keyboardState(){
  if(!isPhone())return;
  document.body.classList.toggle('lifeos-keyboard-open',editable(document.activeElement));
 }
 document.addEventListener('focusin',event=>{
  if(!editable(event.target))return;
  clearTimeout(blurHandle);
  keyboardState();
  if(isPhone()){
   // Safari needs the visual viewport to settle after opening its keyboard.
   // Scroll only when the field remains focused, never cause a rerender.
   const el=event.target;
   setTimeout(()=>{
    if(document.activeElement!==el)return;
    try{el.scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});}catch{}
   },250);
  }
 },true);
 document.addEventListener('focusout',event=>{
  if(!editable(event.target))return;
  clearTimeout(blurHandle);
  blurHandle=setTimeout(()=>{
   keyboardState();
   if(!deferred||editable(document.activeElement)||scheduled)return;
   scheduled=true;
   requestAnimationFrame(()=>{
    scheduled=false;
    if(deferred&&!editable(document.activeElement))render();
   });
  },120);
 },true);
 window.addEventListener('pageshow',()=>{lastPage=currentPage;keyboardState();});
 // If iOS resizes the visual viewport while the keyboard is opening, do not
 // automatically redraw the page; let WebKit adjust its native scroll position.
})();
