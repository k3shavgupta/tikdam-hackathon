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

async function mountApp(fn,{guided=false,assistant=false}={}){
 const bundle=await build({entryPoints:[new URL('../src/App.jsx',import.meta.url).pathname],bundle:true,write:false,format:'cjs',platform:'node',external:['react','react-dom','react-dom/client'],loader:{'.css':'empty'}});
 const path=new URL('../.wrangler/app-test.cjs',import.meta.url);await mkdir(new URL('../.wrangler/',import.meta.url),{recursive:true});await writeFile(path,bundle.outputFiles[0].text);
 const require=createRequire(import.meta.url);delete require.cache[path.pathname];const App=require(path.pathname).default;
 const dom=new JSDOM('<div id="root"></div>',{url:'https://tikdam.xyz/'});
 const previous={};for(const k of ['window','document','navigator','HTMLElement','Event','MouseEvent','fetch','IS_REACT_ACT_ENVIRONMENT'])previous[k]=Object.getOwnPropertyDescriptor(globalThis,k);
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,MouseEvent:dom.window.MouseEvent,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
 dom.window.scrollTo=()=>{};
 if(assistant)dom.window.turnstile={render(element,options){options.callback('synthetic-challenge');return 'fixture';},remove(){}};
 globalThis.fetch=async(path,options)=>{
  if(assistant && path==='/api/chat')return Response.json({message:'Review your purchase country.',proposals:{country:'GB'},missingFields:[],sourceIds:[]});
  if(String(path).endsWith('/api/config'))return Response.json({countries,coverage:getCoverage(),indiaCheckDefinitions,ai:{enabled:assistant,chatAvailable:assistant,reason:'AI is paused to protect credits.'},turnstileSiteKey:assistant?'fixture':null,modelConfigured:false});
  if(['/api/plan','/api/assess'].includes(path)){const f=factsSchema.parse(JSON.parse(options.body));return Response.json(path==='/api/plan'?planPurchase(f):assess(f));}
  return Response.json({ok:true});
 };
 const root=createRoot(document.getElementById('root'));
 try{await act(async()=>{root.render(React.createElement(App));});if(!guided){await act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Review details').click();});}await fn(dom.window.document,async(text)=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes(text));assert.ok(b,`Button ${text} exists`);await act(async()=>b.click());});}
 finally{await act(async()=>root.unmount());dom.window.close();for(const [k,v]of Object.entries(previous))v?Object.defineProperty(globalThis,k,v):delete globalThis[k];}
}

test('India purchase exposes statutory checks as unanswered user assertions',()=>mountApp(async(document,click)=>{
 await click('Review a bill');
 assert.match(document.body.textContent,/GSTR-2B/);
 for(const field of indiaCheckDefinitions){const label=[...document.querySelectorAll('label')].find(x=>x.textContent.includes(field.label));assert.ok(label,field.key);assert.equal(label.querySelector('select').value,'unknown');}
 assert.match(document.body.textContent,/not.*government.*verif|user.*assert|your.*preparer/i);
}));

test('checker uses shared brand and keeps worldwide scope in the purchase flow',()=>mountApp(async(document,click)=>{
 assert.match(document.querySelector('.intro h1').textContent,/Let’s work it out/);
 assert.equal(document.querySelector('.brand img').getAttribute('src'),'/brand/logo.svg');
 assert.equal(document.querySelector('.brand').getAttribute('href'),'/');
 assert.match(document.querySelector('.app-scope').textContent,/250 locations/);
 await click('Review a bill');
 assert.equal(document.querySelector('.change-task button[aria-pressed="true"]').textContent,'Review a bill');
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
test('unreviewed countries can be selected without showing tax eligibility',()=>mountApp(async(document,click)=>{
 await click('Review a bill');
 const country=[...document.querySelectorAll('label.field')].find(label=>label.textContent.includes('Purchase / tax country')).querySelector('select');
 assert.equal(country.options.length,250);
 await act(async()=>{country.value='FR';country.dispatchEvent(new window.Event('change',{bubbles:true}));});
 assert.equal(country.value,'FR');
 assert.match(document.body.textContent,/local rules not reviewed|not reviewed this location/i);
 assert.doesNotMatch(document.body.textContent,/EUR 20\.00/);
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

test('chat is available immediately and location choices update the check',()=>mountApp(async(document,click)=>{
 assert.equal(document.querySelector('.quick-setup'),null);
 assert.ok(document.querySelector('.tk-assistant'));
 assert.equal(document.querySelector('.workspace').hidden,true);
 assert.equal(document.querySelector('.chat-context select').options.length,3);
 const country=document.querySelector('[aria-label="Purchase country"]');
 await act(async()=>{country.value='FR';country.dispatchEvent(new window.Event('change',{bubbles:true}));});
 const business=document.querySelector('[aria-label="Business country"]');
 assert.equal(business.value,'IN');
 await act(async()=>{business.value='GB';business.dispatchEvent(new window.Event('change',{bubbles:true}));});
 assert.ok(document.querySelector('.conversation-primary'));
 assert.match(document.querySelector('.conversation-receipt').textContent,/France/);
 assert.match(document.querySelector('.conversation-receipt').textContent,/United Kingdom/);
 assert.equal(document.querySelector('.workspace').hidden,true);
 assert.equal(document.querySelector('.result-main'),null);
 await click('Review details');
 assert.equal(document.querySelector('.workspace').hidden,false);
 assert.equal([...document.querySelectorAll('.field')].find(x=>x.textContent.includes('Purchase / tax country'))?.querySelector('select')?.value??'FR','FR');
 await click('Back to conversation');assert.equal(document.querySelector('.workspace').hidden,true);
 await click('Clear session');assert.ok(document.querySelector('.tk-assistant'));assert.equal(document.querySelector('[aria-label="Purchase country"]').value,'IN');
},{guided:true}));

test('task and country choices update the opening prompt without a setup screen',()=>mountApp(async(document)=>{
 const task=document.querySelector('[aria-label="What would you like help with?"]');
 await act(async()=>{task.value='client';task.dispatchEvent(new window.Event('change',{bubbles:true}));});
 const select=document.querySelector('[aria-label="Payment country"]');
 await act(async()=>{select.value='SG';select.dispatchEvent(new window.Event('change',{bubbles:true}));});
 const text=document.querySelector('.conversation-receipt').textContent;
 assert.match(text,/Check a client payment/);assert.equal((text.match(/Singapore/g)||[]).length,1);
 assert.match(document.querySelector('.tk-opening').textContent,/What work did you do/);
 assert.equal(document.querySelector('.workspace').hidden,true);
},{guided:true,assistant:true}));

test('unreviewed location warning appears beside the first message',()=>mountApp(async(document)=>{
 const country=document.querySelector('[aria-label="Purchase country"]');
 await act(async()=>{country.value='FR';country.dispatchEvent(new window.Event('change',{bubbles:true}));});
 assert.match(document.querySelector('.tk-notice').textContent,/Local tax rules have not been reviewed/);
},{guided:true,assistant:true}));

test('applying a country suggestion updates the receipt and invoice currency together',()=>mountApp(async(document,click)=>{
 const task=document.querySelector('[aria-label="What would you like help with?"]');
 await act(async()=>{task.value='purchase';task.dispatchEvent(new window.Event('change',{bubbles:true}));});
 await act(async()=>document.querySelector('.chat-starters button').click());
 await act(async()=>document.querySelector('.tk-check input').click());
 await click('Send question');
 assert.match(document.querySelector('.conversation-receipt').textContent,/Purchase inIndia/);
 await click('Apply suggested fields');
 const receipt=document.querySelector('.conversation-receipt');
 assert.match(receipt.textContent,/Purchase inUnited KingdomBusiness based inIndia/);
 await click('Review details');
 const currency=[...document.querySelectorAll('label.field')].find(label=>label.textContent.includes('Currency'));
 assert.equal(currency.querySelector('input,select').value,'GBP');
},{guided:true,assistant:true}));
