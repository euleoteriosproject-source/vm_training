with roles(role_name) as (
  values ('anon'), ('authenticated'), ('service_role'), ('supabase_auth_admin')
), table_grants as (
  select g.table_schema as schema_name,
    g.table_name as object_name,
    g.grantee as role_name,
    g.privilege_type as privilege,
    c.relrowsecurity as rls_enabled
  from information_schema.role_table_grants g
  join pg_namespace n on n.nspname = g.table_schema
  join pg_class c on c.relnamespace = n.oid and c.relname = g.table_name
  where g.table_schema in ('public', 'private')
    and g.grantee in (select role_name from roles)
), sequence_grants as (
  select n.nspname as schema_name,
    c.relname as object_name,
    roles.role_name,
    privileges.privilege
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join roles
  cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) privileges(privilege)
  where c.relkind = 'S'
    and n.nspname in ('public', 'private')
    and has_sequence_privilege(roles.role_name, c.oid, privileges.privilege)
), function_grants as (
  select n.nspname as schema_name,
    p.proname as object_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    l.lanname as language,
    p.prosecdef as security_definer,
    roles.role_name,
    'EXECUTE'::text as privilege
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  cross join roles
  where n.nspname in ('public', 'private')
    and has_function_privilege(roles.role_name, p.oid, 'EXECUTE')
), function_inventory as (
  select n.nspname as schema_name,
    p.proname as object_name,
    pg_get_function_identity_arguments(p.oid) as identity_arguments,
    pg_get_function_result(p.oid) as result_type,
    l.lanname as language,
    p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname in ('public', 'private')
), schema_grants as (
  select n.nspname as schema_name,
    roles.role_name,
    privileges.privilege
  from pg_namespace n
  cross join roles
  cross join (values ('USAGE'), ('CREATE')) privileges(privilege)
  where n.nspname in ('public', 'private')
    and has_schema_privilege(roles.role_name, n.oid, privileges.privilege)
), default_grants as (
  select owner.rolname as owner_name,
    coalesce(n.nspname, '*') as schema_name,
    case d.defaclobjtype
      when 'r' then 'TABLES'
      when 'S' then 'SEQUENCES'
      when 'f' then 'FUNCTIONS'
      when 'T' then 'TYPES'
      when 'n' then 'SCHEMAS'
      else d.defaclobjtype::text
    end as object_type,
    case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as role_name,
    acl.privilege_type as privilege
  from pg_default_acl d
  join pg_roles owner on owner.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace
  cross join lateral aclexplode(d.defaclacl) acl
  left join pg_roles grantee on grantee.oid = acl.grantee
  where owner.rolname in ('postgres', 'supabase_admin', 'supabase_auth_admin')
    and (n.nspname is null or n.nspname in ('public', 'private'))
    and (acl.grantee = 0 or grantee.rolname in (
      'anon', 'authenticated', 'service_role', 'supabase_auth_admin'
    ))
)
select jsonb_build_object(
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'object', object_name,
      'role', role_name,
      'privilege', privilege,
      'rlsEnabled', rls_enabled
    ) order by schema_name, object_name, role_name, privilege)
    from table_grants
  ), '[]'::jsonb),
  'sequences', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'object', object_name,
      'role', role_name,
      'privilege', privilege
    ) order by schema_name, object_name, role_name, privilege)
    from sequence_grants
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'object', object_name,
      'identityArguments', identity_arguments,
      'resultType', result_type,
      'language', language,
      'securityDefiner', security_definer,
      'role', role_name,
      'privilege', privilege
    ) order by schema_name, object_name, identity_arguments, role_name)
    from function_grants
  ), '[]'::jsonb),
  'functionInventory', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'object', object_name,
      'identityArguments', identity_arguments,
      'resultType', result_type,
      'language', language,
      'securityDefiner', security_definer
    ) order by schema_name, object_name, identity_arguments)
    from function_inventory
  ), '[]'::jsonb),
  'schemas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'schema', schema_name,
      'role', role_name,
      'privilege', privilege
    ) order by schema_name, role_name, privilege)
    from schema_grants
  ), '[]'::jsonb),
  'defaultPrivileges', coalesce((
    select jsonb_agg(jsonb_build_object(
      'owner', owner_name,
      'schema', schema_name,
      'objectType', object_type,
      'role', role_name,
      'privilege', privilege
    ) order by owner_name, schema_name, object_type, role_name, privilege)
    from default_grants
  ), '[]'::jsonb)
) as grant_matrix;
