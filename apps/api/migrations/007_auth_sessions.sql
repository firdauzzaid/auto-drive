CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  token_hash text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_expiry_index ON refresh_tokens (user_id, expires_at DESC);

ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_self ON refresh_tokens FOR ALL
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());

CREATE FUNCTION app.register_owner(
  owner_email text,
  owner_password_hash text,
  new_workshop_name text
)
RETURNS TABLE (user_id uuid, workshop_id uuid, role membership_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
DECLARE
  created_user_id uuid;
  created_workshop_id uuid;
BEGIN
  INSERT INTO users (email, password_hash)
  VALUES (lower(trim(owner_email)), owner_password_hash)
  RETURNING id INTO created_user_id;

  INSERT INTO workshops (name)
  VALUES (trim(new_workshop_name))
  RETURNING id INTO created_workshop_id;

  INSERT INTO memberships (workshop_id, user_id, role)
  VALUES (created_workshop_id, created_user_id, 'owner');

  RETURN QUERY SELECT created_user_id, created_workshop_id, 'owner'::membership_role;
END;
$$;

CREATE FUNCTION app.find_user_by_email(login_email text)
RETURNS TABLE (id uuid, email text, password_hash text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app, pg_temp
AS $$
  SELECT users.id, users.email, users.password_hash
  FROM users
  WHERE users.email = lower(trim(login_email))
$$;

REVOKE ALL ON FUNCTION app.register_owner(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.find_user_by_email(text) FROM PUBLIC;

GRANT INSERT, SELECT, UPDATE ON refresh_tokens TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.register_owner(text, text, text) TO bengkel_api;
GRANT EXECUTE ON FUNCTION app.find_user_by_email(text) TO bengkel_api;
