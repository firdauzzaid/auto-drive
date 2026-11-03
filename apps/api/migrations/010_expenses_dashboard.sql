CREATE TABLE expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, name)
);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  category_id uuid REFERENCES expense_categories(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  amount bigint NOT NULL CHECK (amount > 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_workshop_occurred_index ON expenses (workshop_id, occurred_at DESC);

CREATE TRIGGER expense_categories_touch_updated_at BEFORE UPDATE ON expense_categories FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER expenses_touch_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY expense_categories_member ON expense_categories FOR ALL
  USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id))
  WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY expenses_member ON expenses FOR ALL
  USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id))
  WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));

GRANT SELECT, INSERT, UPDATE ON expense_categories, expenses TO bengkel_api;
