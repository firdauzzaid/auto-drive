ALTER TABLE sales ADD COLUMN idempotency_key text;
CREATE UNIQUE INDEX sales_workshop_idempotency_key_unique
  ON sales (workshop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
