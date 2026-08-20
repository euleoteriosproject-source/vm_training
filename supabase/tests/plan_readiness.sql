begin;
select plan(4);

select has_function('public','get_plan_readiness',array['uuid'],'plan readiness function exists');

insert into public.allowed_signup_emails(email,display_name,default_role)
values('plan-owner@example.test','Plan Owner','member') on conflict do nothing;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
values('60000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','plan-owner@example.test','x',now(),now(),now());

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000006","role":"authenticated"}',true);

insert into public.workout_plans(id,user_id,name,status,sessions_per_week,target_session_minutes)
values('70000000-0000-0000-0000-000000000007','60000000-0000-0000-0000-000000000006','Draft','draft',2,45);
insert into public.workout_days(id,workout_plan_id,name,position,estimated_minutes)
values('80000000-0000-0000-0000-000000000008','70000000-0000-0000-0000-000000000007','A',1,45);

select is((public.get_plan_readiness('70000000-0000-0000-0000-000000000007')->>'isReady')::boolean,false,'empty draft is not ready');
select throws_ok(
  $$select public.activate_plan('70000000-0000-0000-0000-000000000007')$$,
  'P0001',null,'empty draft cannot be activated'
);
select throws_ok(
  $$select public.start_workout('80000000-0000-0000-0000-000000000008')$$,
  'P0001','Treino ativo não encontrado','draft workout cannot be started'
);

select * from finish();
rollback;
