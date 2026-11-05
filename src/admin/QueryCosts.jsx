import React from 'react';

const money = value => Number.isFinite(value) && value >= 0 ? '$'+(value/1000000).toFixed(6) : 'Unavailable';
const time = value => new Intl.DateTimeFormat(undefined, {dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(value))+' UTC';
const billingLabels = {succeeded:'Usage recorded',failed_before_send:'No generation requested',billing_unknown:'Billing unknown',running:'In progress'};

export function QueryCosts({report, offset, onOffset, busy}) {
 const summary = report?.summary;
 return <section className="tk-admin-section" aria-labelledby="tk-costs-title">
  <h2 id="tk-costs-title">Cost of each AI query</h2>
  <p className="tk-note">Uses the UTC date range above. Other activity filters apply to processing jobs. Each row is one admitted AI request. Costs include failed replies when the provider returned token usage. This retained ledger survives processing-log cleanup.</p>
  <p className="tk-note">Estimates use input and output tokens at the recorded rates, rounded up to a millionth of a US dollar. Cached-input discounts are excluded. Provider invoices, credits, taxes and hosting charges are separate.</p>
  {!summary ? <p className="tk-error" role="status">{report?.error || 'Query cost details are unavailable.'}</p> : <>
   <dl className="tk-metrics">
    <div><dt>Estimated AI cost</dt><dd>{money(summary.estimatedMicrousd)}</dd></div>
    <div><dt>Average per recorded query</dt><dd>{money(summary.averageMicrousd)}</dd></div>
    <div><dt>Queries with token usage</dt><dd>{summary.estimatedQueries} / {summary.queries}</dd></div>
    <div><dt>Held allowance</dt><dd>{money(summary.heldMicrousd)}</dd></div>
   </dl>
   <p className="tk-note">The average includes only queries with recorded usage. Billing unknown for {summary.billingUnknown} queries. {summary.failedBeforeSend} requests stopped before generation.</p>
   {summary.estimatedQueries > 0 && <p className="tk-note">Recorded query costs range from {money(summary.minMicrousd)} to {money(summary.maxMicrousd)}.</p>}
   {report.items.length === 0 ? <p className="tk-empty">No AI queries in this date range.</p> : <div className="tk-table-wrap"><table>
    <caption className="tk-visually-hidden">AI query costs, newest first. All times UTC.</caption>
    <thead><tr>{['Time / query','Provider / model','Tokens in / out','Estimated cost / held allowance','Billing / response','Price basis'].map(heading=><th key={heading} scope="col">{heading}</th>)}</tr></thead>
    <tbody>{report.items.map(row=><tr key={row.id}>
     <td className="tk-request-id">{time(row.createdAt)}<small>{row.operation} · {row.id}</small></td>
     <td>{row.provider}<small>{row.model}</small></td>
     <td>{row.inputTokens == null ? 'Unavailable' : `${row.inputTokens.toLocaleString()} / ${row.outputTokens.toLocaleString()}`}</td>
     <td>{row.estimatedMicrousd == null ? 'Cost unknown' : money(row.estimatedMicrousd)}{row.heldMicrousd != null && <small>{money(row.heldMicrousd)} held</small>}</td>
     <td>{billingLabels[row.billingStatus] || row.billingStatus}<small>{row.responseStatus ? `Response ${row.responseStatus.replaceAll('_',' ')}` : 'Processing log unavailable'}</small>{row.errorCode && <small>{row.errorCode}</small>}</td>
     <td>{row.rates ? <>Input ${row.rates.inputUsdPerMillion} / 1M<small>Output ${row.rates.outputUsdPerMillion} / 1M</small></> : 'Historical rate details unavailable'}<small>{row.pricingVersion}</small></td>
    </tr>)}</tbody>
   </table></div>}
   <div className="tk-pagination">
    <button type="button" className="tk-secondary" disabled={busy || offset === 0} onClick={()=>onOffset(Math.max(0,offset-25))}>Previous queries</button>
    <span>{report.total ? `${offset+1}–${Math.min(offset+25,report.total)} of ${report.total}` : '0 queries'}</span>
    <button type="button" className="tk-secondary" disabled={busy || offset+25 >= report.total} onClick={()=>onOffset(offset+25)}>Next queries</button>
   </div>
  </>}
 </section>;
}
