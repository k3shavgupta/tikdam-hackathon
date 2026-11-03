// Fixed labels only. Visitor text and extracted identifiers never enter storage.
export const chatTopics = [
  'purchase_planning',
  'buyer_details',
  'seller_verification',
  'invoice_correction',
  'input_tax_credit',
  'business_use',
  'client_payment',
  'payment_evidence',
  'records_and_documents',
  'result_explanation',
  'other',
];

export function classifyChatTopic({ purpose, facts, history }) {
  if (purpose === 'explain') return 'result_explanation';
  const message = [...history].reverse().find(turn => turn.role === 'user')?.content || '';
  const text = message.toLowerCase();
  if (/\b(wrong|incorrect|mistake|correct|change|amend|missing)\b.{0,50}\b(invoice|bill|gstin|name|address)\b|\b(invoice|bill)\b.{0,50}\b(wrong|incorrect|mistake|correct|change|amend|missing)\b/.test(text)) return 'invoice_correction';
  if (/\b(seller|supplier|vendor|merchant|counterparty)\b.{0,45}\b(verify|valid|genuine|registered|gstin|check|fake)\b|\b(verify|check)\b.{0,45}\b(seller|supplier|vendor|merchant|counterparty)\b/.test(text)) return 'seller_verification';
  if (/\b(buyer|recipient|legal name|business name|whose name|my name|company name)\b/.test(text)) return 'buyer_details';
  if (/\b(itc|input tax|tax credit|claim|refund|deductib|eligib|gst credit)\b/.test(text)) return 'input_tax_credit';
  if (/\b(business use|personal use|work use|business purpose|used for work)\b/.test(text)) return 'business_use';
  if (/\b(tds|withhold|deducted|client paid|client payment|paid less|payment short|less than the invoice)\b/.test(text)) return 'client_payment';
  if (/\b(payment proof|payment receipt|certificate|form 16a|remittance|bank proof)\b/.test(text)) return 'payment_evidence';
  if (/\b(document|record|evidence|paperwork|receipt|invoice copy|checklist)\b/.test(text)) return 'records_and_documents';
  if (/\b(buy|purchase|planning|quote|price|cost|laptop|stationery)\b/.test(text)) return 'purchase_planning';
  return facts.mode === 'client' ? 'client_payment' : 'other';
}
