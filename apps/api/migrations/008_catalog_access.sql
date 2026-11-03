CREATE FUNCTION app.authenticate_session(
  session_token_hash text,
  target_workshop_id uuid
)
RETURNS TABLE (user_id uuid, role membership_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT memberships.user_id, memberships.role
  FROM refresh_tokens
  JOIN memberships ON memberships.user_id = refresh_tokens.user_id
  WHERE refresh_tokens.token_hash = session_token_hash
    AND refresh_tokens.revoked_at IS NULL
    AND refresh_tokens.expires_at > now()
    AND memberships.workshop_id = target_workshop_id
    AND memberships.active
$$;

REVOKE ALL ON FUNCTION app.authenticate_session(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.authenticate_session(text, uuid) TO bengkel_api;
GRANT SELECT, INSERT, UPDATE ON product_categories, products, service_categories, services TO bengkel_api;
