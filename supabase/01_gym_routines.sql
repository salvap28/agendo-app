-- Create gym_routines table
create table public.gym_routines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  color text not null,
  rep_type text default 'Reps' not null,
  planned_days jsonb default '[]'::jsonb not null,
  rest_timer_sec integer default 180 not null,
  exercises jsonb default '[]'::jsonb not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS for gym_routines
alter table public.gym_routines enable row level security;
create policy "Users can view their own routines" on public.gym_routines for select using (auth.uid() = user_id);
create policy "Users can create their own routines" on public.gym_routines for insert with check (auth.uid() = user_id);
create policy "Users can update their own routines" on public.gym_routines for update using (auth.uid() = user_id);
create policy "Users can delete their own routines" on public.gym_routines for delete using (auth.uid() = user_id);
