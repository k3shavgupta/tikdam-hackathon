import React, {useState} from 'react';

export function QuickSetup({facts, countries, coverage, modes, onStart}) {
  const [task,setTask]=useState(facts.mode);
  const [country,setCountry]=useState(facts.country);
  const [businessCountry,setBusinessCountry]=useState(facts.businessCountry);
  const [sameCountry,setSameCountry]=useState(facts.country===facts.businessCountry);
  function changeCountry(value){setCountry(value);if(sameCountry)setBusinessCountry(value);}
  const dateFormat = new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
  const selected = coverage?.find(row => row.code === country);
  let scope = 'We can help you gather records and prepare questions. We haven’t reviewed local tax rules for this location.';
  if (selected && selected.readiness !== 'unreviewed') {
    if (task === 'client') scope = 'We can help you compare the invoice with the payment and request evidence for the difference.';
    else if (task === 'before') scope = 'You’ll get a buying checklist with billing details to request and records to keep.';
    else if (selected.purchaseEstimate === 'conditional_narrow' && selected.transactionWindow && (sameCountry || businessCountry === country)) {
      const {from, through} = selected.transactionWindow;
      scope = `Some domestic bills dated ${dateFormat.format(new Date(from))} to ${dateFormat.format(new Date(through))} qualify for an estimate. For other dates, we’ll help you gather evidence.`;
    }
    else scope = 'You’ll get an evidence checklist and questions for your preparer. This check does not calculate an amount.';
  }
  return <section className="quick-setup" aria-labelledby="setup-title">
    <div className="setup-intro">
      <span className="setup-kicker">A few details. Then let’s talk.</span>
      <h1 id="setup-title">What are you<br/>figuring out?</h1>
      <p>Tell us where you’re starting. Tikdam will help you work through the rest in a conversation.</p>
      <div className="setup-receipt"><img src="/brand/icon.svg" alt=""/><strong>Your next step, on paper.</strong><p>A buying checklist, a bill review, or questions to ask your client. Keep a copy when you’re done.</p></div>
    </div>
    <form className="setup-form" onSubmit={event=>{event.preventDefault();onStart({mode:task,country,businessCountry:sameCountry?country:businessCountry});}}>
      <fieldset><legend>What would you like help with?</legend><div className="setup-tasks">{modes.map(([id,title,description,icon])=><label key={id} className={task===id?'active':''}><input type="radio" name="setup-task" value={id} checked={task===id} onChange={()=>setTask(id)}/><span className="setup-task-icon" aria-hidden="true">{icon}</span><span><strong>{title}</strong><small>{description}</small></span></label>)}</div></fieldset>
      <label className="field"><span>{task==='client'?'Which country is the payment from?':'Which country is the purchase in?'}</span><select value={country} onChange={event=>changeCountry(event.target.value)} required>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
      <fieldset className="setup-business"><legend>Where is your business based?</legend><label className="setup-same"><input type="checkbox" checked={sameCountry} onChange={event=>{setSameCountry(event.target.checked);if(event.target.checked)setBusinessCountry(country);}}/> In the same country</label>{!sameCountry&&<label className="field"><span>Business country</span><select value={businessCountry} onChange={event=>setBusinessCountry(event.target.value)} required>{countries.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</select></label>}</fieldset>
      <div className="setup-coverage" role="status"><strong>{selected?.name || 'Your location'}</strong><p>{scope}</p></div>
      <button className="primary setup-start" type="submit">Continue to chat <span aria-hidden="true">↗</span></button>
      <p className="setup-note">No account needed. Nothing is sent to an AI provider until you choose to send a message.</p>
    </form>
  </section>;
}
