let deferredPrompt=null;
let changeHandler=null;

export function isStandalone(){
  return Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches||navigator.standalone===true);
}
export function initInstallTracking(onChange){
  changeHandler=typeof onChange==="function"?onChange:null;
  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPrompt=event;
    changeHandler?.();
  });
  window.addEventListener("appinstalled",()=>{
    deferredPrompt=null;
    changeHandler?.();
  });
}
export function installExperience(){
  if(isStandalone())return{installed:true,show:false};
  const ua=navigator.userAgent||"";
  const ios=/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
  const android=/Android/.test(ua);
  if(deferredPrompt){
    return{installed:false,show:true,canPrompt:true,title:"Install ABVM Grade 2",detail:"Add the app for one-tap access from your device.",action:"Install app"};
  }
  if(ios){
    return{installed:false,show:true,canPrompt:false,title:"Add ABVM Grade 2 to Home Screen",detail:"In Safari, tap Share, then Add to Home Screen."};
  }
  if(android){
    return{installed:false,show:true,canPrompt:false,title:"Install ABVM Grade 2",detail:"In Chrome, open the menu and choose Install app or Add to Home screen."};
  }
  return{installed:false,show:true,canPrompt:false,title:"Install ABVM Grade 2",detail:"Use your browser’s install option to add this app for faster access."};
}
export async function promptInstall(){
  if(!deferredPrompt)return{available:false};
  const prompt=deferredPrompt;
  deferredPrompt=null;
  await prompt.prompt();
  const choice=await prompt.userChoice.catch(()=>null);
  changeHandler?.();
  return{available:true,outcome:choice?.outcome||"unknown"};
}


export function registerFreshServiceWorker(){
  if(!("serviceWorker" in navigator))return;
  let reloading=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
    if(reloading)return;
    reloading=true;
    location.reload();
  });
  window.addEventListener("load",async()=>{
    try{
      const registration=await navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"});
      await registration.update();
    }catch{}
  });
}
