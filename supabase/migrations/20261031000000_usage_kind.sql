-- The free AI quota now covers more than listing generation; record which feature used it.
alter table public.listing_usage add column kind text not null default 'listing';
