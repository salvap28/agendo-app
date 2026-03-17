ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS priority smallint,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS difficulty smallint,
  ADD COLUMN IF NOT EXISTS flexibility text,
  ADD COLUMN IF NOT EXISTS intensity text,
  ADD COLUMN IF NOT EXISTS deadline timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cognitively_heavy boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS splittable boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS optional boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.planning_recommendations (
  recommendation_id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE cascade NOT NULL,
  target_block_id uuid REFERENCES public.blocks(id) ON DELETE cascade,
  target_date date,
  type text NOT NULL,
  scope text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  confidence numeric NOT NULL,
  priority text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  reason_code text NOT NULL,
  reason_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_action jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissible boolean NOT NULL DEFAULT true,
  reversible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  applied_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.planning_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own planning recommendations" ON public.planning_recommendations;
CREATE POLICY "Users can view their own planning recommendations"
  ON public.planning_recommendations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own planning recommendations" ON public.planning_recommendations;
CREATE POLICY "Users can create their own planning recommendations"
  ON public.planning_recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own planning recommendations" ON public.planning_recommendations;
CREATE POLICY "Users can update their own planning recommendations"
  ON public.planning_recommendations FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own planning recommendations" ON public.planning_recommendations;
CREATE POLICY "Users can delete their own planning recommendations"
  ON public.planning_recommendations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_planning_recommendations_user_date
  ON public.planning_recommendations (user_id, target_date, status);

CREATE INDEX IF NOT EXISTS idx_planning_recommendations_user_block
  ON public.planning_recommendations (user_id, target_block_id, status);
