-- Create pg_cron and pg_net extensions if missing
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule cron job to hit the Edge Function every 1 minute
select cron.schedule(
  'send-block-reminders-job',
  '* * * * *',
  $$
    select net.http_post(
        url:='https://vgvipqcftsumrejdxbgq.supabase.co/functions/v1/send-block-reminders',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:='{}'::jsonb
    );
  $$
);
