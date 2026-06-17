alter table public.hermills_accounts
  add column if not exists nickname text not null default '',
  add column if not exists status text not null default 'active',
  add column if not exists email_verified boolean not null default false,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_seen_at timestamptz;

alter table public.hermills_accounts
  drop constraint if exists hermills_accounts_status_check;

alter table public.hermills_accounts
  add constraint hermills_accounts_status_check
  check (status in ('active', 'disabled'));

create index if not exists hermills_accounts_status_idx on public.hermills_accounts(status);
create index if not exists hermills_accounts_last_login_idx on public.hermills_accounts(last_login_at desc);

create table if not exists public.hermills_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.hermills_admins enable row level security;

drop policy if exists hermills_admins_self_select on public.hermills_admins;
create policy hermills_admins_self_select on public.hermills_admins
for select to authenticated
using (user_id = auth.uid());

create or replace function public.handle_new_hermills_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_at timestamptz;
begin
  if coalesce(new.raw_user_meta_data->>'terms_accepted_at', '') ~ '^\d{4}-\d{2}-\d{2}T' then
    accepted_at := (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
  end if;

  insert into public.hermills_accounts (
    user_id,
    email,
    display_name,
    nickname,
    email_verified,
    terms_accepted_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), ''),
    coalesce(new.raw_user_meta_data->>'nickname', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), ''),
    new.email_confirmed_at is not null,
    accepted_at
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    display_name = coalesce(nullif(public.hermills_accounts.display_name, ''), excluded.display_name),
    nickname = coalesce(nullif(public.hermills_accounts.nickname, ''), excluded.nickname),
    email_verified = excluded.email_verified,
    terms_accepted_at = coalesce(public.hermills_accounts.terms_accepted_at, excluded.terms_accepted_at),
    updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_hermills_user_auth_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hermills_accounts
  set
    email = new.email,
    email_verified = new.email_confirmed_at is not null,
    updated_at = now()
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated_hermills on auth.users;
create trigger on_auth_user_updated_hermills
after update of email, email_confirmed_at on auth.users
for each row execute function public.sync_hermills_user_auth_state();

drop policy if exists hermills_accounts_own on public.hermills_accounts;
create policy hermills_accounts_own on public.hermills_accounts
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists hermills_accounts_admin_select on public.hermills_accounts;
create policy hermills_accounts_admin_select on public.hermills_accounts
for select to authenticated
using (exists (
  select 1 from public.hermills_admins admin
  where admin.user_id = auth.uid()
));

drop policy if exists hermills_accounts_admin_update on public.hermills_accounts;
create policy hermills_accounts_admin_update on public.hermills_accounts
for update to authenticated
using (exists (
  select 1 from public.hermills_admins admin
  where admin.user_id = auth.uid()
))
with check (true);

drop policy if exists event_logs_admin_select on public.event_logs;
create policy event_logs_admin_select on public.event_logs
for select to authenticated
using (exists (
  select 1 from public.hermills_admins admin
  where admin.user_id = auth.uid()
));
