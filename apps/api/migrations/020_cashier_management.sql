CREATE FUNCTION app.list_cashiers()
RETURNS TABLE (user_id uuid, email text, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT memberships.user_id, users.email, memberships.active
  FROM memberships
  JOIN users ON users.id = memberships.user_id
  WHERE memberships.workshop_id = app.current_workshop_id()
    AND memberships.role = 'cashier'
    AND EXISTS (
      SELECT 1 FROM memberships owner_membership
      WHERE owner_membership.workshop_id = app.current_workshop_id()
        AND owner_membership.user_id = app.current_user_id()
        AND owner_membership.role = 'owner'
        AND owner_membership.active
    )
  ORDER BY users.email
$$;

CREATE FUNCTION app.set_cashier_active(target_user_id uuid, cashier_active boolean)
RETURNS TABLE (user_id uuid, email text, active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships owner_membership
    WHERE owner_membership.workshop_id = app.current_workshop_id()
      AND owner_membership.user_id = app.current_user_id()
      AND owner_membership.role = 'owner'
      AND owner_membership.active
  ) THEN
    RAISE EXCEPTION 'Owner workshop access denied';
  END IF;

  RETURN QUERY
  UPDATE memberships
  SET active = cashier_active
  FROM users
  WHERE memberships.workshop_id = app.current_workshop_id()
    AND memberships.user_id = target_user_id
    AND memberships.role = 'cashier'
    AND users.id = memberships.user_id
  RETURNING memberships.user_id, users.email, memberships.active;
END;
$$;

REVOKE ALL ON FUNCTION app.list_cashiers() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.set_cashier_active(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.list_cashiers() TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.set_cashier_active(uuid, boolean) TO bengkel_api;
