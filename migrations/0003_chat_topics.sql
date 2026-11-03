ALTER TABLE jobs ADD COLUMN topic TEXT CHECK(topic IN (
  'purchase_planning','buyer_details','seller_verification','invoice_correction',
  'input_tax_credit','business_use','client_payment','payment_evidence',
  'records_and_documents','result_explanation','other'
));
CREATE INDEX IF NOT EXISTS jobs_chat_topic_created ON jobs(topic,created_at) WHERE operation='chat';
