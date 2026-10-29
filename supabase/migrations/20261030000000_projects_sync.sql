-- Each user's app projects, so they survive losing the phone and show up on a new one.
-- The app keeps working offline and reconciles by updated_at when it reconnects.
create table public.projects (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null,
  -- Kept as a tombstone so a delete on one phone also removes the project on the others.
  deleted boolean not null default false,
  primary key (user_id, id)
);

alter table public.projects enable row level security;

create policy "Users read their own projects" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own projects" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users change their own projects" on public.projects
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Screenshot backups, stored under <user id>/<file name>.
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do nothing;

create policy "Users read their own screenshots" on storage.objects
  for select to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload their own screenshots" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users replace their own screenshots" on storage.objects
  for update to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete their own screenshots" on storage.objects
  for delete to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = (select auth.uid())::text);
