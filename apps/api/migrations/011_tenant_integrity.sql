ALTER TABLE customers ADD CONSTRAINT customers_id_workshop_key UNIQUE (id, workshop_id);
ALTER TABLE vehicles ADD CONSTRAINT vehicles_id_workshop_key UNIQUE (id, workshop_id);
ALTER TABLE suppliers ADD CONSTRAINT suppliers_id_workshop_key UNIQUE (id, workshop_id);
ALTER TABLE product_categories ADD CONSTRAINT product_categories_id_workshop_key UNIQUE (id, workshop_id);
ALTER TABLE service_categories ADD CONSTRAINT service_categories_id_workshop_key UNIQUE (id, workshop_id);

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_customer_workshop_fkey
  FOREIGN KEY (customer_id, workshop_id) REFERENCES customers (id, workshop_id);
ALTER TABLE sales
  ADD CONSTRAINT sales_customer_workshop_fkey
  FOREIGN KEY (customer_id, workshop_id) REFERENCES customers (id, workshop_id);
ALTER TABLE sales
  ADD CONSTRAINT sales_vehicle_workshop_fkey
  FOREIGN KEY (vehicle_id, workshop_id) REFERENCES vehicles (id, workshop_id);
ALTER TABLE purchases
  ADD CONSTRAINT purchases_supplier_workshop_fkey
  FOREIGN KEY (supplier_id, workshop_id) REFERENCES suppliers (id, workshop_id);
ALTER TABLE products
  ADD CONSTRAINT products_category_workshop_fkey
  FOREIGN KEY (category_id, workshop_id) REFERENCES product_categories (id, workshop_id);
ALTER TABLE services
  ADD CONSTRAINT services_category_workshop_fkey
  FOREIGN KEY (category_id, workshop_id) REFERENCES service_categories (id, workshop_id);

ALTER TABLE vehicles DROP CONSTRAINT vehicles_workshop_id_normalized_plate_key;
CREATE UNIQUE INDEX vehicles_workshop_normalized_plate_unique
  ON vehicles (workshop_id, normalized_plate)
  WHERE normalized_plate IS NOT NULL;

REVOKE UPDATE ON products FROM bengkel_api;
GRANT UPDATE (category_id, name, sku, unit, minimum_stock, selling_price, active) ON products TO bengkel_api;

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
     OR actor_id IS DISTINCT FROM app.current_user_id()
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
