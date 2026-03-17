-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Create blocks table
create type public.block_type as enum ('deep_work', 'study', 'gym', 'meeting', 'admin', 'break', 'other');
create type public.block_status as enum ('planned', 'active', 'completed', 'canceled');

create table public.blocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  type public.block_type not null,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  status public.block_status not null,
  notes text,
  tag text,
  color text,
  priority smallint,
  estimated_duration_minutes integer,
  difficulty smallint,
  flexibility text,
  intensity text,
  deadline timestamp with time zone,
  cognitively_heavy boolean default false,
  splittable boolean default true,
  optional boolean default false,
  recurrence_id text,
  recurrence_pattern jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for blocks
alter table public.blocks enable row level security;
create policy "Users can view their own blocks" on public.blocks for select using (auth.uid() = user_id);
create policy "Users can create their own blocks" on public.blocks for insert with check (auth.uid() = user_id);
create policy "Users can update their own blocks" on public.blocks for update using (auth.uid() = user_id);
create policy "Users can delete their own blocks" on public.blocks for delete using (auth.uid() = user_id);

-- Create focus_sessions table
create table public.focus_sessions (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  mode text not null, -- 'block' or 'free'
  block_id uuid references public.blocks(id) on delete set null,
  block_type public.block_type,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  is_active boolean default true,
  is_paused boolean default false,
  paused_at timestamp with time zone,
  total_paused_ms bigint default 0,
  pause_count integer default 0,
  exit_count integer default 0,
  intention text,
  energy_before smallint,
  mood_before smallint,
  mood_after smallint,
  progress_feeling_after smallint,
  difficulty smallint,
  clarity smallint,
  start_delay_ms integer,
  previous_context text,
  session_quality_score numeric,
  active_layer jsonb,
  history jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for focus_sessions
alter table public.focus_sessions enable row level security;
create policy "Users can view their own sessions" on public.focus_sessions for select using (auth.uid() = user_id);
create policy "Users can create their own sessions" on public.focus_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update their own sessions" on public.focus_sessions for update using (auth.uid() = user_id);
create policy "Users can delete their own sessions" on public.focus_sessions for delete using (auth.uid() = user_id);

-- Create daily_metrics table
create table public.daily_metrics (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  date date not null,
  progress_score numeric,
  friction_score numeric,
  consistency_score numeric,
  emotion_score numeric,
  momentum_day numeric,
  momentum_total numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  UNIQUE(user_id, date)
);

-- Enable RLS for daily_metrics
alter table public.daily_metrics enable row level security;
create policy "Users can view their own daily metrics" on public.daily_metrics for select using (auth.uid() = user_id);
create policy "Users can create their own daily metrics" on public.daily_metrics for insert with check (auth.uid() = user_id);
create policy "Users can update their own daily metrics" on public.daily_metrics for update using (auth.uid() = user_id);
create policy "Users can delete their own daily metrics" on public.daily_metrics for delete using (auth.uid() = user_id);

-- Create indexes for frequent queries
create index idx_daily_metrics_user_date on public.daily_metrics (user_id, date);

create table if not exists public.planning_recommendations (
  recommendation_id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  target_block_id uuid references public.blocks(id) on delete cascade,
  target_date date,
  type text not null,
  scope text not null,
  status text not null default 'active',
  confidence numeric not null,
  priority text not null,
  title text not null,
  message text not null,
  reason_code text not null,
  reason_payload jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  applyability jsonb not null default '{"mode":"manual","helperText":"Conviene revisarlo manualmente."}'::jsonb,
  action_mode text not null default 'manual',
  suggested_action jsonb not null default '{}'::jsonb,
  dismissible boolean not null default true,
  reversible boolean not null default false,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone,
  accepted_at timestamp with time zone,
  applied_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  ignored_at timestamp with time zone,
  first_seen_at timestamp with time zone,
  last_seen_at timestamp with time zone,
  seen_count integer not null default 0,
  accepted_count integer not null default 0,
  dismissed_count integer not null default 0,
  ignored_count integer not null default 0,
  applied_count integer not null default 0,
  updated_at timestamp with time zone default now()
);

alter table public.planning_recommendations
  add constraint planning_recommendations_status_check
  check (status in ('active', 'dismissed', 'accepted', 'ignored', 'expired', 'applied'));

alter table public.planning_recommendations
  add constraint planning_recommendations_action_mode_check
  check (action_mode in ('informational', 'manual', 'auto'));

alter table public.planning_recommendations enable row level security;
create policy "Users can view their own planning recommendations" on public.planning_recommendations for select using (auth.uid() = user_id);
create policy "Users can create their own planning recommendations" on public.planning_recommendations for insert with check (auth.uid() = user_id);
create policy "Users can update their own planning recommendations" on public.planning_recommendations for update using (auth.uid() = user_id);
create policy "Users can delete their own planning recommendations" on public.planning_recommendations for delete using (auth.uid() = user_id);

create index if not exists idx_planning_recommendations_user_date on public.planning_recommendations (user_id, target_date, status);
create index if not exists idx_planning_recommendations_user_block on public.planning_recommendations (user_id, target_block_id, status);
create index if not exists idx_planning_recommendations_user_type_status on public.planning_recommendations (user_id, type, status, updated_at desc);

-- V2 Personal Intelligence
alter table public.focus_sessions
  add column if not exists initiated_at timestamp with time zone,
  add column if not exists consolidated_at timestamp with time zone,
  add column if not exists planned_duration_ms bigint,
  add column if not exists rest_count integer default 0,
  add column if not exists last_pause_reason text,
  add column if not exists pause_events jsonb default '[]'::jsonb,
  add column if not exists exit_events jsonb default '[]'::jsonb,
  add column if not exists first_interaction_at timestamp with time zone,
  add column if not exists last_interaction_at timestamp with time zone,
  add column if not exists next_step text,
  add column if not exists minimum_viable text,
  add column if not exists card_memory jsonb default '{}'::jsonb,
  add column if not exists closure_bridge_shown boolean default false,
  add column if not exists closure_note jsonb,
  add column if not exists entry_ritual jsonb;

create index if not exists idx_focus_sessions_user_started_at on public.focus_sessions (user_id, started_at desc);

alter table public.daily_metrics
  add column if not exists session_count integer default 0,
  add column if not exists completed_sessions integer default 0,
  add column if not exists abandoned_sessions integer default 0,
  add column if not exists active_duration_ms bigint default 0,
  add column if not exists pause_duration_ms bigint default 0,
  add column if not exists inactivity_duration_ms bigint default 0,
  add column if not exists behavior_score numeric;

create table if not exists public.focus_session_events (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id text references public.focus_sessions(id) on delete cascade not null,
  event_type text not null,
  runtime_state text not null,
  occurred_at timestamp with time zone not null,
  relative_ms integer not null default 0,
  payload jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.focus_session_events enable row level security;
drop policy if exists "Users can view their own focus session events" on public.focus_session_events;
drop policy if exists "Users can create their own focus session events" on public.focus_session_events;
drop policy if exists "Users can update their own focus session events" on public.focus_session_events;
drop policy if exists "Users can delete their own focus session events" on public.focus_session_events;
create policy "Users can view their own focus session events" on public.focus_session_events for select using (auth.uid() = user_id);
create policy "Users can create their own focus session events" on public.focus_session_events for insert with check (auth.uid() = user_id);
create policy "Users can update their own focus session events" on public.focus_session_events for update using (auth.uid() = user_id);
create policy "Users can delete their own focus session events" on public.focus_session_events for delete using (auth.uid() = user_id);

create index if not exists idx_focus_session_events_user_session_at
  on public.focus_session_events (user_id, session_id, occurred_at desc);

create table if not exists public.focus_session_interventions (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  session_id text references public.focus_sessions(id) on delete cascade not null,
  occurred_at timestamp with time zone not null,
  type text not null,
  source_card text,
  source_toast text,
  trigger text,
  action_taken text,
  result text,
  payload jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.focus_session_interventions enable row level security;
drop policy if exists "Users can view their own focus interventions" on public.focus_session_interventions;
drop policy if exists "Users can create their own focus interventions" on public.focus_session_interventions;
drop policy if exists "Users can update their own focus interventions" on public.focus_session_interventions;
drop policy if exists "Users can delete their own focus interventions" on public.focus_session_interventions;
create policy "Users can view their own focus interventions" on public.focus_session_interventions for select using (auth.uid() = user_id);
create policy "Users can create their own focus interventions" on public.focus_session_interventions for insert with check (auth.uid() = user_id);
create policy "Users can update their own focus interventions" on public.focus_session_interventions for update using (auth.uid() = user_id);
create policy "Users can delete their own focus interventions" on public.focus_session_interventions for delete using (auth.uid() = user_id);

create index if not exists idx_focus_session_interventions_user_session_at
  on public.focus_session_interventions (user_id, session_id, occurred_at desc);

create table if not exists public.focus_session_analytics (
  session_id text primary key references public.focus_sessions(id) on delete cascade,
  user_id uuid references auth.users on delete cascade not null,
  mode text not null,
  block_type public.block_type,
  time_window text not null,
  duration_bucket text not null,
  initiated_at timestamp with time zone not null,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone not null,
  entry_duration_ms bigint not null default 0,
  planned_duration_ms bigint not null default 0,
  actual_duration_ms bigint not null default 0,
  active_duration_ms bigint not null default 0,
  pause_duration_ms bigint not null default 0,
  inactivity_duration_ms bigint not null default 0,
  pause_count integer not null default 0,
  exit_count integer not null default 0,
  task_change_count integer not null default 0,
  intervention_count integer not null default 0,
  intervention_accept_count integer not null default 0,
  intervention_ignore_count integer not null default 0,
  inactivity_count integer not null default 0,
  stability_recovery_count integer not null default 0,
  closure_type text not null,
  completion_ratio numeric,
  stability_ratio numeric,
  continuity_ratio numeric,
  recovery_ratio numeric,
  start_delay_ms integer not null default 0,
  progress_score numeric,
  friction_score numeric,
  consistency_score numeric,
  behavior_score numeric,
  diagnostics jsonb default '{}'::jsonb,
  computed_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.focus_session_analytics enable row level security;
drop policy if exists "Users can view their own focus session analytics" on public.focus_session_analytics;
drop policy if exists "Users can create their own focus session analytics" on public.focus_session_analytics;
drop policy if exists "Users can update their own focus session analytics" on public.focus_session_analytics;
drop policy if exists "Users can delete their own focus session analytics" on public.focus_session_analytics;
create policy "Users can view their own focus session analytics" on public.focus_session_analytics for select using (auth.uid() = user_id);
create policy "Users can create their own focus session analytics" on public.focus_session_analytics for insert with check (auth.uid() = user_id);
create policy "Users can update their own focus session analytics" on public.focus_session_analytics for update using (auth.uid() = user_id);
create policy "Users can delete their own focus session analytics" on public.focus_session_analytics for delete using (auth.uid() = user_id);

create index if not exists idx_focus_session_analytics_user_ended_at
  on public.focus_session_analytics (user_id, ended_at desc);
create index if not exists idx_focus_session_analytics_user_time_window
  on public.focus_session_analytics (user_id, time_window);
create index if not exists idx_focus_session_analytics_user_duration_bucket
  on public.focus_session_analytics (user_id, duration_bucket);

create table if not exists public.user_behavior_profile (
  user_id uuid primary key references auth.users on delete cascade,
  warmup_stage text not null default 'cold',
  best_focus_window jsonb,
  optimal_session_length jsonb,
  top_friction_sources jsonb default '[]'::jsonb,
  consistency_trend jsonb,
  recent_improvements jsonb default '[]'::jsonb,
  active_patterns jsonb default '[]'::jsonb,
  confidence_overview jsonb default '{}'::jsonb,
  last_session_analytics_at timestamp with time zone,
  last_daily_consolidated_at timestamp with time zone,
  last_weekly_consolidated_at timestamp with time zone,
  last_updated_at timestamp with time zone default now(),
  profile_version text not null default 'v2'
);

alter table public.user_behavior_profile enable row level security;
drop policy if exists "Users can view their own behavior profile" on public.user_behavior_profile;
drop policy if exists "Users can create their own behavior profile" on public.user_behavior_profile;
drop policy if exists "Users can update their own behavior profile" on public.user_behavior_profile;
drop policy if exists "Users can delete their own behavior profile" on public.user_behavior_profile;
create policy "Users can view their own behavior profile" on public.user_behavior_profile for select using (auth.uid() = user_id);
create policy "Users can create their own behavior profile" on public.user_behavior_profile for insert with check (auth.uid() = user_id);
create policy "Users can update their own behavior profile" on public.user_behavior_profile for update using (auth.uid() = user_id);
create policy "Users can delete their own behavior profile" on public.user_behavior_profile for delete using (auth.uid() = user_id);

create table if not exists public.behavior_pattern_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  pattern_key text not null,
  pattern_type text not null,
  status text not null default 'active',
  window_kind text not null,
  confidence numeric,
  sample_size integer not null default 0,
  pattern_data jsonb default '{}'::jsonb,
  evidence jsonb default '{}'::jsonb,
  first_detected_at timestamp with time zone default now(),
  last_confirmed_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, pattern_key)
);

alter table public.behavior_pattern_history enable row level security;
drop policy if exists "Users can view their own behavior pattern history" on public.behavior_pattern_history;
drop policy if exists "Users can create their own behavior pattern history" on public.behavior_pattern_history;
drop policy if exists "Users can update their own behavior pattern history" on public.behavior_pattern_history;
drop policy if exists "Users can delete their own behavior pattern history" on public.behavior_pattern_history;
create policy "Users can view their own behavior pattern history" on public.behavior_pattern_history for select using (auth.uid() = user_id);
create policy "Users can create their own behavior pattern history" on public.behavior_pattern_history for insert with check (auth.uid() = user_id);
create policy "Users can update their own behavior pattern history" on public.behavior_pattern_history for update using (auth.uid() = user_id);
create policy "Users can delete their own behavior pattern history" on public.behavior_pattern_history for delete using (auth.uid() = user_id);

create index if not exists idx_behavior_pattern_history_user_status
  on public.behavior_pattern_history (user_id, status, updated_at desc);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Function to look up a user's email by their username (needed for login)
create or replace function public.get_email_by_username(p_username text)
returns text as $$
declare
  v_email text;
begin
  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username;
  return v_email;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
