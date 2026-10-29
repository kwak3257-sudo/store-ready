-- One row per successful AI listing generation, used to enforce the free usage limit.
create table public.listing_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index listing_usage_user_created_idx on public.listing_usage (user_id, created_at desc);

alter table public.listing_usage enable row level security;

-- Users can read their own usage (the app shows "n/5 used"). Only the Edge Function
-- writes rows, through the admin client, so there is no insert policy.
create policy "Users read own listing usage"
  on public.listing_usage for select
  to authenticated
  using ((select auth.uid()) = user_id);
