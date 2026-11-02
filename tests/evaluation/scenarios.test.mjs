import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarios,runScenario,buildLiveCases} from '../fixtures/evaluation/manifest.mjs';
test('evaluation manifest contains exactly 1000 distinct scenario records and required distribution',()=>{
 assert.equal(scenarios.length,1000);assert.equal(new Set(scenarios.map(x=>x.id)).size,1000);
 assert.deepEqual(scenarios.reduce((a,x)=>(a[x.area]=(a[x.area]||0)+1,a),{}),{extraction:300,intake:250,explanation:150,routing:150,security:100,budget:50});
 const signatures=scenarios.map(x=>JSON.stringify({area:x.area,kind:x.kind,input:x.input,expected:x.expected}));assert.equal(new Set(signatures).size,1000);
});
for(const scenario of scenarios)test(`${scenario.id}: ${scenario.description}`,()=>runScenario(scenario));
test('live fixture pack has known synthetic facts and supported operations',async()=>{
 const cases=await buildLiveCases();assert.ok(cases.length>=20&&cases.length<=35);assert.equal(new Set(cases.map(x=>x.id)).size,cases.length);
 for(const c of cases){assert.ok(['chat','extract'].includes(c.operation));assert.ok(c.expected);if(c.operation==='extract')assert.match(c.file.data,/^data:(application\/pdf|image\/png);base64,/);}
});
