CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (char_length(trim(action)) > 0),
  entity_type text NOT NULL CHECK (char_length(trim(entity_type)) > 0),
  entity_id uuid NOT NULL,
  previous_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_workshop_created_index ON audit_logs (workshop_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_member ON audit_logs FOR ALL
  USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id))
  WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));

GRANT SELECT ON sale_items TO bengkel_api;
GRANT UPDATE (status, voided_by, voided_at, void_reason, updated_at) ON sales TO bengkel_api;
GRANT SELECT, INSERT ON audit_logs TO bengkel_api;
