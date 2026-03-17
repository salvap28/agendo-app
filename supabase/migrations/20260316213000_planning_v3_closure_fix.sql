ALTER TABLE public.planning_recommendations
  ADD COLUMN IF NOT EXISTS applyability jsonb NOT NULL DEFAULT '{"mode":"manual","helperText":"Conviene revisarlo manualmente."}'::jsonb,
  ADD COLUMN IF NOT EXISTS action_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ignored_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS seen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accepted_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismissed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ignored_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS applied_count integer NOT NULL DEFAULT 0;

UPDATE public.planning_recommendations
SET recommendation_id = user_id::text || ':' || recommendation_id
WHERE split_part(recommendation_id, ':', 1) <> user_id::text;

UPDATE public.planning_recommendations
SET
  action_mode = CASE
    WHEN type IN ('protect_focus_window', 'downgrade_goal') THEN 'manual'
    WHEN suggested_action ->> 'kind' IN ('move', 'shorten', 'split', 'insert_break', 'mark_optional') THEN 'auto'
    ELSE 'manual'
  END,
  applyability = CASE
    WHEN type IN ('protect_focus_window', 'downgrade_goal') THEN '{"mode":"manual","helperText":"Conviene revisarlo manualmente."}'::jsonb
    WHEN suggested_action ->> 'kind' IN ('move', 'shorten', 'split', 'insert_break', 'mark_optional') THEN '{"mode":"auto","helperText":"Agendo puede aplicar este ajuste automaticamente."}'::jsonb
    ELSE '{"mode":"manual","helperText":"Conviene revisarlo manualmente."}'::jsonb
  END,
  accepted_at = COALESCE(accepted_at, CASE WHEN status = 'accepted' THEN updated_at END),
  dismissed_at = COALESCE(dismissed_at, CASE WHEN status = 'dismissed' THEN updated_at END),
  applied_at = COALESCE(applied_at, CASE WHEN status = 'applied' THEN updated_at END),
  ignored_at = COALESCE(ignored_at, CASE WHEN status = 'ignored' THEN updated_at END),
  first_seen_at = COALESCE(first_seen_at, created_at),
  last_seen_at = COALESCE(last_seen_at, updated_at, created_at),
  seen_count = GREATEST(seen_count, 1),
  accepted_count = CASE WHEN status = 'accepted' AND accepted_count = 0 THEN 1 ELSE accepted_count END,
  dismissed_count = CASE WHEN status = 'dismissed' AND dismissed_count = 0 THEN 1 ELSE dismissed_count END,
  ignored_count = CASE WHEN status = 'ignored' AND ignored_count = 0 THEN 1 ELSE ignored_count END,
  applied_count = CASE WHEN status = 'applied' AND applied_count = 0 THEN 1 ELSE applied_count END,
  reversible = false;

ALTER TABLE public.planning_recommendations
  ALTER COLUMN reversible SET DEFAULT false;

ALTER TABLE public.planning_recommendations
  DROP CONSTRAINT IF EXISTS planning_recommendations_status_check;

ALTER TABLE public.planning_recommendations
  ADD CONSTRAINT planning_recommendations_status_check
    CHECK (status IN ('active', 'dismissed', 'accepted', 'ignored', 'expired', 'applied'));

ALTER TABLE public.planning_recommendations
  DROP CONSTRAINT IF EXISTS planning_recommendations_action_mode_check;

ALTER TABLE public.planning_recommendations
  ADD CONSTRAINT planning_recommendations_action_mode_check
    CHECK (action_mode IN ('informational', 'manual', 'auto'));

CREATE INDEX IF NOT EXISTS idx_planning_recommendations_user_type_status
  ON public.planning_recommendations (user_id, type, status, updated_at DESC);
