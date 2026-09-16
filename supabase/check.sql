-- Run as postgres in SQL Editor. All test changes are rolled back.
begin;
insert into public.quiz_admin_emails(email) values('giaoly-check@example.invalid') on conflict do nothing;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
insert into auth.users(id,email) values(current_setting('request.jwt.claim.sub')::uuid,'giaoly-check@example.invalid');
set local role authenticated;
do $$ begin
  if exists(select 1 from public.quiz_workspace) then raise exception 'Non-admin can read workspace'; end if;
  begin
    perform public.save_quiz('{}'::jsonb,0);
    raise exception 'Non-admin write was accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
insert into public.quiz_admins(user_id) values(current_setting('request.jwt.claim.sub')::uuid);
set local role authenticated;
do $$ declare d jsonb; r integer; updated integer; begin
  select data,revision into d,r from public.quiz_workspace where id=1;
  if d is null then raise exception 'Admin cannot read'; end if;
  updated:=public.save_quiz(d,r);
  if updated<>r+1 then raise exception 'Revision failed'; end if;
  begin perform public.save_quiz(d,r); raise exception 'Stale write accepted'; exception when sqlstate 'PT409' then null; end;
  d:=jsonb_set(d,'{questions,0,enabled}','false');
  updated:=public.save_quiz(d,updated);
  if jsonb_array_length((select data->'questions' from public.quiz_public where id=1))<>6 then raise exception 'Hidden question leaked'; end if;
  begin
    perform public.save_quiz(jsonb_set(d,'{questions,0,seconds}','0'),updated);
    raise exception 'Invalid question was accepted' using errcode='22000';
  exception when raise_exception then null;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  if not exists(select 1 from public.quiz_public) then raise exception 'Public read failed'; end if;
  begin perform * from public.quiz_workspace; raise exception 'Anonymous workspace read accepted' using errcode='22000'; exception when insufficient_privilege then null; end;
  begin perform public.save_quiz('{}'::jsonb,0); raise exception 'Anonymous write accepted' using errcode='22000'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: admin save, public visibility, anonymous and non-admin denial, revision conflict, invalid timer, rollback' as checks;
