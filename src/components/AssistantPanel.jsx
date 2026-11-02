import React,{useEffect,useRef,useState} from 'react';
import {api} from '../api.mjs';
import {TurnstileChallenge} from './TurnstileChallenge.jsx';
import '../admin.css';

export function AssistantPanel({facts,result,config,onPropose}){
 const [draft,setDraft]=useState(''),[history,setHistory]=useState([]),[pending,setPending]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[consent,setConsent]=useState(false),[challenge,setChallenge]=useState(''),[resetKey,setResetKey]=useState(0);
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setPending(null);},[facts,result]);
 useEffect(()=>{generation.current++;setHistory([]);setDraft('');setPending(null);setConsent(false);setChallenge('');setResetKey(key=>key+1);setError('');},[facts?.mode,facts?.country,facts?.businessCountry,facts?.legalName]);
 useEffect(()=>()=>{generation.current++;},[]);
 const reviewed=Boolean(config?.countries?.find(country=>country.code===facts?.country)?.sources?.length);
 const enabled=Boolean(config?.ai?.chatAvailable&&reviewed);
 const sources=[...(config?.countries||[]).flatMap(country=>country.sources||[]),...(config?.clientSources||[])];
 async function send(purpose='intake'){
  const content=purpose==='explain'?'Explain the current supported result and its missing information using the supplied sources.':draft.trim();
  if(!enabled||busy||!consent||!challenge||!content)return;
  const version=generation.current;setBusy(true);setError('');setPending(null);
  const next=[...history,{role:'user',content}].slice(-7).map(turn=>({...turn,content:turn.content.slice(0,1000)}));
  try{
   const answer=await api('/api/chat',{purpose,facts,history:next},{paid:true,challengeToken:challenge});
   if(version!==generation.current)return;
   setHistory([...next,{role:'assistant',content:answer.message}].slice(-8));setPending(answer);setDraft('');
  }catch(error){if(version===generation.current)setError(error.message);}
  finally{setBusy(false);setChallenge('');setResetKey(key=>key+1);}
 }
 return <section className="tk-assistant" aria-labelledby="tk-assistant-title">
  <div className="tk-section-heading"><h2 id="tk-assistant-title">Ask Tikdam</h2><span className="tk-tag">Meta Muse</span></div>
  <p>Describe the purchase or client payment. Tikdam can ask for missing details and suggest form updates for you to review.</p>
  {!enabled?<p className="tk-notice" role="status">{!reviewed?'AI questions are available only for countries with reviewed sources. Use the manual evidence checklist here.':config?.ai?.reason||'AI is paused. Complete the form manually to continue.'}</p>:<>
   <div className="tk-conversation" role="log" aria-label="Conversation" aria-live="polite">{history.length===0?<p className="tk-note">For example: “I am buying a laptop for my freelance work. Which billing details should I prepare?”</p>:history.map((turn,index)=><div key={index} className={`tk-turn tk-turn-${turn.role}`}><strong>{turn.role==='user'?'You':'Tikdam'}</strong><p>{turn.content}</p></div>)}</div>
   <label className="tk-label" htmlFor="tk-question">Your question</label>
   <textarea id="tk-question" value={draft} onChange={event=>setDraft(event.target.value)} maxLength={1000} rows={3} placeholder="Tell Tikdam what you are planning or checking." disabled={busy}/>
   <label className="tk-check"><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>Send this conversation and the entered form details to Meta for processing. Avoid bank, card and account information.</span></label>
   {consent&&<TurnstileChallenge siteKey={config.turnstileSiteKey} action="chat" onToken={setChallenge} resetKey={resetKey}/>}
   <div className="tk-actions"><button type="button" className="tk-primary" disabled={busy||!draft.trim()||!consent||!challenge} onClick={()=>send('intake')}>{busy?'Sending…':'Send question'}</button>{result&&<button type="button" className="tk-secondary" disabled={busy||!consent||!challenge} onClick={()=>send('explain')}>Explain current result</button>}</div>
   {pending&&Object.keys(pending.proposals||{}).length>0&&<div className="tk-proposals"><h3>Suggested form updates</h3><dl>{Object.entries(pending.proposals).map(([key,value])=><React.Fragment key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></React.Fragment>)}</dl><p>Applying these suggestions will clear invoice confirmation. Review the form before checking a benefit.</p><button type="button" className="tk-secondary" onClick={()=>{onPropose?.(pending.proposals);setPending(null);}}>Apply suggested fields</button></div>}
   {pending?.missingFields?.length>0&&<p className="tk-note">Details still needed: {pending.missingFields.map(field=>field.replace(/([A-Z])/g,' $1')).join(', ')}. Check these in the form.</p>}
   {pending?.sourceIds?.length>0&&<ul className="tk-source-list">{pending.sourceIds.map(id=>sources.find(source=>source.id===id)).filter(Boolean).map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>}
  </>}
  {error&&<p className="tk-error" role="alert">{error}</p>}
  <small>Rules and calculators determine supported amounts. The assistant cannot confirm an invoice or submit a claim.</small>
 </section>;
}
