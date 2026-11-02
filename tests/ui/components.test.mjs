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
 const html=renderToStaticMarkup(React.createElement(components.AssistantPanel,{facts:{mode:'before',country:'IN'},config:{ai:{chatAvailable:false,reason:'AI is paused to preserve credits.'}}}));
 assert.match(html,/AI is paused to preserve credits/);assert.doesNotMatch(html,/Send question/);assert.match(html,/cannot confirm an invoice/);
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

const emptyOverview={settings:{aiEnabled:false,campaignCapMicrousd:5000000,dailyCapMicrousd:1000000,dailyCallCap:10,maxInFlight:1},usage:{spentMicrousd:0,reservedMicrousd:0,remainingMicrousd:5000000,inputTokens:0,outputTokens:0,billingUnknown:0},totals:{started:0,completed:0,failed:0},byCountry:[],byMode:[]};
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
 try{const d=view.dom.window.document;assert.match(d.body.textContent,/owner login/);assert.equal(d.querySelector('.tk-metrics'),null);assert.equal(d.querySelector('a[href="/admin"]').textContent,'Open owner login');}
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
 const view=await mount(components.AssistantPanel,{facts,config:{ai:{chatAvailable:true},turnstileSiteKey:'synthetic-site-key',countries:[{sources:[{id:'in-1',title:'Official source',url:'https://example.test/official'}]}],clientSources:[{id:'in-client-1',title:'Official withholding source',url:'https://example.test/withholding'}]},onPropose:proposal=>applied.push(proposal)},async(path,options)=>{
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
  assert.equal(applied.length,0);assert.match(d.body.textContent,/Details still needed: registration/);
  assert.equal(d.querySelector('a').getAttribute('href'),'https://example.test/official');assert.equal(d.querySelector('a[href*="evil.test"]'),null);
  assert.equal(d.querySelector('a[href="https://example.test/withholding"]')?.textContent,'Official withholding source');
  await act(async()=>{[...d.querySelectorAll('button')].find(button=>button.textContent==='Apply suggested fields').click();});
  assert.deepEqual(applied,[{item:'Office stationery'}]);
  await act(async()=>{view.root.render(React.createElement(components.AssistantPanel,{facts:{...facts,country:'GB'},config:{ai:{chatAvailable:true},turnstileSiteKey:'synthetic-site-key'},onPropose:proposal=>applied.push(proposal)}));});
  assert.equal(d.querySelectorAll('.tk-turn').length,0);
  assert.equal(d.querySelector('input[type="checkbox"]').checked,false);
  assert.equal(requests.filter(row=>row.path==='/api/chat').length,1);
 }finally{await view.cleanup();}
});

test('editing facts during an AI request does not permit a second send or show stale proposals',async()=>{
 let finish,requests=0;
 const response=new Promise(resolve=>{finish=resolve;});
 const config={ai:{chatAvailable:true},turnstileSiteKey:'synthetic-site-key'};
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
