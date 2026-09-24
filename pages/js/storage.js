export function storageKey(prefix,sourceHash,index,value){
  return [prefix,String(sourceHash||"pack"),index,String(value||"")].join(":");
}
export function readStoredFlag(key){
  try{return localStorage.getItem(key)==="1"}catch{return false}
}
export function toggleStoredFlag(key){
  try{
    if(localStorage.getItem(key)==="1")localStorage.removeItem(key);
    else localStorage.setItem(key,"1");
    return localStorage.getItem(key)==="1";
  }catch{return false}
}
