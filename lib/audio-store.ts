type Role="nurse"|"doctor";
const DB="clarity-audio",STORE="recordings";

function open():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
}
async function run<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest):Promise<T>{
  const db=await open();
  return new Promise((resolve,reject)=>{const request=action(db.transaction(STORE,mode).objectStore(STORE));request.onsuccess=()=>resolve(request.result as T);request.onerror=()=>reject(request.error)});
}
export const saveAudio=(role:Role,blob:Blob)=>run<void>("readwrite",store=>store.put(blob,role));
export const loadAudio=(role:Role)=>run<Blob|undefined>("readonly",store=>store.get(role));
export const clearAudio=(...roles:Role[])=>Promise.all(roles.map(role=>run<void>("readwrite",store=>store.delete(role)))).catch(()=>undefined);
