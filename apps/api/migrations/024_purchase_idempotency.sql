ALTER TABLE purchases ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX purchases_workshop_idempotency_key_unique
  ON purchases (workshop_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
