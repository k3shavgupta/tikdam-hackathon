import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createEvaluationLedger} from './ledger.mjs';

export async function openEvaluationRuntime({persistPath}={}){
 if(typeof persistPath!=='string'||!persistPath.trim())throw Error('An explicit persistent evaluation directory is required.');
 const directory=path.resolve(persistPath);await mkdir(directory,{recursive:true,mode:0o700});
 const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("Private evaluation storage. No provider networking.",{status:404});}}',d1Databases:['EVALUATION_DB'],resourcePersistencePath:directory,compatibilityDate:'2026-10-30'}));
 let closed=false;
 try{const db=await runtime.getD1Database('EVALUATION_DB');const ledger=createEvaluationLedger(db);await ledger.init();return{ledger,db,close:async()=>{if(!closed){closed=true;await runtime.dispose();}}};}
 catch(error){await runtime.dispose();throw error;}
}
