begin;
create table if not exists public.quiz_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.quiz_workspace (
  id integer primary key check(id=1),
  data jsonb not null check(jsonb_typeof(data)='object'),
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
create table if not exists public.quiz_public (
  id integer primary key check(id=1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.quiz_admins enable row level security;
alter table public.quiz_workspace enable row level security;
alter table public.quiz_public enable row level security;
revoke all on public.quiz_admins,public.quiz_workspace,public.quiz_public from anon,authenticated;
grant select on public.quiz_admins,public.quiz_workspace to authenticated;
grant select on public.quiz_public to anon,authenticated;
drop policy if exists admin_self on public.quiz_admins;
create policy admin_self on public.quiz_admins for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists admin_workspace_read on public.quiz_workspace;
create policy admin_workspace_read on public.quiz_workspace for select to authenticated using (exists(select 1 from public.quiz_admins where user_id=(select auth.uid())));
drop policy if exists published_read on public.quiz_public;
create policy published_read on public.quiz_public for select to anon,authenticated using(true);
create or replace function public.save_quiz(p_data jsonb,p_revision integer)
returns integer language plpgsql security definer set search_path='' as $$
declare new_revision integer; q jsonb; t jsonb; engine text; count_items integer; answer_index jsonb; clean_public jsonb;
begin
  if not exists(select 1 from public.quiz_admins where user_id=auth.uid()) then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_data is null or jsonb_typeof(p_data) is distinct from 'object' or p_data->>'version' is distinct from '1' or
     jsonb_typeof(p_data->'title') is distinct from 'string' or length(trim(p_data->>'title')) not between 1 and 160 or
     jsonb_typeof(p_data->'types') is distinct from 'array' or jsonb_typeof(p_data->'questions') is distinct from 'array' or octet_length(p_data::text)>4000000 then
    raise exception 'Invalid quiz document';
  end if;
  if jsonb_array_length(p_data->'types') not between 7 and 100 or jsonb_array_length(p_data->'questions')>2000 then raise exception 'Too many types or questions'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_data->'types'))<>jsonb_array_length(p_data->'types') or (select count(distinct value->>'id') from jsonb_array_elements(p_data->'questions'))<>jsonb_array_length(p_data->'questions') then raise exception 'Duplicate IDs'; end if;
  for t in select value from jsonb_array_elements(p_data->'types') loop
    if coalesce(length(t->>'id'),0) not between 1 and 100 or coalesce(length(trim(t->>'label')),0) not between 1 and 80 or coalesce(t->>'engine','') not in ('single','boolean','fill','multiple','match','order','short') then raise exception 'Invalid question type'; end if;
  end loop;
  for engine in select unnest(array['single','boolean','fill','multiple','match','order','short']) loop
    if not exists(select 1 from jsonb_array_elements(p_data->'types') x where x->>'id'=engine and x->>'engine'=engine) then raise exception 'Missing built-in type'; end if;
  end loop;
  for q in select value from jsonb_array_elements(p_data->'questions') loop
    select x->>'engine' into engine from jsonb_array_elements(p_data->'types') x where x->>'id'=q->>'type';
    if engine is null or coalesce(length(q->>'id'),0) not between 1 and 100 or jsonb_typeof(q->'prompt') is distinct from 'string' or coalesce(length(trim(q->>'prompt')),0) not between 1 and 4000 or jsonb_typeof(q->'enabled') is distinct from 'boolean' or jsonb_typeof(q->'seconds') is distinct from 'number' or coalesce(q->>'seconds','') !~ '^[0-9]+$' or (q->>'seconds')::numeric not between 1 and 3600 or jsonb_typeof(q->'explanation') is distinct from 'string' or length(q->>'explanation')>4000 then raise exception 'Invalid question'; end if;
    if engine in ('single','multiple') then
      if jsonb_typeof(q->'options') is distinct from 'array' or jsonb_typeof(q->'correct') is distinct from 'array' then raise exception 'Invalid choices'; end if;
      count_items:=jsonb_array_length(q->'options');
      if count_items not between 2 and 12 or (engine='single' and count_items<>4) or jsonb_array_length(q->'correct')<1 or (engine='single' and jsonb_array_length(q->'correct')<>1) then raise exception 'Invalid choices count'; end if;
      if exists(select 1 from jsonb_array_elements(q->'options') x where jsonb_typeof(x) is distinct from 'string' or length(trim(x#>>'{}')) not between 1 and 4000) then raise exception 'Empty choice'; end if;
      for answer_index in select value from jsonb_array_elements(q->'correct') loop
        if jsonb_typeof(answer_index) is distinct from 'number' or answer_index::text !~ '^[0-9]+$' or answer_index::integer not between 0 and count_items-1 then raise exception 'Invalid correct answer index'; end if;
      end loop;
    elsif engine='boolean' then
      if jsonb_typeof(q->'answer') is distinct from 'boolean' then raise exception 'Invalid boolean answer'; end if;
    elsif engine='short' then
      if jsonb_typeof(q->'answer') is distinct from 'string' or length(trim(q->>'answer')) not between 1 and 4000 then raise exception 'Invalid short answer'; end if;
    elsif engine='fill' then
      if jsonb_typeof(q->'template') is distinct from 'string' or jsonb_typeof(q->'answers') is distinct from 'array' then raise exception 'Invalid fill question'; end if;
      if length(q->>'template')>4000 or jsonb_array_length(q->'answers') not between 1 and 20 or (length(q->>'template')-length(replace(q->>'template','{{…}}','')))/5<>jsonb_array_length(q->'answers') or exists(select 1 from jsonb_array_elements(q->'answers') x where jsonb_typeof(x) is distinct from 'string' or length(trim(x#>>'{}')) not between 1 and 4000) then raise exception 'Fill answers do not match'; end if;
    elsif engine='match' then
      if jsonb_typeof(q->'pairs') is distinct from 'array' then raise exception 'Invalid matching question'; end if;
      if jsonb_array_length(q->'pairs') not between 2 and 12 or exists(select 1 from jsonb_array_elements(q->'pairs') x where jsonb_typeof(x->'left') is distinct from 'string' or jsonb_typeof(x->'right') is distinct from 'string' or length(trim(x->>'left')) not between 1 and 4000 or length(trim(x->>'right')) not between 1 and 4000) then raise exception 'Invalid matching pairs'; end if;
    elsif engine='order' then
      if jsonb_typeof(q->'items') is distinct from 'array' then raise exception 'Invalid ordering question'; end if;
      if jsonb_array_length(q->'items') not between 2 and 12 or exists(select 1 from jsonb_array_elements(q->'items') x where jsonb_typeof(x) is distinct from 'string' or length(trim(x#>>'{}')) not between 1 and 4000) then raise exception 'Invalid ordering items'; end if;
    end if;
  end loop;
  update public.quiz_workspace set data=p_data,revision=revision+1,updated_at=now() where id=1 and revision=p_revision returning revision into new_revision;
  if new_revision is null then raise exception 'Version conflict' using errcode='PT409'; end if;
  clean_public:=jsonb_build_object('version',1,'title',p_data->'title','types',p_data->'types','questions',coalesce((select jsonb_agg(value order by ord) from jsonb_array_elements(p_data->'questions') with ordinality as x(value,ord) where value->'enabled'='true'::jsonb),'[]'::jsonb));
  insert into public.quiz_public(id,data) values(1,clean_public) on conflict(id) do update set data=excluded.data,updated_at=now();
  return new_revision;
end;
$$;
revoke all on function public.save_quiz(jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_quiz(jsonb,integer) to authenticated;
commit;

-- Only explicitly allowed emails can create an admin account.
create table if not exists public.quiz_admin_emails (email text primary key check(email=lower(email)));
alter table public.quiz_admin_emails enable row level security;
revoke all on public.quiz_admin_emails from anon,authenticated;
create or replace function public.enroll_quiz_admin() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.quiz_admin_emails where email=lower(new.email)) then
    raise exception 'Email is not authorized for Giaoly';
  end if;
  if new.email_confirmed_at is not null then
    insert into public.quiz_admins(user_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.enroll_quiz_admin() from public,anon,authenticated;
drop trigger if exists giaoly_admin_enrollment on auth.users;
create trigger giaoly_admin_enrollment after insert or update of email_confirmed_at on auth.users for each row execute function public.enroll_quiz_admin();
