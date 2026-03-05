-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  updated_at timestamp with time zone,
  username text unique,
  full_name text,
  avatar_url text,
  preferences jsonb default '{}'::jsonb
);

-- Enable RLS for profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Create blocks table
create type public.block_type as enum ('deep_work', 'study', 'gym', 'meeting', 'admin', 'break', 'other');
create type public.block_status as enum ('planned', 'active', 'completed', 'canceled');

create table public.blocks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  type public.block_type not null,
  start_at timestamp with time zone not null,
  end_at timestamp with time zone not null,
  status public.block_status not null,
  notes text,
  tag text,
  color text,
  recurrence_id text,
  recurrence_pattern jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for blocks
alter table public.blocks enable row level security;
create policy "Users can view their own blocks" on public.blocks for select using (auth.uid() = user_id);
create policy "Users can create their own blocks" on public.blocks for insert with check (auth.uid() = user_id);
create policy "Users can update their own blocks" on public.blocks for update using (auth.uid() = user_id);
create policy "Users can delete their own blocks" on public.blocks for delete using (auth.uid() = user_id);

-- Create focus_sessions table
create table public.focus_sessions (
  id text primary key,
  user_id uuid references auth.users on delete cascade not null,
  mode text not null, -- 'block' or 'free'
  block_id uuid references public.blocks(id) on delete set null,
  block_type public.block_type,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  is_active boolean default true,
  is_paused boolean default false,
  paused_at timestamp with time zone,
  total_paused_ms bigint default 0,
  pause_count integer default 0,
  exit_count integer default 0,
  intention text,
  active_layer jsonb,
  history jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for focus_sessions
alter table public.focus_sessions enable row level security;
create policy "Users can view their own sessions" on public.focus_sessions for select using (auth.uid() = user_id);
create policy "Users can create their own sessions" on public.focus_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update their own sessions" on public.focus_sessions for update using (auth.uid() = user_id);
create policy "Users can delete their own sessions" on public.focus_sessions for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url, username)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

-- Function to look up a user's email by their username (needed for login)
create or replace function public.get_email_by_username(p_username text)
returns text as $$
declare
  v_email text;
begin
  select u.email into v_email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.username = p_username;
  return v_email;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
