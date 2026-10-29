-- Google Play tester exchange: developers test each other's apps so each gets the
-- 12 testers for 14 days that new personal developer accounts need before production.
-- Tables are read through RLS; every change goes through the functions below,
-- so nobody can edit another person's rows or mark steps out of order.

create table public.tester_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The Google account the person tests with; app owners add it to their tester list.
  gmail text not null check (gmail ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now()
);

create table public.exchange_apps (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  project_id text not null,
  name text not null check (length(name) between 1 and 100),
  package_name text not null check (package_name ~ '^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$'),
  note text not null default '' check (length(note) <= 500),
  needed int not null default 12,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner, package_name)
);

create type public.exchange_status as enum ('requested', 'added', 'installed', 'left');

create table public.exchange_joins (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.exchange_apps (id) on delete cascade,
  tester uuid not null references auth.users (id) on delete cascade,
  status public.exchange_status not null default 'requested',
  requested_at timestamptz not null default now(),
  installed_at timestamptz,
  left_at timestamptz,
  unique (app_id, tester)
);
create index exchange_joins_tester_idx on public.exchange_joins (tester);

-- One row per day (Korean time) a tester opened the app, for the tester's streak and the owner's engagement view.
create table public.exchange_checkins (
  join_id uuid not null references public.exchange_joins (id) on delete cascade,
  day date not null,
  primary key (join_id, day)
);

alter table public.tester_profiles enable row level security;
alter table public.exchange_apps enable row level security;
alter table public.exchange_joins enable row level security;
alter table public.exchange_checkins enable row level security;

-- Owners only see the Gmail of people who asked to test one of their apps.
create policy "Read own or my testers' profiles" on public.tester_profiles
  for select to authenticated using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.exchange_joins j
      join public.exchange_apps a on a.id = j.app_id
      where j.tester = tester_profiles.user_id and a.owner = (select auth.uid())
    )
  );
create policy "Anyone signed in can browse apps" on public.exchange_apps
  for select to authenticated using (true);
create policy "Testers and owners read joins" on public.exchange_joins
  for select to authenticated using (
    tester = (select auth.uid())
    or exists (select 1 from public.exchange_apps a where a.id = app_id and a.owner = (select auth.uid()))
  );
create policy "Testers and owners read check-ins" on public.exchange_checkins
  for select to authenticated using (
    exists (
      select 1 from public.exchange_joins j
      join public.exchange_apps a on a.id = j.app_id
      where j.id = join_id and (j.tester = (select auth.uid()) or a.owner = (select auth.uid()))
    )
  );

create function public.exchange_set_gmail(p_gmail text) returns void
language sql security definer set search_path = '' as $$
  insert into public.tester_profiles (user_id, gmail) values (auth.uid(), lower(trim(p_gmail)))
  on conflict (user_id) do update set gmail = excluded.gmail;
$$;

create function public.exchange_register_app(p_project_id text, p_name text, p_package text, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.exchange_apps (owner, project_id, name, package_name, note)
  values (auth.uid(), p_project_id, p_name, p_package, coalesce(p_note, ''))
  on conflict (owner, package_name) do update
    set name = excluded.name, note = excluded.note, project_id = excluded.project_id, closed = false
  returning id into v_id;
  return v_id;
end $$;

create function public.exchange_close_app(p_app uuid, p_closed boolean) returns void
language sql security definer set search_path = '' as $$
  update public.exchange_apps set closed = p_closed where id = p_app and owner = auth.uid();
$$;

create function public.exchange_join(p_app uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.tester_profiles where user_id = auth.uid()) then
    raise exception 'set your gmail first';
  end if;
  if exists (select 1 from public.exchange_apps where id = p_app and (owner = auth.uid() or closed)) then
    raise exception 'cannot join this app';
  end if;
  insert into public.exchange_joins (app_id, tester) values (p_app, auth.uid())
  on conflict (app_id, tester) do update
    set status = 'requested', requested_at = now(), installed_at = null, left_at = null
    where public.exchange_joins.status = 'left'
  returning id into v_id;
  return v_id;
end $$;

-- Owner confirms they put the tester's Gmail on the closed test list.
create function public.exchange_mark_added(p_join uuid) returns void
language sql security definer set search_path = '' as $$
  update public.exchange_joins j set status = 'added'
  from public.exchange_apps a
  where j.id = p_join and a.id = j.app_id and a.owner = auth.uid() and j.status = 'requested';
$$;

-- Tester opted in on Google Play and installed the app; the 14 days count from here.
create function public.exchange_mark_installed(p_join uuid) returns void
language sql security definer set search_path = '' as $$
  update public.exchange_joins set status = 'installed', installed_at = now()
  where id = p_join and tester = auth.uid() and status in ('requested', 'added');
  insert into public.exchange_checkins (join_id, day)
  select id, (now() at time zone 'Asia/Seoul')::date from public.exchange_joins where id = p_join and tester = auth.uid() and status = 'installed'
  on conflict do nothing;
$$;

create function public.exchange_checkin(p_join uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.exchange_checkins (join_id, day)
  select id, (now() at time zone 'Asia/Seoul')::date from public.exchange_joins where id = p_join and tester = auth.uid() and status = 'installed'
  on conflict do nothing;
$$;

create function public.exchange_leave(p_join uuid) returns void
language sql security definer set search_path = '' as $$
  update public.exchange_joins set status = 'left', left_at = now()
  where id = p_join and tester = auth.uid() and status <> 'left';
$$;

-- The browse list: open apps with tester counts and how much the owner tests for others,
-- without exposing who the testers are.
create function public.exchange_board()
returns table (
  id uuid, name text, package_name text, note text, needed int, created_at timestamptz,
  testers int, owner_gives int, joined boolean
)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name, a.package_name, a.note, a.needed, a.created_at,
    (select count(*)::int from public.exchange_joins j where j.app_id = a.id and j.status = 'installed'),
    (select count(*)::int from public.exchange_joins g where g.tester = a.owner and g.status = 'installed'),
    exists (select 1 from public.exchange_joins m where m.app_id = a.id and m.tester = auth.uid() and m.status <> 'left')
  from public.exchange_apps a
  where not a.closed and a.owner <> auth.uid()
  order by 8 desc, 7 asc, a.created_at asc;
$$;

revoke execute on function
  public.exchange_set_gmail(text), public.exchange_register_app(text, text, text, text),
  public.exchange_close_app(uuid, boolean), public.exchange_join(uuid), public.exchange_mark_added(uuid),
  public.exchange_mark_installed(uuid), public.exchange_checkin(uuid), public.exchange_leave(uuid),
  public.exchange_board()
from public, anon;
grant execute on function
  public.exchange_set_gmail(text), public.exchange_register_app(text, text, text, text),
  public.exchange_close_app(uuid, boolean), public.exchange_join(uuid), public.exchange_mark_added(uuid),
  public.exchange_mark_installed(uuid), public.exchange_checkin(uuid), public.exchange_leave(uuid),
  public.exchange_board()
to authenticated;
