CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE TYPE membership_role AS ENUM ('owner', 'cashier');
CREATE TYPE sale_status AS ENUM ('draft', 'completed', 'void');
CREATE TYPE payment_method AS ENUM ('cash', 'qris', 'bank_transfer');
CREATE TYPE inventory_movement_reason AS ENUM ('purchase', 'sale', 'adjustment', 'sale_void');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  phone text,
  whatsapp_number text,
  address text,
  logo_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role membership_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workshop_id, user_id)
);

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, name)
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  category_id uuid REFERENCES product_categories(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  normalized_name text GENERATED ALWAYS AS (lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))) STORED,
  sku text,
  unit text NOT NULL CHECK (char_length(trim(unit)) > 0),
  stock_on_hand numeric(14,3) NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  minimum_stock numeric(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  current_cost bigint NOT NULL DEFAULT 0 CHECK (current_cost >= 0),
  selling_price bigint NOT NULL CHECK (selling_price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (workshop_id, sku)
);

CREATE INDEX products_workshop_name_index ON products (workshop_id, normalized_name);

CREATE TABLE service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, name)
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  category_id uuid REFERENCES service_categories(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  selling_price bigint NOT NULL CHECK (selling_price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  phone text,
  whatsapp_number text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  plate_number text,
  normalized_plate text GENERATED ALWAYS AS (nullif(regexp_replace(upper(plate_number), '[^A-Z0-9]', '', 'g'), '')) STORED,
  brand text,
  model text,
  manufacture_year smallint CHECK (manufacture_year BETWEEN 1900 AND 2100),
  color text,
  current_kilometer integer CHECK (current_kilometer >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (workshop_id, normalized_plate)
);

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  transaction_number text NOT NULL,
  customer_id uuid REFERENCES customers(id),
  vehicle_id uuid REFERENCES vehicles(id),
  status sale_status NOT NULL DEFAULT 'draft',
  subtotal bigint NOT NULL CHECK (subtotal >= 0),
  discount bigint NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount <= subtotal),
  total bigint NOT NULL CHECK (total = subtotal - discount),
  completed_by uuid REFERENCES users(id),
  completed_at timestamptz,
  voided_by uuid REFERENCES users(id),
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, transaction_number),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CHECK ((status = 'void') = (voided_at IS NOT NULL AND voided_by IS NOT NULL AND char_length(trim(void_reason)) > 0))
);

CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  product_id uuid REFERENCES products(id),
  service_id uuid REFERENCES services(id),
  name_snapshot text NOT NULL,
  sku_snapshot text,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price bigint NOT NULL CHECK (unit_price >= 0),
  unit_cost bigint NOT NULL CHECK (unit_cost >= 0),
  line_total bigint NOT NULL CHECK (line_total = unit_price * quantity),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((product_id IS NOT NULL)::integer + (service_id IS NOT NULL)::integer = 1)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id),
  method payment_method NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  received_by uuid NOT NULL REFERENCES users(id),
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid NOT NULL REFERENCES workshops(id),
  product_id uuid NOT NULL REFERENCES products(id),
  sale_id uuid REFERENCES sales(id),
  previous_stock numeric(14,3) NOT NULL CHECK (previous_stock >= 0),
  quantity_change numeric(14,3) NOT NULL CHECK (quantity_change <> 0),
  new_stock numeric(14,3) NOT NULL CHECK (new_stock >= 0),
  reason inventory_movement_reason NOT NULL,
  reason_note text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (new_stock = previous_stock + quantity_change)
);

CREATE INDEX sales_workshop_completed_index ON sales (workshop_id, completed_at DESC);
CREATE INDEX sales_workshop_vehicle_completed_index ON sales (workshop_id, vehicle_id, completed_at DESC);
CREATE INDEX inventory_movements_product_created_index ON inventory_movements (workshop_id, product_id, created_at DESC);

CREATE FUNCTION app.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE FUNCTION app.current_workshop_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.workshop_id', true), '')::uuid
$$;

CREATE FUNCTION app.has_workshop_access(target_workshop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.workshop_id = target_workshop_id
      AND memberships.user_id = app.current_user_id()
      AND memberships.active
  )
$$;

CREATE FUNCTION app.apply_inventory_movement(
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
AS $$
DECLARE
  existing_stock numeric(14,3);
  resulting_stock numeric(14,3);
  movement inventory_movements;
BEGIN
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

CREATE FUNCTION app.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_touch_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER workshops_touch_updated_at BEFORE UPDATE ON workshops FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER memberships_touch_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER services_touch_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER customers_touch_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER vehicles_touch_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();
CREATE TRIGGER sales_touch_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self ON users FOR ALL USING (id = app.current_user_id()) WITH CHECK (id = app.current_user_id());
CREATE POLICY memberships_self ON memberships FOR SELECT USING (user_id = app.current_user_id());
CREATE POLICY workshops_member ON workshops FOR ALL USING (app.has_workshop_access(id)) WITH CHECK (app.has_workshop_access(id));

CREATE POLICY product_categories_member ON product_categories FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY products_member ON products FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY service_categories_member ON service_categories FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY services_member ON services FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY customers_member ON customers FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY vehicles_member ON vehicles FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY sales_member ON sales FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
CREATE POLICY sale_items_member ON sale_items FOR ALL USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.workshop_id = app.current_workshop_id() AND app.has_workshop_access(sales.workshop_id))) WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND sales.workshop_id = app.current_workshop_id() AND app.has_workshop_access(sales.workshop_id)));
CREATE POLICY payments_member ON payments FOR ALL USING (EXISTS (SELECT 1 FROM sales WHERE sales.id = payments.sale_id AND sales.workshop_id = app.current_workshop_id() AND app.has_workshop_access(sales.workshop_id))) WITH CHECK (EXISTS (SELECT 1 FROM sales WHERE sales.id = payments.sale_id AND sales.workshop_id = app.current_workshop_id() AND app.has_workshop_access(sales.workshop_id)));
CREATE POLICY inventory_movements_member ON inventory_movements FOR ALL USING (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id)) WITH CHECK (workshop_id = app.current_workshop_id() AND app.has_workshop_access(workshop_id));
