DO $$
BEGIN
  CREATE ROLE bengkel_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

GRANT bengkel_api TO bengkel_app;
GRANT USAGE ON SCHEMA public, app TO bengkel_api;
GRANT SELECT ON products TO bengkel_api;
GRANT SELECT, INSERT ON sales TO bengkel_api;
GRANT INSERT ON sale_items, payments TO bengkel_api;

CREATE OR REPLACE FUNCTION app.apply_inventory_movement(
  target_workshop_id uuid,
  target_product_id uuid,
  stock_change numeric,
  movement_reason inventory_movement_reason,
  related_sale_id uuid,
  note text,
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
     OR NOT app.has_workshop_access(target_workshop_id) THEN
    RAISE EXCEPTION 'Workshop access denied';
  END IF;

  SELECT stock_on_hand INTO existing_stock
  FROM products
  WHERE id = target_product_id AND workshop_id = target_workshop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found for workshop';
  END IF;

  resulting_stock := existing_stock + stock_change;
  IF resulting_stock < 0 THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  UPDATE products
  SET stock_on_hand = resulting_stock, updated_at = now()
  WHERE id = target_product_id;

  INSERT INTO inventory_movements (
    workshop_id, product_id, sale_id, previous_stock, quantity_change,
    new_stock, reason, reason_note, created_by
  ) VALUES (
    target_workshop_id, target_product_id, related_sale_id, existing_stock, stock_change,
    resulting_stock, movement_reason, note, actor_id
  ) RETURNING * INTO movement;

  RETURN movement;
END;
$$;

REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_workshop_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.has_workshop_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.apply_inventory_movement(uuid, uuid, numeric, inventory_movement_reason, uuid, text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.current_workshop_id() TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.has_workshop_access(uuid) TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.apply_inventory_movement(uuid, uuid, numeric, inventory_movement_reason, uuid, text, uuid) TO bengkel_api;
