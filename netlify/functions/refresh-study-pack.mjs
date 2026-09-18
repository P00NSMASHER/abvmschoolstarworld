import { getStore } from '@netlify/blobs';
const UPSTREAM='https://api-v2.appdeploy.ai/app/abvm-source-bridge-gkj08k/api/study-pack';
export default async () => {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetch(UPSTREAM,{headers:{accept:'application/json','cache-control':'no-cache'},signal:controller.signal});
    const data=await response.json().catch(()=>null);
    if(response.ok&&data?.pack?.sourceSufficient===true){const store=getStore('abvm-school-pack',{consistency:'strong'});await store.setJSON('latest',{...data,delivery:'live',proxiedAt:new Date().toISOString()});}
  }catch(error){console.warn('ABVM cache refresh skipped:',error instanceof Error?error.message:'unknown');}
  finally{clearTimeout(timer);}
};
export const config={schedule:'17 * * * *'};
