CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, name)
);

CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  purchase_number text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id),
  subtotal bigint NOT NULL CHECK (subtotal >= 0),
  total bigint NOT NULL CHECK (total = subtotal),
  notes text,
  completed_by uuid NOT NULL REFERENCES users(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, purchase_number)
);

CREATE TABLE purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES purchases(id),
  product_id uuid NOT NULL REFERENCES products(id),
  name_snapshot text NOT NULL,
  sku_snapshot text,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost bigint NOT NULL CHECK (unit_cost >= 0),
  line_total bigint NOT NULL CHECK (line_total = unit_cost * quantity),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_movements ADD COLUMN purchase_id uuid REFERENCES purchases(id);
ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_purchase_reference_check
  CHECK ((reason = 'purchase') = (purchase_id IS NOT NULL));

CREATE INDEX purchases_workshop_completed_index ON purchases (workshop_id, completed_at DESC);
CREATE INDEX purchase_items_purchase_index ON purchase_items (purchase_id);

CREATE TRIGGER suppliers_touch_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER purchases_touch_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_member ON suppliers FOR ALL
  USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id))
  WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY purchases_member ON purchases FOR ALL
  USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id))
  WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY purchase_items_member ON purchase_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM purchases
    WHERE purchases.id = purchase_items.purchase_id
      AND purchases.workshop_id = app.current_workshop_id()
      AND app.has_workshop_access(purchases.workshop_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM purchases
    WHERE purchases.id = purchase_items.purchase_id
      AND purchases.workshop_id = app.current_workshop_id()
      AND app.has_workshop_access(purchases.workshop_id)
  ));

CREATE FUNCTION app.apply_purchase_movement(
  target_workshop_id uuid,
  target_product_id uuid,
  stock_change numeric,
  related_purchase_id uuid,
  unit_cost bigint,
  actor_id uuid
)
RETURNS inventory_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  existing_stock numeric(14,3);
  resulting_stock numeric(14,3);
  movement inventory_movements;
BEGIN
  IF target_workshop_id IS DISTINCT FROM app.current_workshop_id()
     OR actor_id IS DISTINCT FROM app.current_user_id()
     OR NOT EXISTS (
       SELECT 1 FROM memberships
       WHERE workshop_id = target_workshop_id
         AND user_id = actor_id
         AND role = 'owner'
         AND active
     ) THEN
    RAISE EXCEPTION 'Owner workshop access denied';
  END IF;

  IF stock_change <= 0 THEN
    RAISE EXCEPTION 'Purchase stock change must be positive';
  END IF;

  SELECT stock_on_hand INTO existing_stock
  FROM products
  WHERE id = target_product_id AND workshop_id = target_workshop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found for workshop';
  END IF;

  resulting_stock := existing_stock + stock_change;
  UPDATE products
  SET stock_on_hand = resulting_stock, current_cost = unit_cost, updated_at = now()
  WHERE id = target_product_id;

  INSERT INTO inventory_movements (
    workshop_id, product_id, purchase_id, previous_stock, quantity_change,
    new_stock, reason, created_by
  ) VALUES (
    target_workshop_id, target_product_id, related_purchase_id, existing_stock, stock_change,
    resulting_stock, 'purchase', actor_id
  ) RETURNING * INTO movement;

  RETURN movement;
END;
$$;

REVOKE ALL ON FUNCTION app.apply_purchase_movement(uuid, uuid, numeric, uuid, bigint, uuid) FROM PUBLIC;

GRANT SELECT, INSERT ON suppliers, purchases TO bengkel_api;
GRANT INSERT ON purchase_items TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.apply_purchase_movement(uuid, uuid, numeric, uuid, bigint, uuid) TO bengkel_api;
