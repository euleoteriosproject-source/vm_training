begin;
select plan(6);
select has_table('public','profiles','profiles exists');
select is((select relrowsecurity from pg_class where oid='public.profiles'::regclass),true,'profiles RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.set_logs'::regclass),true,'set logs RLS enabled');
select is((select count(*)::integer from pg_policies where schemaname='public' and tablename in ('profiles','body_measurements','workout_plans','set_logs') and policyname like 'own%'),5,'private ownership policies exist');

insert into public.allowed_signup_emails(email,display_name,default_role) values
('rls-vinicius@example.test','RLS Vinicius','member'),('rls-marlise@example.test','RLS Marlise','member') on conflict do nothing;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-vinicius@example.test','x',now(),now(),now()),
('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rls-marlise@example.test','x',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
insert into public.body_measurements(user_id,weight_kg) values('10000000-0000-0000-0000-000000000001',100);
select set_config('request.jwt.claims','{"sub":"20000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
insert into public.body_measurements(user_id,weight_kg) values('20000000-0000-0000-0000-000000000002',70);
select is((select count(*)::integer from public.body_measurements where user_id='10000000-0000-0000-0000-000000000001'),0,'Marlise cannot read Vinicius private data');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.body_measurements where user_id='20000000-0000-0000-0000-000000000002'),0,'Vinicius cannot read Marlise private data');
select * from finish();
rollback;
