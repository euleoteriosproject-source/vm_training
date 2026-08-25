-- VM Training v2.0: Production runs the same transactional pgTAP contract
-- used by clean local resets. Keep extension objects out of public.
create extension if not exists pgtap with schema extensions;
