import React,{useState} from 'react';
import {api,ensureSession} from '../api.mjs';
import '../admin.css';

export function FeedbackPanel({mode,country}){
 const [text,setText]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event){
  event.preventDefault();if(busy||!text.trim())return;setBusy(true);setMessage('');setError('');
  try{await ensureSession();await api('/api/feedback',{text:text.trim(),mode,country});setText('');setMessage('Feedback sent. Thank you for helping improve Tikdam.');}
  catch(error){setError(error.message);}finally{setBusy(false);}
 }
 return <details className="tk-feedback"><summary>Share feedback</summary><form onSubmit={submit}><label className="tk-label" htmlFor="tk-feedback-text">What worked, or what was confusing?</label><textarea id="tk-feedback-text" rows={3} maxLength={1000} value={text} onChange={event=>setText(event.target.value)} aria-describedby="tk-feedback-privacy" disabled={busy}/><p id="tk-feedback-privacy" className="tk-note">Do not include invoice details, tax IDs, bank information or other private data. Feedback is visible to the owner and kept for up to 90 days.</p><button className="tk-secondary" type="submit" disabled={busy||!text.trim()}>{busy?'Sending…':'Send feedback'}</button>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="tk-error">{error}</p>}</form></details>;
}
