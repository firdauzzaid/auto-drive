CREATE FUNCTION app.apply_inventory_adjustment(
  target_workshop_id uuid,
  target_product_id uuid,
  stock_change numeric,
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

  IF stock_change = 0 OR char_length(trim(note)) = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity and reason are required';
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
    workshop_id, product_id, previous_stock, quantity_change, new_stock,
    reason, reason_note, created_by
  ) VALUES (
    target_workshop_id, target_product_id, existing_stock, stock_change, resulting_stock,
    'adjustment', trim(note), actor_id
  ) RETURNING * INTO movement;

  INSERT INTO audit_logs (
    workshop_id, actor_id, action, entity_type, entity_id, previous_value, new_value
  ) VALUES (
    target_workshop_id, actor_id, 'inventory.adjusted', 'product', target_product_id,
    jsonb_build_object('stockOnHand', existing_stock),
    jsonb_build_object('stockOnHand', resulting_stock, 'reason', trim(note))
  );

  RETURN movement;
END;
$$;

REVOKE ALL ON FUNCTION app.apply_inventory_adjustment(uuid, uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.apply_inventory_adjustment(uuid, uuid, numeric, text, uuid) TO bengkel_api;
