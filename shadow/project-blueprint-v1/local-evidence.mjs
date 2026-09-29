import {mkdirSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
export function saveLocalEvidence(directory,id,part,data){
 if(!directory)return;
 if(!/^[a-zA-Z0-9-]{12,100}$/.test(id)||!['request','received','parsed','result'].includes(part))throw Error('INVALID_EVIDENCE_PATH');
 mkdirSync(directory,{recursive:true,mode:0o700});
 const file=join(directory,`${id}-${part}.json`),fd=openSync(file,'wx',0o600);
 try{writeFileSync(fd,JSON.stringify(data,null,2));fsyncSync(fd)}finally{closeSync(fd)}
 const d=openSync(directory,'r');try{fsyncSync(d)}finally{closeSync(d)}
 return file;
}
