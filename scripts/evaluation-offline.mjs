import {scenarios,runScenario} from '../tests/fixtures/evaluation/manifest.mjs';
import fs from 'node:fs/promises';
const report={mode:'offline_only',campaignId:'tikdam-v1-eval-2026-11-01',startedAt:new Date().toISOString(),cases:[],providerCalls:0};
for(const scenario of scenarios){try{await runScenario(scenario);report.cases.push({id:scenario.id,area:scenario.area,passed:true});}catch(error){report.cases.push({id:scenario.id,area:scenario.area,passed:false,errorCode:error.code||'ASSERTION_FAILED',message:String(error.message).split('\n')[0].slice(0,240)});}}
report.passed=report.cases.filter(x=>x.passed).length;report.failed=report.cases.length-report.passed;report.finishedAt=new Date().toISOString();
await fs.mkdir('.local-state/evaluation',{recursive:true,mode:0o700});await fs.writeFile('.local-state/evaluation/offline-results.json',JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify({mode:report.mode,total:report.cases.length,passed:report.passed,failed:report.failed,providerCalls:0,byArea:scenarios.reduce((a,s)=>(a[s.area]=(a[s.area]||0)+1,a),{})},null,2));if(report.failed)process.exitCode=1;
