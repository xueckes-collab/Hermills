create extension if not exists pgcrypto with schema extensions;

alter table if exists public.learning_events
  add column if not exists event_key text;

update public.learning_events
set event_key = coalesce(nullif(event_key, ''), 'legacy:' || id::text)
where event_key is null or event_key = '';

create unique index if not exists learning_events_user_event_key_uidx
on public.learning_events (user_id, event_key);

alter table if exists public.learning_rules
  add column if not exists rule_key text,
  add column if not exists stats jsonb not null default '{}'::jsonb;

update public.learning_rules
set rule_key = coalesce(nullif(rule_key, ''), 'legacy:' || id::text)
where rule_key is null or rule_key = '';

create unique index if not exists learning_rules_user_rule_key_uidx
on public.learning_rules (user_id, rule_key);

create table if not exists public.hermills_redacted_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_profile_id text not null default '',
  source_type text not null default 'draft' check (source_type in ('draft', 'workflow', 'campaign', 'recipient', 'feedback', 'sync', 'other')),
  source_local_id text not null default '',
  event_type text not null default 'learning_signal',
  schema_version int not null default 1,
  redaction_version text not null default 'hermills-cloud-v2',
  redaction_status text not null default 'aggregate_only' check (redaction_status in ('redacted', 'patternized', 'aggregate_only')),
  payload_hash text,
  redacted_payload jsonb not null default '{}'::jsonb,
  pii_detected jsonb not null default '{}'::jsonb,
  customer_type text not null default '',
  industry text not null default '',
  country_region text not null default '',
  development_angle text not null default '',
  subject_pattern text not null default '',
  cta_type text not null default '',
  first_line_type text not null default '',
  value_point_pattern text not null default '',
  email_word_count int,
  quality_score numeric,
  sent boolean not null default false,
  replied boolean not null default false,
  bounced boolean not null default false,
  reply_type text not null default '',
  occurred_at timestamptz,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists hermills_redacted_events_source_uidx
on public.hermills_redacted_events (user_id, source_type, source_local_id, event_type);

create index if not exists hermills_redacted_events_recorded_idx
on public.hermills_redacted_events (user_id, recorded_at desc);

alter table public.hermills_redacted_events enable row level security;

drop policy if exists hermills_redacted_events_own on public.hermills_redacted_events;
create policy hermills_redacted_events_own on public.hermills_redacted_events
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create table if not exists public.hermills_rule_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete cascade,
  local_profile_id text not null default '',
  scope text not null default 'user' check (scope in ('user', 'company', 'global_anonymous')),
  summary_type text not null default 'learning_rules',
  summary_key text not null default '',
  summary_text text not null default '',
  summary_payload jsonb not null default '{}'::jsonb,
  source_event_count int not null default 0,
  source_rule_ids uuid[] not null default '{}',
  event_window_start timestamptz,
  event_window_end timestamptz,
  confidence numeric not null default 0,
  evidence_count int not null default 0,
  generated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hermills_rule_summaries_user_key_uidx
on public.hermills_rule_summaries (user_id, summary_key);

alter table public.hermills_rule_summaries enable row level security;

drop policy if exists hermills_rule_summaries_select on public.hermills_rule_summaries;
create policy hermills_rule_summaries_select on public.hermills_rule_summaries
for select to authenticated
using (scope = 'global_anonymous' or user_id = auth.uid());

drop policy if exists hermills_rule_summaries_own_write on public.hermills_rule_summaries;
create policy hermills_rule_summaries_own_write on public.hermills_rule_summaries
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and scope <> 'global_anonymous');

create table if not exists public.hermills_learning_pack_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_profile_id text not null default '',
  pack_version text not null,
  pack_hash text not null,
  source_event_count int not null default 0,
  source_rule_ids uuid[] not null default '{}',
  source_rule_summary_ids uuid[] not null default '{}',
  input_fingerprint text,
  rules_fingerprint text,
  preferences_fingerprint text,
  pack_payload jsonb not null default '{}'::jsonb,
  is_current boolean not null default false,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists hermills_learning_pack_versions_version_uidx
on public.hermills_learning_pack_versions (user_id, local_profile_id, pack_version);

create index if not exists hermills_learning_pack_versions_current_idx
on public.hermills_learning_pack_versions (user_id, local_profile_id, is_current);

alter table public.hermills_learning_pack_versions enable row level security;

drop policy if exists hermills_learning_pack_versions_own on public.hermills_learning_pack_versions;
create policy hermills_learning_pack_versions_own on public.hermills_learning_pack_versions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
