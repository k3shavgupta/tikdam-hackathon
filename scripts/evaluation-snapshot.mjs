// Offline export only. Remote import uses reviewed Wrangler commands separately.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openEvaluationRuntime} from '../server/evaluation/runtime.mjs';
import {buildEvaluationSnapshot,snapshotToSql} from '../server/evaluation/reporting.mjs';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
const r=await openEvaluationRuntime({persistPath:'.local-state/evaluation-d1'});
try{const snapshot=buildEvaluationSnapshot(await r.ledger.summary(),await r.ledger.rows());await fs.mkdir('.local-state/evaluation',{recursive:true,mode:0o700});await fs.writeFile('.local-state/evaluation/admin-snapshot.json',JSON.stringify(snapshot,null,2),{mode:0o600});await fs.writeFile('.local-state/evaluation/admin-snapshot.sql',snapshotToSql(snapshot),{mode:0o600});console.log(JSON.stringify({mode:'offline_export',campaignId:snapshot.campaignId,generatedAt:snapshot.generatedAt,file:'.local-state/evaluation/admin-snapshot.sql'}));}finally{await r.close();}
