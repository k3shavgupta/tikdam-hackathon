import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React,{act} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';

let components,folder;
test.before(async()=>{
 folder=await mkdtemp(join(tmpdir(),'tikdam-ui-'));
 const require=createRequire(import.meta.url);
 const source=new URL('../../src/',import.meta.url).pathname;
 const bundled=await build({stdin:{contents:"export {AssistantPanel} from './components/AssistantPanel.jsx'; export {FeedbackPanel} from './components/FeedbackPanel.jsx'; export {default as AdminApp} from './admin/AdminApp.jsx';",resolveDir:source,loader:'jsx'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'ui-test-dependencies',setup(build){build.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:require.resolve(args.path),external:true}));build.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));}}]});
 const file=join(folder,'components.mjs');await writeFile(file,bundled.outputFiles[0].text);components=await import(pathToFileURL(file));
});
test.after(async()=>{if(folder)await rm(folder,{recursive:true,force:true});});

test('paused assistant explains manual fallback and never renders a paid send control',()=>{
 const html=renderToStaticMarkup(React.createElement(components.AssistantPanel,{facts:{mode:'before',country:'IN'},config:{ai:{chatAvailable:false,reason:'AI is paused to preserve credits.'},countries:[{code:'IN',sources:[{id:'in-1'}]}]}}));
 assert.match(html,/AI is paused to preserve credits/);assert.doesNotMatch(html,/Send question/);assert.match(html,/cannot confirm an invoice/);
});

test('unreviewed country can use the assistant when AI is available, with a local-rules warning',()=>{
 const html=renderToStaticMarkup(React.createElement(components.AssistantPanel,{facts:{mode:'before',country:'FR'},config:{ai:{chatAvailable:true},countries:[{code:'FR',sources:[]}]}}));
 assert.match(html,/Send question/);
 assert.match(html,/Local tax rules have not been reviewed/);
 assert.doesNotMatch(html,/AI questions are available only/);
});

async function mount(Component,props,fetchImpl,setup){
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://tikdam.xyz'});
 const globals={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true,fetch:fetchImpl};
 const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const[key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 setup?.(dom.window);
 const {createRoot}=await import('react-dom/client');
 const root=createRoot(dom.window.document.getElementById('root'));
 await act(async()=>{root.render(React.createElement(Component,props));await new Promise(resolve=>setTimeout(resolve,0));});
 return{dom,root,cleanup:async()=>{await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}

test('feedback is an explicit user action, excludes arbitrary fields and shows success',async()=>{
 const requests=[];const view=await mount(components.FeedbackPanel,{mode:'purchase',country:'IN'},async(path,options)=>{requests.push({path,options});return Response.json({ok:true});});
 try{
  assert.equal(requests.length,0);
  const input=view.dom.window.document.querySelector('textarea');
  await act(async()=>{const setter=Object.getOwnPropertyDescriptor(view.dom.window.HTMLTextAreaElement.prototype,'value').set;setter.call(input,'The billing checklist helped.');input.dispatchEvent(new view.dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new view.dom.window.Event('change',{bubbles:true}));});
  // React's textarea event plugin can use the fallback input tracker in jsdom.
  if(view.dom.window.document.querySelector('button').disabled){
   await act(async()=>{input.value='The billing checklist helped.';input.dispatchEvent(new view.dom.window.Event('input',{bubbles:true}));});
  }
  await act(async()=>{view.dom.window.document.querySelector('form').dispatchEvent(new view.dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));});
  const sent=requests.find(row=>row.path==='/api/feedback');assert.ok(sent);assert.deepEqual(JSON.parse(sent.options.body),{text:'The billing checklist helped.',mode:'purchase',country:'IN'});assert.match(view.dom.window.document.body.textContent,/Feedback sent/);
 }finally{await view.cleanup();}
});

test('dashboard shows real empty states and pause action cannot reset spending',async()=>{
 const requests=[];
 const overview={settings:{aiEnabled:true,campaignCapMicrousd:5000000,dailyCapMicrousd:1000000,dailyCallCap:10,maxInFlight:1},usage:{spentMicrousd:0,reservedMicrousd:0,remainingMicrousd:5000000,inputTokens:0,outputTokens:0,billingUnknown:0},totals:{started:0,completed:0,failed:0},byCountry:[],byMode:[]};
 const view=await mount(components.AdminApp,{},async(path,options)=>{
  requests.push({path,options});if(path.includes('/settings'))return Response.json({...overview.settings,aiEnabled:false});if(path.includes('/overview'))return Response.json(overview);return Response.json({items:[],total:0});
 });
 try{
  assert.match(view.dom.window.document.body.textContent,/No processing jobs/);assert.match(view.dom.window.document.body.textContent,/No feedback/);
  const pause=[...view.dom.window.document.querySelectorAll('button')].find(button=>button.textContent==='Pause AI');assert.ok(pause);
  await act(async()=>{pause.click();await new Promise(resolve=>setTimeout(resolve,0));});
  const change=requests.find(row=>row.path==='/api/admin/settings');assert.deepEqual(JSON.parse(change.options.body),{aiEnabled:false});
  assert.equal(requests.some(row=>/reset|model|extract|chat/.test(row.path)),false);
 }finally{await view.cleanup();}
});

test('owner dashboard shows fixed chat topics and per-query micro-dollar estimates',async()=>{
 const overview={settings:{aiEnabled:true,campaignCapMicrousd:5000000,dailyCapMicrousd:1000000,dailyCallCap:10,maxInFlight:1},usage:{spentMicrousd:3038,reservedMicrousd:30100,remainingMicrousd:4966862,inputTokens:829,outputTokens:471,billingUnknown:1},totals:{started:0,completed:0,failed:1},byCountry:[],byMode:[],byChatTopic:[{topic:'seller_verification',queries:1,estimatedMicrousd:3038,heldMicrousd:0}]};
 const jobs={items:[{id:'test-request',operation:'chat',mode:'before',country:'IN',topic:'seller_verification',status:'succeeded',model:'test-model',createdAt:'2026-11-03T13:13:15.000Z',inputTokens:829,outputTokens:471,estimatedMicrousd:3038,heldMicrousd:null}],total:1};
 const view=await mount(components.AdminApp,{},async path=>path.includes('/overview')?Response.json(overview):path.includes('/jobs')?Response.json(jobs):Response.json({items:[],total:0}));
 try{const content=view.dom.window.document.body.textContent;assert.match(content,/seller verification/);assert.match(content,/\$0\.003038/);assert.match(content,/No question text is saved/);}
 finally{await view.cleanup();}
});

const emptyOverview={settings:{aiEnabled:false,campaignCapMicrousd:5000000,dailyCapMicrousd:1000000,dailyCallCap:10,maxInFlight:1},usage:{spentMicrousd:0,reservedMicrousd:0,remainingMicrousd:5000000,inputTokens:0,outputTokens:0,billingUnknown:0},totals:{started:0,completed:0,failed:0},byCountry:[],byMode:[]};

test('query cost view separates paid failed replies from unknown billing and applies only date filters',async()=>{
 const requests=[];
 const shared={operation:'chat',provider:'Meta',model:'muse-spark-1.3',createdAt:'2026-11-04T14:21:03.570Z',pricingVersion:'meta-standard-2026-11-01.1',rates:{inputUsdPerMillion:1.25,outputUsdPerMillion:4.25}};
 const report={items:[
  {...shared,id:'recorded-query',billingStatus:'succeeded',responseStatus:'failed',errorCode:'MODEL_OUTPUT_INVALID',inputTokens:693,outputTokens:582,estimatedMicrousd:3340,heldMicrousd:null},
  {...shared,id:'unknown-query',billingStatus:'billing_unknown',responseStatus:null,inputTokens:null,outputTokens:null,estimatedMicrousd:null,heldMicrousd:30100},
 ],total:2,summary:{queries:2,estimatedQueries:1,estimatedMicrousd:3340,averageMicrousd:3340,minMicrousd:3340,maxMicrousd:3340,heldMicrousd:30100,billingUnknown:1,failedBeforeSend:0}};
 const view=await mount(components.AdminApp,{},async path=>{
  requests.push(path);
  return Response.json(path.includes('/overview')?emptyOverview:path.includes('/costs')?report:{items:[],total:0});
 });
 try{
  const d=view.dom.window.document;
  const panel=d.querySelector('[aria-labelledby="tk-costs-title"]');
  const rows=panel.querySelectorAll('tbody tr');
  assert.match(rows[0].textContent,/\$0\.003340/);
  assert.match(rows[0].textContent,/Response failed/);
  assert.match(rows[0].textContent,/Input \$1\.25 \/ 1M/);
  assert.match(rows[1].textContent,/Cost unknown/);
  assert.match(rows[1].textContent,/\$0\.030100 held/);
  assert.doesNotMatch(rows[1].textContent,/\$0\.000000|0 \/ 0/);
  const form=d.querySelector('.tk-filters');
  const dates=form.querySelectorAll('input[type="date"]');
  await change(view,dates[0],'2026-11-01');
  await change(view,dates[1],'2026-11-05');
  await submit(view,form);
  const costRequest=requests.filter(path=>path.includes('/costs')).at(-1);
  assert.match(costRequest,/from=2026-11-01&to=2026-11-05/);
  assert.doesNotMatch(costRequest,/country=|status=|operation=/);
 }finally{await view.cleanup();}
});
async function change(view,element,value){
 await act(async()=>{
  const prototype=element.tagName==='SELECT'?view.dom.window.HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?view.dom.window.HTMLTextAreaElement.prototype:view.dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,value);
  element.dispatchEvent(new view.dom.window.Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));
 });
}
async function submit(view,form){await act(async()=>{form.dispatchEvent(new view.dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));});}

test('dashboard refuses an increased allowance and requires typed deletion confirmation',async()=>{
 const requests=[];
 const view=await mount(components.AdminApp,{},async(path,options)=>{
  requests.push({path,options});if(path.includes('/overview'))return Response.json(emptyOverview);if(path.includes('/purge'))return Response.json({deleted:0});return Response.json({items:[],total:0});
 });
 try{
  const d=view.dom.window.document;
  const limitForm=[...d.querySelectorAll('form')].find(form=>form.textContent.includes('Campaign allowance in USD'));
  await change(view,limitForm.querySelector('input'),'6');await submit(view,limitForm);
  assert.match(d.body.textContent,/no higher than the current values/);
  assert.equal(requests.some(row=>row.path==='/api/admin/settings'),false);
  const purgeForm=[...d.querySelectorAll('form')].find(form=>form.textContent.includes('Type DELETE'));
  assert.equal(purgeForm.querySelector('button').disabled,true);
  await submit(view,purgeForm);assert.equal(requests.some(row=>row.path==='/api/admin/purge'),false);
  await change(view,purgeForm.querySelector('input'),'DELETE');await submit(view,purgeForm);
  const deletion=requests.find(row=>row.path==='/api/admin/purge');assert.deepEqual(JSON.parse(deletion.options.body),{kind:'events',confirm:'DELETE'});
  assert.match(d.body.textContent,/Campaign spending and idempotency records remain/);
 }finally{await view.cleanup();}
});

test('job filters use validated query fields and submitted feedback is rendered as text',async()=>{
 const requests=[];
 const view=await mount(components.AdminApp,{},async(path,options)=>{
  requests.push({path,options});if(path.includes('/overview'))return Response.json(emptyOverview);
  if(path.includes('/coverage'))return Response.json({items:[{code:'IN',name:'India',purchaseEstimate:'conditional_narrow',readiness:'tested',sources:[]}]});
  if(path.includes('/feedback'))return Response.json({items:[{id:'f1',text:'<script>SECRET_CANARY()</script>',country:'IN',mode:'before'}],total:1});
  return Response.json({items:[],total:0});
 });
 try{
  const d=view.dom.window.document;const filterForm=[...d.querySelectorAll('form')].find(form=>form.textContent.includes('Apply filters'));
  const country=[...filterForm.querySelectorAll('label')].find(element=>element.textContent.startsWith('Country')).querySelector('select');
  await change(view,country,'IN');await submit(view,filterForm);
  assert.ok(requests.some(row=>row.path.startsWith('/api/admin/jobs?')&&new URL(row.path,'https://tikdam.xyz').searchParams.get('country')==='IN'));
  assert.match(d.body.textContent,/<script>SECRET_CANARY\(\)<\/script>/);assert.equal(d.querySelectorAll('script').length,0);
  assert.match(d.body.textContent,/These are not unique people, filed claims or refunds paid/);
 }finally{await view.cleanup();}
});

test('denied admin request offers owner login and never shows invented metrics',async()=>{
 const view=await mount(components.AdminApp,{},async()=>Response.json({code:'ADMIN_ACCESS_DENIED',message:'Administrator access requires owner login.'},{status:403}));
 try{const d=view.dom.window.document;assert.match(d.body.textContent,/owner login/);assert.equal(d.querySelector('.tk-metrics'),null);assert.equal(d.querySelector('a[href="/admin"]').textContent,'Open owner login');assert.equal(d.querySelector('a[href="/app"]').textContent,'Open checker');}
 finally{await view.cleanup();}
});

test('dashboard displays recorded pricing versions and an honest empty state',async()=>{
 for(const versions of [[],['meta-standard-2026-11-01.1']]){
  const overview={...emptyOverview,usage:{...emptyOverview.usage,pricingVersions:versions}};
  const view=await mount(components.AdminApp,{},async(path)=>Response.json(path.includes('/overview')?overview:{items:[],total:0}));
  try{
   const text=view.dom.window.document.body.textContent;
   if(versions.length){assert.match(text,/meta-standard-2026-11-01\.1/);assert.doesNotMatch(text,/No model price versions recorded/);}
   else assert.match(text,/No model price versions recorded/);
  }finally{await view.cleanup();}
 }
});

test('assistant sends only after consent and challenge, and proposals require an apply action',async()=>{
 const requests=[],applied=[];
 const facts={mode:'before',country:'IN',businessCountry:'IN'};
 const view=await mount(components.AssistantPanel,{facts,config:{ai:{chatAvailable:true},turnstileSiteKey:'synthetic-site-key',countries:[{code:'IN',sources:[{id:'in-1',title:'Official source',url:'https://example.test/official'}]}],clientSources:[{id:'in-client-1',title:'Official withholding source',url:'https://example.test/withholding'}]},onPropose:proposal=>applied.push(proposal)},async(path,options)=>{
  requests.push({path,options});return Response.json(path==='/api/session'?{ok:true}:{message:'What will you buy?',proposals:{item:'Office stationery'},missingFields:['registration'],sourceIds:['in-1','in-client-1','https://evil.test/invented']});
 },window=>{window.turnstile={render(element,options){options.callback('synthetic-fresh-challenge');return 'widget';},remove(){}};});
 try{
  const d=view.dom.window.document;await change(view,d.querySelector('textarea'),'I want office supplies.');
  const send=()=>[...d.querySelectorAll('button')].find(button=>button.textContent==='Send question');
  assert.equal(send().disabled,true);assert.equal(requests.length,0);
  await act(async()=>{d.querySelector('input[type="checkbox"]').click();await new Promise(resolve=>setTimeout(resolve,0));});
  assert.equal(send().disabled,false);
  await act(async()=>{send().click();await new Promise(resolve=>setTimeout(resolve,0));});
  const chat=requests.filter(row=>row.path==='/api/chat');assert.equal(chat.length,1);
  assert.deepEqual(JSON.parse(chat[0].options.body),{purpose:'intake',facts,history:[{role:'user',content:'I want office supplies.'}]});
  assert.equal(applied.length,0);assert.match(d.body.textContent,/Details still needed: Registration in purchase country/);
  assert.equal(d.querySelector('.tk-challenge'),null);
  await change(view,d.querySelector('textarea'),'A follow-up question.');
  assert.ok(d.querySelector('.tk-challenge'));
  assert.equal(d.querySelector('a').getAttribute('href'),'https://example.test/official');assert.equal(d.querySelector('a[href*="evil.test"]'),null);
  assert.equal(d.querySelector('a[href="https://example.test/withholding"]')?.textContent,'Official withholding source');
  await act(async()=>{[...d.querySelectorAll('button')].find(button=>button.textContent==='Apply suggested fields').click();});
  assert.deepEqual(applied,[{item:'Office stationery'}]);
  await act(async()=>{view.root.render(React.createElement(components.AssistantPanel,{facts:{...facts,country:'GB'},config:{ai:{chatAvailable:true},turnstileSiteKey:'synthetic-site-key',countries:[{code:'GB',sources:[{id:'gb-1'}]}]},onPropose:proposal=>applied.push(proposal)}));});
  assert.equal(d.querySelectorAll('.tk-turn:not(.tk-opening)').length,0);
  assert.equal(d.querySelector('input[type="checkbox"]').checked,false);
  assert.equal(requests.filter(row=>row.path==='/api/chat').length,1);
 }finally{await view.cleanup();}
});

test('editing facts during an AI request does not permit a second send or show stale proposals',async()=>{
 let finish,requests=0;
 const response=new Promise(resolve=>{finish=resolve;});
 const config={ai:{chatAvailable:true},turnstileSiteKey:'synthetic-site-key',countries:[{code:'IN',sources:[{id:'in-1'}]}]};
 const facts={mode:'before',country:'IN',businessCountry:'IN'};
 const view=await mount(components.AssistantPanel,{facts,config},async(path)=>{
  if(path==='/api/chat'){requests++;return response;}return Response.json({ok:true});
 },window=>{window.turnstile={render(element,options){options.callback('synthetic-fresh-challenge');return 'widget';},remove(){}};});
 try{
  const d=view.dom.window.document;await change(view,d.querySelector('textarea'),'Help with my invoice.');
  await act(async()=>{d.querySelector('input[type="checkbox"]').click();await new Promise(resolve=>setTimeout(resolve,0));});
  await act(async()=>{d.querySelector('.tk-actions button').click();await new Promise(resolve=>setTimeout(resolve,0));});
  assert.equal(requests,1);
  await act(async()=>{view.root.render(React.createElement(components.AssistantPanel,{facts:{...facts,item:'Changed after sending'},config}));});
  assert.equal(d.querySelector('.tk-actions button').disabled,true);
  await act(async()=>{finish(Response.json({message:'Old response',proposals:{item:'Old invoice'},missingFields:[],sourceIds:[]}));await new Promise(resolve=>setTimeout(resolve,0));});
  assert.doesNotMatch(d.body.textContent,/Old response|Old invoice/);assert.equal(requests,1);
 }finally{finish(Response.json({message:'Old response',proposals:{},sourceIds:[]}));await view.cleanup();}
});

test('dashboard separates an imported evaluation snapshot from public production spending',async()=>{
 const provider={capMicrousd:3000000,spentMicrousd:1200,reservedMicrousd:30100,remainingMicrousd:2968700,attempts:2,attemptsByKind:{preflight:1,generation:1,metadata:0,compute:0,cleanup:0},inputTokens:800,outputTokens:100,billingUnknown:1,paused:true,priceVersions:['evaluation-price-v1']};
 const snapshot={campaignId:'tikdam-v1-eval-2026-11-01',generatedAt:'2026-11-02T00:00:00.000Z',combined:{capMicrousd:4000000,spentMicrousd:1200,reservedMicrousd:30100,remainingMicrousd:3968700},providers:{meta:provider,modal:{...provider,capMicrousd:500000},baseten:{...provider,capMicrousd:500000}}};
 const view=await mount(components.AdminApp,{},async(path)=>Response.json(path.includes('/overview')?emptyOverview:path.includes('/evaluation')?{snapshot}:{items:[],total:0}));
 try{const text=view.dom.window.document.body.textContent;assert.match(text,/Evaluation snapshot/);assert.match(text,/local evaluation ledger/i);assert.match(text,/not a provider bill/i);assert.match(text,/Meta HTTP attempts/);assert.match(text,/evaluation-price-v1/);assert.match(text,/Unknown billing/);assert.equal(view.dom.window.document.querySelector('.tk-budget .tk-metric-remaining dd').textContent,'$5.00');}
 finally{await view.cleanup();}
});

test('dashboard does not invent evaluation traffic before a snapshot is imported',async()=>{
 const view=await mount(components.AdminApp,{},async(path)=>Response.json(path.includes('/overview')?emptyOverview:path.includes('/evaluation')?{snapshot:null}:{items:[],total:0}));
 try{assert.match(view.dom.window.document.body.textContent,/No evaluation snapshot has been imported/);assert.equal(view.dom.window.document.querySelector('[data-evaluation-provider]'),null);}
 finally{await view.cleanup();}
});

test('Baseten processing consent identifies the actual selected provider',()=>{
 const html=renderToStaticMarkup(React.createElement(components.AssistantPanel,{facts:{mode:'before',country:'IN'},config:{provider:'Baseten',ai:{chatAvailable:true},countries:[{code:'IN',sources:[]}]}}));
 assert.match(html,/Send my messages and case details to Baseten/);assert.match(html,/case details to Baseten/);assert.doesNotMatch(html,/details to Meta for processing/);
});

test('single example stays in the placeholder without sending or granting consent',async()=>{
 const requests=[];
 const view=await mount(components.AssistantPanel,{conversational:true,facts:{mode:'client',country:'IN'},config:{provider:'Baseten',ai:{chatAvailable:true},countries:[{code:'IN',sources:[]}]}},async(path)=>{requests.push(path);return Response.json({ok:true});});
 try{
  const d=view.dom.window.document;
  assert.match(d.querySelector('[role="log"]').textContent,/What work did you do/);
  assert.equal(d.querySelector('.chat-starters'),null);
  assert.match(d.querySelector('textarea').placeholder,/My client paid less than the invoice/);
  assert.equal(d.querySelector('textarea').value,'');
  assert.equal(d.querySelector('.tk-check input').checked,false);
  assert.equal([...d.querySelectorAll('button')].find(x=>x.textContent==='Send question').disabled,true);
  assert.equal(requests.length,0);
 }finally{await view.cleanup();}
});

test('six exchanges stay readable while each provider request has a bounded context',async()=>{
 const requests=[];
 const config={ai:{chatAvailable:true},turnstileSiteKey:'fixture',countries:[]};
 const view=await mount(components.AssistantPanel,{facts:{mode:'before',country:'GB'},config},async(path,options)=>{
  if(path==='/api/chat')requests.push(JSON.parse(options.body));
  return Response.json({message:'Fictional reply',proposals:{}});
 },win=>{win.turnstile={render(el,opts){opts.callback('synthetic');return 'widget';},remove(){}};});
 try {
  const d=view.dom.window.document;
  await act(async()=>d.querySelector('.tk-check input').click());
  for(let i=1;i<=6;i++){
   await change(view,d.querySelector('textarea'),'Question '+i);
   await act(async()=>d.querySelector('.tk-actions button').click());
  }
  assert.equal(requests.length,6);
  assert.equal(requests.at(-1).history.length,7);
  assert.equal(requests.at(-1).history[0].content,'Question 3');
  assert.equal(d.querySelectorAll('.tk-turn').length,12);
  assert.match(d.querySelector('[role="log"]').textContent,/Question 1/);
 }finally{await view.cleanup();}
});

test('verification retry preserves the draft and ignores expired callbacks from a removed widget',async()=>{
 const widgets=[], requests=[];
 const view=await mount(components.AssistantPanel,{facts:{mode:'purchase',country:'IN'},config:{ai:{chatAvailable:true},turnstileSiteKey:'fixture',countries:[]}},async(path)=>{
  requests.push(path);return Response.json({});
 },win=>{win.turnstile={render(el,options){widgets.push(options);return widgets.length;},remove(){}};});
 try{
  const d=view.dom.window.document;
  await change(view,d.querySelector('textarea'),'My fictional purchase');
  await act(async()=>d.querySelector('.tk-check input').click());
  await act(async()=>widgets.at(-1)['error-callback']());
  assert.ok(d.querySelector('.tk-actions button').disabled);
  const old=widgets.at(-1);
  await act(async()=>d.querySelector('.tk-challenge button').click());
  await act(async()=>widgets.at(-1).callback('fresh'));
  await act(async()=>old['expired-callback']());
  assert.equal(d.querySelector('.tk-actions button').disabled,false);
  assert.equal(d.querySelector('textarea').value,'My fictional purchase');
  assert.equal(requests.length,0);
 }finally{await view.cleanup();}
});
