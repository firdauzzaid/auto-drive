CREATE FUNCTION app.lock_products(
  target_workshop_id uuid,
  product_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  name text,
  sku text,
  stock_on_hand numeric,
  selling_price bigint,
  current_cost bigint,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  IF target_workshop_id IS DISTINCT FROM app.current_workshop_id()
     OR NOT app.has_workshop_access(target_workshop_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT products.id, products.name, products.sku, products.stock_on_hand,
         products.selling_price, products.current_cost, products.active
  FROM products
  WHERE products.workshop_id = target_workshop_id
    AND products.id = ANY(product_ids)
  FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION app.lock_products(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.lock_products(uuid, uuid[]) TO bengkel_api;
