import React,{useEffect,useRef,useState} from 'react';
import {api} from '../api.mjs';
import {TurnstileChallenge} from './TurnstileChallenge.jsx';
import '../admin.css';

export function AssistantPanel({facts,result,config,onPropose,conversational=false,onReview,context}){
 const [draft,setDraft]=useState(''),[history,setHistory]=useState([]),[pending,setPending]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[consent,setConsent]=useState(false),[challenge,setChallenge]=useState(''),[resetKey,setResetKey]=useState(0);
 const generation=useRef(0);
 const sending=useRef(false);
 const conversation=useRef(null);
 const followLatest=useRef(true);
 useEffect(()=>{
  const log=conversation.current;
  if(log && followLatest.current) log.scrollTop=log.scrollHeight;
 },[history,busy]);
 useEffect(()=>{generation.current++;setPending(null);},[facts,result]);
 useEffect(()=>{generation.current++;setHistory([]);setDraft('');setPending(null);setConsent(false);setChallenge('');setResetKey(key=>key+1);setError('');},[facts?.mode,facts?.country,facts?.businessCountry,facts?.legalName,config?.provider]);
 useEffect(()=>()=>{generation.current++;},[]);
 const provider=config?.provider==='Baseten'?'Baseten':'Meta';
 const opening=facts.mode==='client'?'What work did you do, and what looks different about the payment you received?':facts.mode==='purchase'?'What did you buy, and how will you use it for your work?':'What are you planning to buy, and how will it help your work?';
 const starters=facts.mode==='client'?['My client paid less than the invoice.','I need proof of tax deducted.']:facts.mode==='purchase'?['I bought a laptop for work.','My invoice has the wrong buyer details.']:['I’m planning to buy a work laptop.','I need stationery for my business.'];
 const reviewed=Boolean(config?.countries?.find(country=>country.code===facts?.country)?.sources?.length);
 const enabled=Boolean(config?.ai?.chatAvailable);
 const needsChallenge=consent&&(!pending||Boolean(draft.trim())||Boolean(result));
 const sources=[...(config?.countries||[]).flatMap(country=>country.sources||[]),...(config?.clientSources||[])];
 async function send(purpose='intake'){
  const content=purpose==='explain'?'Explain the current supported result and its missing information using the supplied sources.':draft.trim();
  if(!enabled||sending.current||!consent||!challenge||!content)return;
  sending.current=true;
  followLatest.current=true;
  const version=generation.current;setBusy(true);setError('');setPending(null);
  const userTurn={role:'user',content};
  const next=[...history,userTurn].slice(-7).map(turn=>({...turn,content:turn.content.slice(0,1000)}));
  try{
   const answer=await api('/api/chat',{purpose,facts,history:next},{paid:true,challengeToken:challenge,headers:{'X-AI-Provider':provider==='Baseten'?'baseten':'meta'}});
   if(version!==generation.current)return;
   setHistory(previous=>[...previous,userTurn,{role:'assistant',content:answer.message}]);setPending(answer);setDraft('');
  }catch(error){if(version===generation.current)setError(error.message);}
  finally{sending.current=false;setBusy(false);setChallenge('');setResetKey(key=>key+1);}
 }
 return <section className={`tk-assistant${conversational?' conversation-primary':''}`} aria-labelledby="tk-assistant-title">
  <div className="tk-section-heading"><h2 id="tk-assistant-title" tabIndex={-1}>Ask Tikdam</h2><span className="tk-tag">{provider==='Baseten'?'Muse Spark Open · Baseten':'Meta Muse'}</span></div>
  {context}
  {!conversational&&<p>Describe the purchase or client payment. Tikdam can ask for missing details and suggest form updates for you to review.</p>}
  {!enabled?<><p className="tk-notice" role="status">{config?.ai?.reason||'AI is paused. Complete the form manually to continue.'}</p>{onReview&&<button className="tk-primary" onClick={onReview}>Continue with details</button>}</>:<>
   {!reviewed&&<p className="tk-notice">Local tax rules have not been reviewed for this location. The assistant can help prepare questions and evidence, but cannot determine a tax benefit or filing route.</p>}
   <div className="tk-conversation" ref={conversation} tabIndex={0} onScroll={event=>{
    const log=event.currentTarget;
    followLatest.current=log.scrollHeight-log.scrollTop-log.clientHeight<32;
   }} role="log" aria-label="Conversation" aria-live="polite">{history.length===0?<div className="tk-turn tk-opening"><strong>Tikdam</strong><p>{opening}</p><small>You can say “I’m not sure” when you don’t know a detail.</small></div>:history.map((turn,index)=><div key={index} className={`tk-turn tk-turn-${turn.role}`}><strong>{turn.role==='user'?'You':'Tikdam'}</strong><p>{turn.content}</p></div>)}{busy&&<p role="status">Tikdam is reviewing your message…</p>}</div>
   {conversational&&history.length===0&&<div className="chat-starters" aria-label="Example starting messages">{starters.map(text=><button type="button" key={text} disabled={busy} onClick={()=>{setDraft(text);document.getElementById('tk-question')?.focus();}}>{text}</button>)}</div>}
   {history.length>6&&<small>Earlier messages stay visible here. Tikdam uses your latest messages and reviewed details for each reply.</small>}
   <label className="tk-label" htmlFor="tk-question">Your question</label>
   <textarea id="tk-question" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={1000} rows={3} placeholder="Tell Tikdam what you are planning or checking." disabled={busy}/>
   <label className="tk-check"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>Send recent messages and case details to {provider}. Tikdam withholds the names, tax IDs, billing address and invoice number entered in their form fields. Leave private identifiers out of your messages. Tikdam retains a topic label for up to the cleanup window and a separate spending record.</span></label>
   {needsChallenge&&<TurnstileChallenge siteKey={config.turnstileSiteKey} action="chat" onToken={setChallenge} resetKey={resetKey}/>}
   <div className="tk-actions"><button type="button" className="tk-primary" disabled={busy||!draft.trim()||!consent||!challenge} onClick={()=>send('intake')}>{busy?'Sending…':'Send question'}</button>{result&&<button type="button" className="tk-secondary" disabled={busy||!consent||!challenge} onClick={()=>send('explain')}>Explain current result</button>}</div>
   {pending&&Object.keys(pending.proposals||{}).length>0&&<div className="tk-proposals"><h3>Suggested form updates</h3><dl>{Object.entries(pending.proposals).map(([key,value])=><React.Fragment key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></React.Fragment>)}</dl><p>Applying these suggestions will clear invoice confirmation. Review the form before checking a benefit.</p><button type="button" className="tk-secondary" onClick={()=>{onPropose?.(pending.proposals);setPending(null);}}>Apply suggested fields</button></div>}
   {pending?.missingFields?.length>0&&<p className="tk-note">Details still needed: {pending.missingFields.map(field=>field.replace(/([A-Z])/g,' $1')).join(', ')}. Reply in the chat{onReview?' or review your details.':'.'}</p>}
   {onReview&&pending&&<button className="tk-secondary" type="button" onClick={onReview}>Review details and next steps</button>}
   {pending?.sourceIds?.length>0&&<ul className="tk-source-list">{pending.sourceIds.map(id=>sources.find(source=>source.id===id)).filter(Boolean).map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>}
  </>}
  {error&&<p className="tk-error" role="alert">{error}</p>}
  <small>Rules and calculators determine supported amounts. The assistant cannot confirm an invoice or submit a claim.</small>
 </section>;
}
