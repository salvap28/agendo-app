ALTER TABLE public.focus_sessions
ADD COLUMN IF NOT EXISTS initiated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS consolidated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS planned_duration_ms bigint,
ADD COLUMN IF NOT EXISTS rest_count integer default 0,
ADD COLUMN IF NOT EXISTS last_pause_reason text,
ADD COLUMN IF NOT EXISTS pause_events jsonb default '[]'::jsonb,
ADD COLUMN IF NOT EXISTS exit_events jsonb default '[]'::jsonb,
ADD COLUMN IF NOT EXISTS first_interaction_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_interaction_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS next_step text,
ADD COLUMN IF NOT EXISTS minimum_viable text,
ADD COLUMN IF NOT EXISTS card_memory jsonb default '{}'::jsonb,
ADD COLUMN IF NOT EXISTS closure_bridge_shown boolean default false,
ADD COLUMN IF NOT EXISTS closure_note jsonb,
ADD COLUMN IF NOT EXISTS entry_ritual jsonb;

UPDATE public.focus_sessions
SET
  initiated_at = COALESCE(initiated_at, started_at),
  consolidated_at = COALESCE(consolidated_at, started_at),
  planned_duration_ms = COALESCE(
    planned_duration_ms,
    GREATEST(EXTRACT(EPOCH FROM (COALESCE(ended_at, started_at) - started_at)) * 1000, 25 * 60 * 1000)
  ),
  rest_count = COALESCE(rest_count, 0),
  pause_events = COALESCE(pause_events, '[]'::jsonb),
  exit_events = COALESCE(exit_events, '[]'::jsonb),
  card_memory = COALESCE(card_memory, '{}'::jsonb),
  closure_bridge_shown = COALESCE(closure_bridge_shown, false)
WHERE initiated_at IS NULL
   OR consolidated_at IS NULL
   OR planned_duration_ms IS NULL
   OR rest_count IS NULL
   OR pause_events IS NULL
   OR exit_events IS NULL
   OR card_memory IS NULL
   OR closure_bridge_shown IS NULL;

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_started_at ON public.focus_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.focus_session_events (
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

ALTER TABLE public.focus_session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own focus session events" ON public.focus_session_events;
DROP POLICY IF EXISTS "Users can create their own focus session events" ON public.focus_session_events;
DROP POLICY IF EXISTS "Users can update their own focus session events" ON public.focus_session_events;
DROP POLICY IF EXISTS "Users can delete their own focus session events" ON public.focus_session_events;
CREATE POLICY "Users can view their own focus session events" ON public.focus_session_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus session events" ON public.focus_session_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus session events" ON public.focus_session_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus session events" ON public.focus_session_events FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_focus_session_events_user_session_at
  ON public.focus_session_events (user_id, session_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.focus_session_interventions (
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

ALTER TABLE public.focus_session_interventions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own focus interventions" ON public.focus_session_interventions;
DROP POLICY IF EXISTS "Users can create their own focus interventions" ON public.focus_session_interventions;
DROP POLICY IF EXISTS "Users can update their own focus interventions" ON public.focus_session_interventions;
DROP POLICY IF EXISTS "Users can delete their own focus interventions" ON public.focus_session_interventions;
CREATE POLICY "Users can view their own focus interventions" ON public.focus_session_interventions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus interventions" ON public.focus_session_interventions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus interventions" ON public.focus_session_interventions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus interventions" ON public.focus_session_interventions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_focus_session_interventions_user_session_at
  ON public.focus_session_interventions (user_id, session_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.focus_session_analytics (
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

ALTER TABLE public.focus_session_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own focus session analytics" ON public.focus_session_analytics;
DROP POLICY IF EXISTS "Users can create their own focus session analytics" ON public.focus_session_analytics;
DROP POLICY IF EXISTS "Users can update their own focus session analytics" ON public.focus_session_analytics;
DROP POLICY IF EXISTS "Users can delete their own focus session analytics" ON public.focus_session_analytics;
CREATE POLICY "Users can view their own focus session analytics" ON public.focus_session_analytics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own focus session analytics" ON public.focus_session_analytics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus session analytics" ON public.focus_session_analytics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus session analytics" ON public.focus_session_analytics FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_focus_session_analytics_user_ended_at
  ON public.focus_session_analytics (user_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_session_analytics_user_time_window
  ON public.focus_session_analytics (user_id, time_window);
CREATE INDEX IF NOT EXISTS idx_focus_session_analytics_user_duration_bucket
  ON public.focus_session_analytics (user_id, duration_bucket);

ALTER TABLE public.daily_metrics
ADD COLUMN IF NOT EXISTS session_count integer default 0,
ADD COLUMN IF NOT EXISTS completed_sessions integer default 0,
ADD COLUMN IF NOT EXISTS abandoned_sessions integer default 0,
ADD COLUMN IF NOT EXISTS active_duration_ms bigint default 0,
ADD COLUMN IF NOT EXISTS pause_duration_ms bigint default 0,
ADD COLUMN IF NOT EXISTS inactivity_duration_ms bigint default 0,
ADD COLUMN IF NOT EXISTS behavior_score numeric;

CREATE TABLE IF NOT EXISTS public.user_behavior_profile (
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

ALTER TABLE public.user_behavior_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own behavior profile" ON public.user_behavior_profile;
DROP POLICY IF EXISTS "Users can create their own behavior profile" ON public.user_behavior_profile;
DROP POLICY IF EXISTS "Users can update their own behavior profile" ON public.user_behavior_profile;
DROP POLICY IF EXISTS "Users can delete their own behavior profile" ON public.user_behavior_profile;
CREATE POLICY "Users can view their own behavior profile" ON public.user_behavior_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own behavior profile" ON public.user_behavior_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own behavior profile" ON public.user_behavior_profile FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own behavior profile" ON public.user_behavior_profile FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.behavior_pattern_history (
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

ALTER TABLE public.behavior_pattern_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own behavior pattern history" ON public.behavior_pattern_history;
DROP POLICY IF EXISTS "Users can create their own behavior pattern history" ON public.behavior_pattern_history;
DROP POLICY IF EXISTS "Users can update their own behavior pattern history" ON public.behavior_pattern_history;
DROP POLICY IF EXISTS "Users can delete their own behavior pattern history" ON public.behavior_pattern_history;
CREATE POLICY "Users can view their own behavior pattern history" ON public.behavior_pattern_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own behavior pattern history" ON public.behavior_pattern_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own behavior pattern history" ON public.behavior_pattern_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own behavior pattern history" ON public.behavior_pattern_history FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_behavior_pattern_history_user_status
  ON public.behavior_pattern_history (user_id, status, updated_at DESC);
