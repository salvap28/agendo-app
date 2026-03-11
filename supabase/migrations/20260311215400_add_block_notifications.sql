-- Revert if necessary
-- ALTER TABLE public.blocks DROP COLUMN notifications;

-- Add notifications array column to blocks
-- Defaults to {5} (5 minutes before)
ALTER TABLE public.blocks
ADD COLUMN notifications integer[] DEFAULT '{5}';

-- Update existing blocks
UPDATE public.blocks 
SET notifications = '{5}' 
WHERE notifications IS NULL;
