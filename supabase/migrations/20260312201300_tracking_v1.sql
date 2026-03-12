-- Add new tracking columns to focus_sessions
ALTER TABLE public.focus_sessions
ADD COLUMN energy_before smallint,
ADD COLUMN mood_before smallint,
ADD COLUMN mood_after smallint,
ADD COLUMN progress_feeling_after smallint,
ADD COLUMN difficulty smallint,
ADD COLUMN clarity smallint,
ADD COLUMN start_delay_ms integer,
ADD COLUMN previous_context text,
ADD COLUMN session_quality_score numeric;

-- Create daily_metrics table
CREATE TABLE public.daily_metrics (
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
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own daily metrics" ON public.daily_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own daily metrics" ON public.daily_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily metrics" ON public.daily_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own daily metrics" ON public.daily_metrics FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for frequent queries
CREATE INDEX idx_daily_metrics_user_date ON public.daily_metrics (user_id, date);
