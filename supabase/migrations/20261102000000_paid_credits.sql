-- Paid AI credits bought with in-app purchases. Once the free monthly quota is used up,
-- each AI answer spends one credit. The balance is the sum of the ledger.

create table public.iap_purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  store text not null check (store in ('google', 'apple')),
  -- Google purchase token or Apple original transaction id; one credit grant per purchase.
  purchase_key text not null,
  product_id text not null,
  credits int not null check (credits > 0),
  created_at timestamptz not null default now(),
  unique (store, purchase_key)
);

create table public.ai_credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null,
  reason text not null,
  purchase_id bigint references public.iap_purchases (id),
  created_at timestamptz not null default now()
);
create index ai_credit_ledger_user_idx on public.ai_credit_ledger (user_id);

alter table public.iap_purchases enable row level security;
alter table public.ai_credit_ledger enable row level security;

create policy "Users read their own purchases" on public.iap_purchases
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users read their own credits" on public.ai_credit_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

-- Called only by Edge Functions with the service role after the store confirmed the purchase.
-- Returns 'granted', 'already_granted' (same user retried), or 'other_user' (token reused by someone else).
create function public.grant_purchase(
  p_user uuid, p_store text, p_key text, p_product text, p_credits int
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_id bigint;
  v_owner uuid;
begin
  insert into public.iap_purchases (user_id, store, purchase_key, product_id, credits)
  values (p_user, p_store, p_key, p_product, p_credits)
  on conflict (store, purchase_key) do nothing
  returning id into v_id;
  if v_id is null then
    select user_id into v_owner from public.iap_purchases where store = p_store and purchase_key = p_key;
    return case when v_owner = p_user then 'already_granted' else 'other_user' end;
  end if;
  insert into public.ai_credit_ledger (user_id, delta, reason, purchase_id)
  values (p_user, p_credits, 'purchase:' || p_product, v_id);
  return 'granted';
end $$;

-- Spends one credit if the balance allows; the per-user lock keeps two requests from spending the same credit.
create function public.spend_credit(p_user uuid, p_reason text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_balance int;
begin
  perform pg_advisory_xact_lock(hashtext('ai_credit:' || p_user::text));
  select coalesce(sum(delta), 0) into v_balance from public.ai_credit_ledger where user_id = p_user;
  if v_balance <= 0 then return false; end if;
  insert into public.ai_credit_ledger (user_id, delta, reason) values (p_user, -1, p_reason);
  return true;
end $$;

revoke execute on function public.grant_purchase(uuid, text, text, text, int), public.spend_credit(uuid, text)
  from public, anon, authenticated;
grant execute on function public.grant_purchase(uuid, text, text, text, int), public.spend_credit(uuid, text)
  to service_role;
