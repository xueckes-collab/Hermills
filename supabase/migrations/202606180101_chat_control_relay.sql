create table if not exists public.hermills_chat_binding_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_session_id text not null,
  local_profile_id text not null default '',
  local_channel_id text not null default '',
  platform text not null,
  binding_code_hash text not null,
  status text not null default 'pending',
  linked_external_user_hash text not null default '',
  linked_display_name text not null default '',
  conversation_id text not null default '',
  result_text text not null default '',
  error text not null default '',
  expires_at timestamptz not null,
  linked_at timestamptz,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hermills_chat_binding_platform_check
    check (platform in ('feishu', 'dingtalk', 'wecom', 'wechat', 'qq')),
  constraint hermills_chat_binding_status_check
    check (status in ('pending', 'linked', 'testing', 'connected', 'failed', 'expired'))
);

create table if not exists public.hermills_chat_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  binding_session_id uuid references public.hermills_chat_binding_sessions(id) on delete set null,
  local_profile_id text not null default '',
  local_channel_id text not null default '',
  platform text not null,
  external_command_id_hash text not null default '',
  conversation_id text not null default '',
  sender_id text not null default '',
  sender_display_name text not null default '',
  raw_text text not null,
  action text not null default 'unknown',
  status text not null default 'queued',
  requires_approval boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  result_text text not null default '',
  error text not null default '',
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hermills_chat_commands_platform_check
    check (platform in ('feishu', 'dingtalk', 'wecom', 'wechat', 'qq')),
  constraint hermills_chat_commands_status_check
    check (status in ('queued', 'running', 'needs-approval', 'completed', 'failed', 'rejected'))
);

create index if not exists hermills_chat_binding_sessions_user_status_idx
  on public.hermills_chat_binding_sessions(user_id, status, expires_at desc);

create index if not exists hermills_chat_commands_user_status_idx
  on public.hermills_chat_commands(user_id, status, created_at asc);

create index if not exists hermills_chat_commands_binding_idx
  on public.hermills_chat_commands(binding_session_id, created_at desc);

alter table public.hermills_chat_binding_sessions enable row level security;
alter table public.hermills_chat_commands enable row level security;

drop policy if exists hermills_chat_binding_sessions_own on public.hermills_chat_binding_sessions;
create policy hermills_chat_binding_sessions_own on public.hermills_chat_binding_sessions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists hermills_chat_commands_own on public.hermills_chat_commands;
create policy hermills_chat_commands_own on public.hermills_chat_commands
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop trigger if exists hermills_chat_binding_sessions_touch_updated_at on public.hermills_chat_binding_sessions;
create trigger hermills_chat_binding_sessions_touch_updated_at
before update on public.hermills_chat_binding_sessions
for each row execute function public.set_updated_at();

drop trigger if exists hermills_chat_commands_touch_updated_at on public.hermills_chat_commands;
create trigger hermills_chat_commands_touch_updated_at
before update on public.hermills_chat_commands
for each row execute function public.set_updated_at();
