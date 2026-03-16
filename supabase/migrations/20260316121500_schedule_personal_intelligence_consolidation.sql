create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  daily_job_id bigint;
  weekly_job_id bigint;
begin
  select jobid into daily_job_id from cron.job where jobname = 'personal-intelligence-daily-job';
  if daily_job_id is not null then
    perform cron.unschedule(daily_job_id);
  end if;

  select jobid into weekly_job_id from cron.job where jobname = 'personal-intelligence-weekly-job';
  if weekly_job_id is not null then
    perform cron.unschedule(weekly_job_id);
  end if;
end $$;

select cron.schedule(
  'personal-intelligence-daily-job',
  '10 6 * * *',
  $$
    select net.http_post(
      url:='https://vgvipqcftsumrejdxbgq.supabase.co/functions/v1/personal-intelligence-consolidation',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{"scope":"daily"}'::jsonb
    );
  $$
);

select cron.schedule(
  'personal-intelligence-weekly-job',
  '40 6 * * 0',
  $$
    select net.http_post(
      url:='https://vgvipqcftsumrejdxbgq.supabase.co/functions/v1/personal-intelligence-consolidation',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{"scope":"weekly"}'::jsonb
    );
  $$
);
