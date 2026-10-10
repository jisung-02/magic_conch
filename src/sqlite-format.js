import {validateRecords} from './data.js';
export function decodeSQLite(SQL,bytes){
 const db=new SQL.Database(bytes);
 try{const meta={};const ms=db.exec('SELECT key, value FROM metadata');if(ms.length)for(const [k,v] of ms[0].values){try{meta[k]=JSON.parse(v);}catch{meta[k]=v;}}
 const rs=db.exec('SELECT id,text,answer,embedding FROM records LIMIT 2001');if(!rs.length)throw new Error('records 테이블이 비어 있어요.');
 const records=rs[0].values.map(([id,text,answer,b])=>{let embedding;if(b){if(!(b instanceof Uint8Array)||b.byteLength!==1536)throw new Error('임베딩 BLOB 크기가 올바르지 않아요.');const view=new DataView(b.buffer,b.byteOffset,b.byteLength);embedding=Array.from({length:384},(_,i)=>view.getFloat32(i*4,true));}return{id,text,answer,embedding};});
 return validateRecords(records,meta);}finally{db.close();}
}
