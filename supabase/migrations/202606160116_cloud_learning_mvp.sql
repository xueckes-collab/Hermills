create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.hermills_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  language text not null default 'zh-CN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists hermills_accounts_updated_at on public.hermills_accounts;
create trigger hermills_accounts_updated_at
before update on public.hermills_accounts
for each row execute function public.set_updated_at();

create or replace function public.handle_new_hermills_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hermills_accounts (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_hermills on auth.users;
create trigger on_auth_user_created_hermills
after insert on auth.users
for each row execute function public.handle_new_hermills_user();

create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_local_id text not null,
  company_name text not null default '',
  website text not null default '',
  main_products text not null default '',
  target_markets text not null default '',
  certifications text not null default '',
  payment_terms text not null default '',
  shipping_terms text not null default '',
  brand_tone text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, source_local_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_local_id text not null,
  local_profile_id text not null default '',
  company_name text not null default '',
  website text not null default '',
  country text not null default '',
  customer_type text not null default '',
  industry text not null default '',
  main_products text not null default '',
  channel_type text not null default '',
  fit_score text not null default '',
  recommended_angle text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_local_id)
);

create table if not exists public.email_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_local_id text not null,
  local_profile_id text not null default '',
  local_customer_id text not null default '',
  subject text not null default '',
  email_body text not null default '',
  angle text not null default '',
  cta_type text not null default '',
  customer_type text not null default '',
  fit_score text not null default '',
  ai_score numeric,
  risk_score numeric,
  prompt_version text not null default '',
  model_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_local_id)
);

create table if not exists public.email_edits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_profile_id text not null default '',
  local_draft_id text not null default '',
  edit_type text not null default '',
  before_pattern text not null default '',
  after_pattern text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.email_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_profile_id text not null default '',
  local_draft_id text not null default '',
  outcome text not null default 'unknown',
  reply_type text not null default '',
  bounced boolean not null default false,
  unsubscribed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_profile_id text not null default '',
  industry text not null default '',
  customer_type text not null default '',
  country_region text not null default '',
  development_angle text not null default '',
  subject_pattern text not null default '',
  cta_type text not null default '',
  email_word_count int,
  quality_score numeric,
  user_edited boolean not null default false,
  sent boolean not null default false,
  replied boolean not null default false,
  bounced boolean not null default false,
  reply_type text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.learning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  scope text not null default 'user' check (scope in ('user', 'company', 'global_anonymous')),
  rule_type text not null,
  condition jsonb not null default '{}'::jsonb,
  recommendation text not null,
  confidence numeric not null default 0,
  evidence_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_tone text not null default '',
  preferred_cta text not null default '',
  preferred_email_length text not null default '',
  avoid_phrases text[] not null default '{}',
  common_edits text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.golden_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  customer_type text not null default '',
  industry text not null default '',
  angle text not null default '',
  cta_type text not null default '',
  why_it_worked text not null default '',
  anonymous_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists seller_profiles_updated_at on public.seller_profiles;
create trigger seller_profiles_updated_at before update on public.seller_profiles for each row execute function public.set_updated_at();
drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
drop trigger if exists email_generations_updated_at on public.email_generations;
create trigger email_generations_updated_at before update on public.email_generations for each row execute function public.set_updated_at();
drop trigger if exists learning_rules_updated_at on public.learning_rules;
create trigger learning_rules_updated_at before update on public.learning_rules for each row execute function public.set_updated_at();
drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

alter table public.hermills_accounts enable row level security;
alter table public.seller_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.email_generations enable row level security;
alter table public.email_edits enable row level security;
alter table public.email_outcomes enable row level security;
alter table public.learning_events enable row level security;
alter table public.learning_rules enable row level security;
alter table public.user_preferences enable row level security;
alter table public.golden_samples enable row level security;
alter table public.event_logs enable row level security;

drop policy if exists hermills_accounts_own on public.hermills_accounts;
create policy hermills_accounts_own on public.hermills_accounts
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists seller_profiles_own on public.seller_profiles;
create policy seller_profiles_own on public.seller_profiles
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists customers_own on public.customers;
create policy customers_own on public.customers
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists email_generations_own on public.email_generations;
create policy email_generations_own on public.email_generations
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists email_edits_own on public.email_edits;
create policy email_edits_own on public.email_edits
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists email_outcomes_own on public.email_outcomes;
create policy email_outcomes_own on public.email_outcomes
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists learning_events_insert_own on public.learning_events;
create policy learning_events_insert_own on public.learning_events
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists learning_events_select_own on public.learning_events;
create policy learning_events_select_own on public.learning_events
for select to authenticated using (user_id = auth.uid());

drop policy if exists learning_rules_select on public.learning_rules;
create policy learning_rules_select on public.learning_rules
for select to authenticated using (scope = 'global_anonymous' or user_id = auth.uid());

drop policy if exists learning_rules_own_write on public.learning_rules;
create policy learning_rules_own_write on public.learning_rules
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and scope <> 'global_anonymous');

drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own on public.user_preferences
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists golden_samples_select on public.golden_samples;
create policy golden_samples_select on public.golden_samples
for select to authenticated using (user_id = auth.uid());

drop policy if exists golden_samples_own_write on public.golden_samples;
create policy golden_samples_own_write on public.golden_samples
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists event_logs_own on public.event_logs;
create policy event_logs_own on public.event_logs
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists customers_user_status_idx on public.customers (user_id, customer_type, industry);
create index if not exists email_generations_user_customer_idx on public.email_generations (user_id, local_customer_id);
create index if not exists learning_events_pattern_idx on public.learning_events (customer_type, industry, development_angle, replied, sent);
create index if not exists learning_rules_scope_idx on public.learning_rules (scope, rule_type, confidence desc);
