-- Run this in the Supabase SQL Editor after 001_businesses_slug_and_backfill.sql.
--
-- "Claim This Listing" requests. Nothing here ever writes to
-- businesses.owner_id automatically — approving a claim (and linking the
-- business to the claiming user) is a manual step. See the README-style
-- walkthrough given alongside this file for how to do that by hand.
--
-- business_id is `bigint`, not `uuid` — checked against the live database
-- while building this: businesses.id comes back as a plain integer
-- (Supabase's usual "generated as identity" default for a Table Editor
-- primary key), not a UUID. Get this wrong and the REFERENCES clause below
-- fails outright.

create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.claim_requests enable row level security;

-- drop-then-create rather than a bare CREATE POLICY: Postgres has no
-- CREATE POLICY IF NOT EXISTS, and this needs to be safe to re-run.
drop policy if exists "Users can submit a pending claim request" on public.claim_requests;
drop policy if exists "Users can view their own claim requests" on public.claim_requests;

-- Same defense-in-depth pattern as businesses.approved/premium: even if a
-- visitor's browser tries to send a different user_id or status, the
-- WITH CHECK clause rejects the insert outright rather than silently
-- coercing it. The client never has to be trusted for this.
create policy "Users can submit a pending claim request"
  on public.claim_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'pending');

create policy "Users can view their own claim requests"
  on public.claim_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Deliberately no UPDATE or DELETE policy for anon/authenticated — with RLS
-- enabled and no policy granting it, both roles are locked out entirely.
-- Only the service_role connection (which the Supabase dashboard's Table
-- Editor and SQL Editor both use) bypasses RLS, so approving/rejecting a
-- claim stays a manual, by-hand action for now, same as approved/premium
-- on businesses.
