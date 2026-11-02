import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {countries,indiaCheckDefinitions,getCoverage} from '../server/catalog.mjs';
import {planPurchase,assess} from '../server/domain.mjs';
import {factsSchema} from '../server/schema.mjs';

async function mountApp(fn){
 const bundle=await build({entryPoints:[new URL('../src/App.jsx',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'node',external:['react','react-dom','react-dom/client'],loader:{'.css':'empty'}});
 const path=new URL('../.wrangler/app-test.cjs',import.meta.url);await mkdir(new URL('../.wrangler/',import.meta.url),{recursive:true});await writeFile(path,bundle.outputFiles[0].text);
 const require=createRequire(import.meta.url);delete require.cache[path.pathname];const App=require(path.pathname).default;
 const dom=new JSDOM('<div id="root"></div>',{url:'https://tikdam.xyz/'});
 const previous={};for(const k of ['window','document','navigator','HTMLElement','Event','MouseEvent','fetch','IS_REACT_ACT_ENVIRONMENT'])previous[k]=Object.getOwnPropertyDescriptor(globalThis,k);
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 dom.window.scrollTo=()=>{};
 globalThis.fetch=async(path,options)=>{
  if(String(path).endsWith('/api/config'))return Response.json({countries,coverage:getCoverage(),indiaCheckDefinitions,ai:{enabled:false,reason:'AI is paused to protect credits.'},modelConfigured:false});
  if(['/api/plan','/api/assess'].includes(path)){const f=factsSchema.parse(JSON.parse(options.body));return Response.json(path==='/api/plan'?planPurchase(f):assess(f));}
  return Response.json({ok:true});
 };
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>{root.render(React.createElement(App));});await fn(dom.window.document,async(text)=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(text));assert.ok(b,`Button ${text} exists`);await act(async()=>b.click());});}
 finally{await act(async()=>root.unmount());dom.window.close();for(const [k,v]of Object.entries(previous))v?Object.defineProperty(globalThis,k,v):delete globalThis[k];}
}

test('India purchase exposes statutory checks as unanswered user assertions',()=>mountApp(async(document,click)=>{
 await click('Review a bill');
 assert.match(document.body.textContent,/GSTR-2B/);
 for(const field of indiaCheckDefinitions){const label=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(field.label));assert.ok(label,field.key);assert.equal(label.querySelector('select').value,'unknown');}
 assert.match(document.body.textContent,/not.*government.*verif|user.*assert|your.*preparer/i);
}));

test('landing page states India limits and leads into purchase review',()=>mountApp(async(document,click)=>{
 assert.match(document.querySelector('.landing-hero').textContent,/office stationery/);
 assert.match(document.querySelector('.landing-hero').textContent,/does not check GST portals/);
 await click('Review a purchase bill');
 assert.equal(document.querySelector('.mode-tabs button.selected strong').textContent,'Review a bill');
 assert.match(document.querySelector('.workspace').textContent,/India stationery checks/);
}));

test('privacy explains metadata retention and paused AI instead of claiming no analytics',()=>mountApp(async(document,click)=>{
 await click('Your data');
 assert.match(document.body.textContent,/30 days/);assert.match(document.body.textContent,/90 days/);assert.match(document.body.textContent,/spend|budget/i);
 assert.doesNotMatch(document.body.textContent,/There is no analytics/);
}));
test('before-buy workflow builds a source-linked checklist while AI is paused',()=>mountApp(async(document,click)=>{
 await click('Build my buying checklist');
 assert.match(document.body.textContent,/Get the billing right/);assert.match(document.body.textContent,/Copy invoice request/);assert.ok(document.querySelector('.sources a[href^="https://"]'));
}));
test('reviewing an example requires confirmation and shows conditional input credit',()=>mountApp(async(document,click)=>{
 await click('Review a bill');await click('Use an example');
 assert.match(document.body.textContent,/not AI extraction|not an OCR result/);
 await click('Find my next step');assert.match(document.body.textContent,/Amount not determined/);
 await click('Edit answers');
 const check=[...document.querySelectorAll('label')].find(x=>x.textContent.includes('I reviewed these invoice details')).querySelector('input');
 await act(async()=>check.click());await click('Find my next step');
 assert.match(document.body.textContent,/GBP 20.00/);assert.match(document.body.textContent,/Conditional estimate/);
 await click('Clear session');assert.doesNotMatch(document.body.textContent,/GBP 20.00/);
}));
test('client workflow separates payment evidence from refund entitlement',()=>mountApp(async(document,click)=>{
 await click('Check a client payment');await click('Use an example');await click('Find my next step');
 assert.match(document.body.textContent,/Copy certificate request/);assert.match(document.body.textContent,/Amount not determined/);assert.match(document.body.textContent,/payment shortfall|payment gap/i);
}));
