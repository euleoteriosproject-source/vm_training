-- The Hosted CLI authenticates through cli_login_postgres and SET ROLE
-- postgres. Application roles remain unable to use the extensions schema.
grant usage on schema extensions to postgres with grant option;
