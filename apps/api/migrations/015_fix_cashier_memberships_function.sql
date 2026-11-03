CREATE OR REPLACE FUNCTION app.register_cashier(
  cashier_email text,
  cashier_password_hash text
)
RETURNS TABLE (user_id uuid, workshop_id uuid, role membership_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  created_user_id uuid;
  target_workshop_id uuid := app.current_workshop_id();
BEGIN
  IF target_workshop_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM memberships
    WHERE memberships.workshop_id = target_workshop_id
      AND memberships.user_id = app.current_user_id()
      AND memberships.role = 'owner'
      AND memberships.active
  ) THEN
    RAISE EXCEPTION 'Owner workshop access denied';
  END IF;

  INSERT INTO users (email, password_hash)
  VALUES (lower(trim(cashier_email)), cashier_password_hash)
  RETURNING id INTO created_user_id;

  INSERT INTO memberships (workshop_id, user_id, role)
  VALUES (target_workshop_id, created_user_id, 'cashier');

  RETURN QUERY SELECT created_user_id, target_workshop_id, 'cashier'::membership_role;
END;
$$;
