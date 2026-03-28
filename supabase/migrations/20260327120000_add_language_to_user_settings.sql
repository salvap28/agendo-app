ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en' NOT NULL
CHECK (language IN ('en', 'es'));
