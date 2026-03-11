ALTER TABLE public.user_settings
ADD COLUMN notify_block_reminders boolean DEFAULT true NOT NULL,
ADD COLUMN notify_focus_timer boolean DEFAULT true NOT NULL,
ADD COLUMN notify_gym_rest boolean DEFAULT true NOT NULL,
ADD COLUMN notify_daily_briefing boolean DEFAULT true NOT NULL;
