import initSqlJs from 'sql.js';
import wasmURL from 'sql.js/dist/sql-wasm.wasm?url';
import {CONFIG,validateRecords} from './data.js';
import {decodeSQLite} from './sqlite-format.js';
let sql;
const getSQL=async()=>sql||=(await initSqlJs({locateFile:()=>wasmURL}));
export async function readFile(file){
 if(file.size>20*1024*1024)throw new Error('20MB 이하의 파일을 선택해 주세요.');
 if(file.name.toLowerCase().endsWith('.json')){const o=JSON.parse(await file.text());return {records:validateRecords(Array.isArray(o)?o:o.records,o.metadata),name:file.name};}
 const SQL=await getSQL(); return {records:decodeSQLite(SQL,new Uint8Array(await file.arrayBuffer())),name:file.name};
}
export async function exportSQLite(records){const SQL=await getSQL(),db=new SQL.Database();try{db.run('CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE records (id TEXT PRIMARY KEY, text TEXT NOT NULL, answer TEXT NOT NULL, embedding BLOB);');for(const[k,v]of Object.entries(CONFIG))db.run('INSERT INTO metadata VALUES (?,?)',[k,JSON.stringify(v)]);for(const r of records){let blob=null;if(r.embedding){blob=new Uint8Array(1536);const view=new DataView(blob.buffer);r.embedding.forEach((x,i)=>view.setFloat32(i*4,x,true));}db.run('INSERT INTO records VALUES (?,?,?,?)',[r.id,r.text,r.answer,blob]);}return db.export();}finally{db.close();}}
function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open('magic-conch-local',1);req.onupgradeneeded=()=>req.result.createObjectStore('data');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
export async function saveLocal(value){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(value,'collection');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function loadLocal(){const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('data').objectStore('data').get('collection');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
