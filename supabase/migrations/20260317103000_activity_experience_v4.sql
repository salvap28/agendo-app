ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS engagement_mode text,
  ADD COLUMN IF NOT EXISTS requires_focus_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_experience_record boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS social_demand_hint text,
  ADD COLUMN IF NOT EXISTS location_mode text,
  ADD COLUMN IF NOT EXISTS presence_mode text;

UPDATE public.blocks
SET
  engagement_mode = COALESCE(
    engagement_mode,
    CASE
      WHEN type IN ('deep_work', 'study') THEN 'deep_focus'
      WHEN type = 'meeting' THEN 'collaborative'
      WHEN type = 'gym' THEN 'movement'
      WHEN type = 'admin' THEN 'admin_light'
      WHEN type = 'break' THEN 'recovery'
      ELSE 'light_execution'
    END
  ),
  requires_focus_mode = COALESCE(
    requires_focus_mode,
    CASE WHEN type IN ('deep_work', 'study') THEN true ELSE false END
  ),
  generates_experience_record = COALESCE(generates_experience_record, true),
  social_demand_hint = COALESCE(
    social_demand_hint,
    CASE
      WHEN type = 'meeting' THEN 'high'
      WHEN type = 'gym' THEN 'medium'
      WHEN type = 'admin' THEN 'low'
      ELSE 'solo'
    END
  ),
  location_mode = COALESCE(
    location_mode,
    CASE
      WHEN type = 'meeting' THEN 'hybrid'
      WHEN type = 'gym' THEN 'in_person'
      ELSE 'unknown'
    END
  ),
  presence_mode = COALESCE(
    presence_mode,
    CASE
      WHEN type = 'meeting' THEN 'required'
      WHEN type = 'break' THEN 'self_directed'
      ELSE 'unknown'
    END
  );

CREATE TABLE IF NOT EXISTS public.activity_experiences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  experience_key text NOT NULL,
  source_block_id uuid REFERENCES public.blocks(id) ON DELETE SET NULL,
  source_focus_session_id text REFERENCES public.focus_sessions(id) ON DELETE CASCADE,
  title_snapshot text,
  block_type_snapshot public.block_type,
  tag_snapshot text,
  engagement_mode text NOT NULL,
  outcome text NOT NULL DEFAULT 'unknown',
  source text NOT NULL,
  scheduled_start timestamp with time zone,
  scheduled_end timestamp with time zone,
  actual_start timestamp with time zone,
  actual_end timestamp with time zone,
  actual_duration_min integer,
  energy_impact text NOT NULL DEFAULT 'unknown',
  cognitive_load text NOT NULL DEFAULT 'unknown',
  perceived_value text NOT NULL DEFAULT 'unknown',
  social_demand text NOT NULL DEFAULT 'unknown',
  outcome_reason text NOT NULL DEFAULT 'unknown',
  location_mode text,
  presence_mode text,
  was_planned boolean NOT NULL DEFAULT true,
  was_completed_as_planned boolean NOT NULL DEFAULT false,
  was_user_confirmed boolean NOT NULL DEFAULT false,
  was_system_inferred boolean NOT NULL DEFAULT false,
  confidence numeric,
  notes text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, experience_key)
);

ALTER TABLE public.activity_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity experiences" ON public.activity_experiences;
CREATE POLICY "Users can view their own activity experiences"
  ON public.activity_experiences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own activity experiences" ON public.activity_experiences;
CREATE POLICY "Users can create their own activity experiences"
  ON public.activity_experiences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own activity experiences" ON public.activity_experiences;
CREATE POLICY "Users can update their own activity experiences"
  ON public.activity_experiences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own activity experiences" ON public.activity_experiences;
CREATE POLICY "Users can delete their own activity experiences"
  ON public.activity_experiences FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_experiences_user_scheduled
  ON public.activity_experiences (user_id, scheduled_start DESC);

CREATE INDEX IF NOT EXISTS idx_activity_experiences_user_block
  ON public.activity_experiences (user_id, source_block_id);

CREATE INDEX IF NOT EXISTS idx_activity_experiences_user_focus
  ON public.activity_experiences (user_id, source_focus_session_id);

CREATE INDEX IF NOT EXISTS idx_activity_experiences_user_engagement_outcome
  ON public.activity_experiences (user_id, engagement_mode, outcome, updated_at DESC);

ALTER TABLE public.daily_metrics
  ADD COLUMN IF NOT EXISTS attendance_rate numeric,
  ADD COLUMN IF NOT EXISTS skip_rate numeric,
  ADD COLUMN IF NOT EXISTS postpone_rate numeric,
  ADD COLUMN IF NOT EXISTS non_focus_completion_rate numeric,
  ADD COLUMN IF NOT EXISTS passive_load_score numeric,
  ADD COLUMN IF NOT EXISTS logistics_load_score numeric,
  ADD COLUMN IF NOT EXISTS collaborative_load_score numeric,
  ADD COLUMN IF NOT EXISTS recovery_effect_score numeric,
  ADD COLUMN IF NOT EXISTS transition_cost_score numeric,
  ADD COLUMN IF NOT EXISTS real_day_load_score numeric,
  ADD COLUMN IF NOT EXISTS residual_energy_estimate numeric,
  ADD COLUMN IF NOT EXISTS plan_reality_variance numeric;

ALTER TABLE public.user_behavior_profile
  ADD COLUMN IF NOT EXISTS activity_signals jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_patterns jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activity_analytics jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_activity_analytics_at timestamp with time zone;

INSERT INTO public.activity_experiences (
  user_id,
  experience_key,
  source_block_id,
  source_focus_session_id,
  title_snapshot,
  block_type_snapshot,
  tag_snapshot,
  engagement_mode,
  outcome,
  source,
  scheduled_start,
  scheduled_end,
  actual_start,
  actual_end,
  actual_duration_min,
  energy_impact,
  cognitive_load,
  perceived_value,
  social_demand,
  outcome_reason,
  location_mode,
  presence_mode,
  was_planned,
  was_completed_as_planned,
  was_user_confirmed,
  was_system_inferred,
  confidence,
  metadata_json
)
SELECT
  fs.user_id,
  CONCAT('focus:', fs.id),
  fs.block_id,
  fs.id,
  COALESCE(b.title, fs.intention, 'Focus session'),
  fs.block_type,
  b.tag,
  'deep_focus',
  CASE
    WHEN fsa.closure_type = 'completed' THEN 'completed'
    WHEN fsa.closure_type = 'abandoned' THEN 'interrupted'
    ELSE 'unknown'
  END,
  'focus',
  fs.started_at,
  fs.ended_at,
  fs.started_at,
  fs.ended_at,
  CASE
    WHEN fs.ended_at IS NOT NULL THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (fs.ended_at - fs.started_at)) / 60))
    ELSE NULL
  END,
  CASE
    WHEN fs.mood_after IS NULL OR fs.mood_before IS NULL THEN 'unknown'
    WHEN fs.mood_after - fs.mood_before >= 2 THEN 'energizing'
    WHEN fs.mood_after - fs.mood_before = 1 THEN 'neutral'
    WHEN fs.mood_after - fs.mood_before <= -2 THEN 'draining'
    ELSE 'demanding'
  END,
  CASE
    WHEN COALESCE(fs.difficulty, 0) >= 4 THEN 'high'
    WHEN COALESCE(fs.difficulty, 0) >= 2 THEN 'medium'
    WHEN fs.difficulty IS NULL THEN 'unknown'
    ELSE 'low'
  END,
  CASE
    WHEN COALESCE(fs.progress_feeling_after, 0) >= 4 THEN 'high'
    WHEN COALESCE(fs.progress_feeling_after, 0) >= 2 THEN 'medium'
    WHEN fs.progress_feeling_after IS NULL THEN 'unknown'
    ELSE 'low'
  END,
  COALESCE(b.social_demand_hint, 'solo'),
  CASE
    WHEN fsa.closure_type = 'completed' THEN 'completed_as_planned'
    WHEN fsa.closure_type = 'abandoned' THEN 'high_friction'
    ELSE 'unknown'
  END,
  COALESCE(b.location_mode, 'unknown'),
  COALESCE(b.presence_mode, 'self_directed'),
  true,
  COALESCE(fsa.closure_type = 'completed', false),
  false,
  false,
  CASE
    WHEN fsa.closure_type IS NOT NULL THEN 0.92
    ELSE 0.8
  END,
  jsonb_build_object('backfilled', true)
FROM public.focus_sessions fs
LEFT JOIN public.focus_session_analytics fsa
  ON fsa.session_id = fs.id
LEFT JOIN public.blocks b
  ON b.id = fs.block_id
WHERE fs.ended_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.activity_experiences ae
    WHERE ae.user_id = fs.user_id
      AND ae.experience_key = CONCAT('focus:', fs.id)
  );

INSERT INTO public.activity_experiences (
  user_id,
  experience_key,
  source_block_id,
  title_snapshot,
  block_type_snapshot,
  tag_snapshot,
  engagement_mode,
  outcome,
  source,
  scheduled_start,
  scheduled_end,
  actual_start,
  actual_end,
  actual_duration_min,
  energy_impact,
  cognitive_load,
  perceived_value,
  social_demand,
  outcome_reason,
  location_mode,
  presence_mode,
  was_planned,
  was_completed_as_planned,
  was_user_confirmed,
  was_system_inferred,
  confidence,
  metadata_json
)
SELECT
  b.user_id,
  CONCAT('block:', b.id),
  b.id,
  b.title,
  b.type,
  b.tag,
  COALESCE(
    b.engagement_mode,
    CASE
      WHEN b.type = 'meeting' THEN 'collaborative'
      WHEN b.type = 'gym' THEN 'movement'
      WHEN b.type = 'admin' THEN 'admin_light'
      WHEN b.type = 'break' THEN 'recovery'
      ELSE 'light_execution'
    END
  ),
  CASE
    WHEN b.status = 'completed' THEN 'completed'
    WHEN b.status = 'canceled' THEN 'cancelled'
    WHEN b.type IN ('meeting', 'gym') AND b.end_at < now() THEN 'attended'
    ELSE 'unknown'
  END,
  'system_inferred',
  b.start_at,
  b.end_at,
  CASE
    WHEN b.status = 'completed' OR (b.type IN ('meeting', 'gym') AND b.end_at < now()) THEN b.start_at
    ELSE NULL
  END,
  CASE
    WHEN b.status = 'completed' OR (b.type IN ('meeting', 'gym') AND b.end_at < now()) THEN b.end_at
    ELSE NULL
  END,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (b.end_at - b.start_at)) / 60)),
  'unknown',
  CASE
    WHEN COALESCE(b.intensity, 'light') = 'high' OR COALESCE(b.difficulty, 0) >= 4 THEN 'high'
    WHEN COALESCE(b.intensity, 'light') = 'medium' OR COALESCE(b.difficulty, 0) >= 2 THEN 'medium'
    ELSE 'low'
  END,
  'unknown',
  COALESCE(b.social_demand_hint, 'unknown'),
  CASE
    WHEN b.status = 'completed' THEN 'completed_as_planned'
    WHEN b.status = 'canceled' THEN 'cancelled_by_other'
    WHEN b.type IN ('meeting', 'gym') AND b.end_at < now() THEN 'attended_as_expected'
    ELSE 'unknown'
  END,
  COALESCE(b.location_mode, 'unknown'),
  COALESCE(b.presence_mode, 'unknown'),
  true,
  COALESCE(b.status = 'completed', false),
  false,
  true,
  CASE
    WHEN b.status IN ('completed', 'canceled') THEN 0.78
    WHEN b.type IN ('meeting', 'gym') AND b.end_at < now() THEN 0.58
    ELSE 0.25
  END,
  jsonb_build_object('backfilled', true, 'inferred_from_block', true)
FROM public.blocks b
WHERE b.end_at < now()
  AND COALESCE(b.requires_focus_mode, false) = false
  AND COALESCE(b.generates_experience_record, true) = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.activity_experiences ae
    WHERE ae.user_id = b.user_id
      AND ae.experience_key = CONCAT('block:', b.id)
  );
