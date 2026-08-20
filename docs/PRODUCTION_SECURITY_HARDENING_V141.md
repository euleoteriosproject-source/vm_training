# Production Security Hardening v1.4.1

This report describes the versioned database state after migration
`202608200011_production_security_hardening_v141.sql`. Production must receive
the migration through the normal deployment process; it was not changed
manually.

## Function privilege audit

`Y` means that the role retains `EXECUTE`. `App` means a direct RPC call exists
in the application. The five RLS helpers were moved from `public` to `private`,
which is not listed in the PostgREST exposed schemas.

| Function | Definer | Public | Anon | Auth | Service | Auth admin | Trigger | RLS | App |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `public.activate_plan(uuid)` | N | N | N | Y | N | N | N | N | Y |
| `public.complete_onboarding(jsonb)` | N | N | N | Y | N | N | N | N | Y |
| `public.delete_own_account_data()` | N | N | N | Y | N | N | N | N | N |
| `public.enforce_exercise_media()` | N | N | N | N | N | N | Y | N | N |
| `public.enforce_plan_activation()` | Y | N | N | N | N | N | Y | N | N |
| `public.enforce_server_media_approval()` | N | N | N | N | N | N | Y | N | N |
| `public.exercise_has_approved_primary(uuid)` | N | N | N | Y | Y | N | N | N | N |
| `public.finish_workout(uuid,text)` | N | N | N | Y | N | N | N | N | Y |
| `public.get_exercise_publish_readiness(uuid)` | N | N | N | N | N | N | N | N | N |
| `public.get_plan_readiness(uuid)` | N | N | N | Y | N | N | N | N | N |
| `public.handle_new_user()` | Y | N | N | N | N | N | Y | N | N |
| `public.hook_restrict_signup(jsonb)` | Y | N | N | N | N | Y | N | N | N |
| `public.is_valid_primary_checklist(jsonb)` | N | N | N | Y | Y | N | N | N | N |
| `public.prevent_primary_media_regression()` | N | N | N | N | N | N | Y | N | N |
| `public.protect_active_exercise_media()` | N | N | N | N | N | N | Y | N | N |
| `public.publish_exercise_media(uuid,uuid)` | Y | N | N | N | Y | N | N | N | Y |
| `public.set_updated_at()` | N | N | N | N | N | N | Y | N | N |
| `public.start_workout(uuid)` | N | N | N | Y | N | N | N | N | Y |
| `public.validate_media_approval()` | N | N | N | N | N | N | Y | N | N |
| `private.is_admin()` | Y | N | N | Y | N | N | N | Y | N |
| `private.owns_plan(uuid)` | Y | N | N | Y | N | N | N | Y | N |
| `private.owns_day(uuid)` | Y | N | N | Y | N | N | N | Y | N |
| `private.owns_session(uuid)` | Y | N | N | Y | N | N | N | Y | N |
| `private.owns_session_exercise(uuid)` | Y | N | N | Y | N | N | N | Y | N |

All 24 application functions were audited. All nine existing `SECURITY
DEFINER` functions were hardened: five RLS helpers moved to `private`, two
trigger functions became owner-only, the Auth Hook remains executable only by
`supabase_auth_admin`, and media publication remains executable only by
`service_role`. Every definer function uses an empty `search_path`.

## Advisor remediation

- Added 12 missing foreign-key covering indexes. Existing covering indexes were
  retained and no unused index was removed.
- Rewrote the ten user-isolation policy groups to use `(select auth.uid())`.
- Split eight overlapping `FOR ALL` admin policies into INSERT, UPDATE and
  DELETE policies. Their existing SELECT policies remain authoritative, so the
  resulting access is semantically equivalent.
- Added pgTAP assertions for trigger-only execution, private RLS helpers, Auth
  Hook allow/deny behavior, role grants, and safe function search paths.
