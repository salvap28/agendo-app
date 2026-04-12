create table if not exists public.habit_event_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  surface text,
  block_id uuid references public.blocks(id) on delete set null,
  session_id text references public.focus_sessions(id) on delete set null,
  metadata_json jsonb not null default '{}'::jsonb,
  event_date date not null default current_date,
  occurred_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

alter table public.habit_event_logs enable row level security;

drop policy if exists "Users can view their own habit event logs" on public.habit_event_logs;
drop policy if exists "Users can create their own habit event logs" on public.habit_event_logs;
drop policy if exists "Users can update their own habit event logs" on public.habit_event_logs;
drop policy if exists "Users can delete their own habit event logs" on public.habit_event_logs;

create policy "Users can view their own habit event logs"
  on public.habit_event_logs for select
  using (auth.uid() = user_id);

create policy "Users can create their own habit event logs"
  on public.habit_event_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own habit event logs"
  on public.habit_event_logs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own habit event logs"
  on public.habit_event_logs for delete
  using (auth.uid() = user_id);

create index if not exists idx_habit_event_logs_user_date
  on public.habit_event_logs (user_id, event_date desc, occurred_at desc);

create index if not exists idx_habit_event_logs_user_name
  on public.habit_event_logs (user_id, name, occurred_at desc);
