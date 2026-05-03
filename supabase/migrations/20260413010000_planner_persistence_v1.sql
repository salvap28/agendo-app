create table if not exists public.planner_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  status text not null default 'active',
  surface text not null default 'unknown',
  input_source text not null default 'text',
  target_date date not null,
  latest_context_bundle jsonb not null default '{}'::jsonb,
  latest_input_id uuid,
  latest_proposal_id uuid,
  applied_proposal_id uuid,
  applied_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.planner_sessions
  drop constraint if exists planner_sessions_status_check;
alter table public.planner_sessions
  add constraint planner_sessions_status_check
  check (status in ('active', 'applied', 'rejected', 'abandoned'));

alter table public.planner_sessions
  drop constraint if exists planner_sessions_surface_check;
alter table public.planner_sessions
  add constraint planner_sessions_surface_check
  check (surface in ('habit_home', 'guided_planning', 'widget', 'notification', 'unknown'));

alter table public.planner_sessions
  drop constraint if exists planner_sessions_input_source_check;
alter table public.planner_sessions
  add constraint planner_sessions_input_source_check
  check (input_source in ('text', 'voice'));

create table if not exists public.planner_inputs (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.planner_sessions(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  source text not null,
  raw_input text not null,
  normalized_input text,
  target_date date not null,
  request_payload jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.planner_inputs
  drop constraint if exists planner_inputs_source_check;
alter table public.planner_inputs
  add constraint planner_inputs_source_check
  check (source in ('text', 'voice'));

create table if not exists public.planner_proposals (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.planner_sessions(id) on delete cascade not null,
  input_id uuid references public.planner_inputs(id) on delete set null,
  user_id uuid references auth.users on delete cascade not null,
  parent_proposal_id uuid references public.planner_proposals(id) on delete set null,
  engine text not null,
  variant text not null default 'initial',
  status text not null default 'active',
  headline text not null,
  summary text not null,
  target_date date not null,
  context_bundle jsonb not null default '{}'::jsonb,
  interpretation jsonb not null default '{}'::jsonb,
  drafts jsonb not null default '[]'::jsonb,
  total_duration_min integer not null default 0,
  explicit_times_count integer not null default 0,
  guided_planning_suggested boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.planner_proposals
  drop constraint if exists planner_proposals_variant_check;
alter table public.planner_proposals
  add constraint planner_proposals_variant_check
  check (variant in ('initial', 'lightened', 'regenerated', 'edited'));

alter table public.planner_proposals
  drop constraint if exists planner_proposals_status_check;
alter table public.planner_proposals
  add constraint planner_proposals_status_check
  check (status in ('active', 'superseded', 'accepted', 'applied', 'rejected'));

create table if not exists public.planner_decisions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.planner_sessions(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  proposal_id uuid references public.planner_proposals(id) on delete set null,
  from_proposal_id uuid references public.planner_proposals(id) on delete set null,
  to_proposal_id uuid references public.planner_proposals(id) on delete set null,
  decision_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.planner_decisions
  drop constraint if exists planner_decisions_type_check;
alter table public.planner_decisions
  add constraint planner_decisions_type_check
  check (decision_type in (
    'proposal_shown',
    'proposal_lightened',
    'proposal_regenerated',
    'proposal_edited',
    'proposal_accepted',
    'proposal_rejected',
    'plan_applied'
  ));

create table if not exists public.planner_applied_blocks (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.planner_sessions(id) on delete cascade not null,
  proposal_id uuid references public.planner_proposals(id) on delete cascade not null,
  decision_id uuid references public.planner_decisions(id) on delete set null,
  user_id uuid references auth.users on delete cascade not null,
  block_id uuid references public.blocks(id) on delete cascade not null,
  created_at timestamp with time zone not null default now(),
  unique (proposal_id, block_id)
);

alter table public.planner_sessions
  drop constraint if exists planner_sessions_latest_input_fk;
alter table public.planner_sessions
  add constraint planner_sessions_latest_input_fk
  foreign key (latest_input_id) references public.planner_inputs(id) on delete set null;

alter table public.planner_sessions
  drop constraint if exists planner_sessions_latest_proposal_fk;
alter table public.planner_sessions
  add constraint planner_sessions_latest_proposal_fk
  foreign key (latest_proposal_id) references public.planner_proposals(id) on delete set null;

alter table public.planner_sessions
  drop constraint if exists planner_sessions_applied_proposal_fk;
alter table public.planner_sessions
  add constraint planner_sessions_applied_proposal_fk
  foreign key (applied_proposal_id) references public.planner_proposals(id) on delete set null;

alter table public.planner_sessions enable row level security;
alter table public.planner_inputs enable row level security;
alter table public.planner_proposals enable row level security;
alter table public.planner_decisions enable row level security;
alter table public.planner_applied_blocks enable row level security;

drop policy if exists "Users can view their own planner sessions" on public.planner_sessions;
drop policy if exists "Users can create their own planner sessions" on public.planner_sessions;
drop policy if exists "Users can update their own planner sessions" on public.planner_sessions;
drop policy if exists "Users can delete their own planner sessions" on public.planner_sessions;
create policy "Users can view their own planner sessions" on public.planner_sessions for select using (auth.uid() = user_id);
create policy "Users can create their own planner sessions" on public.planner_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update their own planner sessions" on public.planner_sessions for update using (auth.uid() = user_id);
create policy "Users can delete their own planner sessions" on public.planner_sessions for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own planner inputs" on public.planner_inputs;
drop policy if exists "Users can create their own planner inputs" on public.planner_inputs;
drop policy if exists "Users can update their own planner inputs" on public.planner_inputs;
drop policy if exists "Users can delete their own planner inputs" on public.planner_inputs;
create policy "Users can view their own planner inputs" on public.planner_inputs for select using (auth.uid() = user_id);
create policy "Users can create their own planner inputs" on public.planner_inputs for insert with check (auth.uid() = user_id);
create policy "Users can update their own planner inputs" on public.planner_inputs for update using (auth.uid() = user_id);
create policy "Users can delete their own planner inputs" on public.planner_inputs for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own planner proposals" on public.planner_proposals;
drop policy if exists "Users can create their own planner proposals" on public.planner_proposals;
drop policy if exists "Users can update their own planner proposals" on public.planner_proposals;
drop policy if exists "Users can delete their own planner proposals" on public.planner_proposals;
create policy "Users can view their own planner proposals" on public.planner_proposals for select using (auth.uid() = user_id);
create policy "Users can create their own planner proposals" on public.planner_proposals for insert with check (auth.uid() = user_id);
create policy "Users can update their own planner proposals" on public.planner_proposals for update using (auth.uid() = user_id);
create policy "Users can delete their own planner proposals" on public.planner_proposals for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own planner decisions" on public.planner_decisions;
drop policy if exists "Users can create their own planner decisions" on public.planner_decisions;
drop policy if exists "Users can update their own planner decisions" on public.planner_decisions;
drop policy if exists "Users can delete their own planner decisions" on public.planner_decisions;
create policy "Users can view their own planner decisions" on public.planner_decisions for select using (auth.uid() = user_id);
create policy "Users can create their own planner decisions" on public.planner_decisions for insert with check (auth.uid() = user_id);
create policy "Users can update their own planner decisions" on public.planner_decisions for update using (auth.uid() = user_id);
create policy "Users can delete their own planner decisions" on public.planner_decisions for delete using (auth.uid() = user_id);

drop policy if exists "Users can view their own planner applied blocks" on public.planner_applied_blocks;
drop policy if exists "Users can create their own planner applied blocks" on public.planner_applied_blocks;
drop policy if exists "Users can update their own planner applied blocks" on public.planner_applied_blocks;
drop policy if exists "Users can delete their own planner applied blocks" on public.planner_applied_blocks;
create policy "Users can view their own planner applied blocks" on public.planner_applied_blocks for select using (auth.uid() = user_id);
create policy "Users can create their own planner applied blocks" on public.planner_applied_blocks for insert with check (auth.uid() = user_id);
create policy "Users can update their own planner applied blocks" on public.planner_applied_blocks for update using (auth.uid() = user_id);
create policy "Users can delete their own planner applied blocks" on public.planner_applied_blocks for delete using (auth.uid() = user_id);

create index if not exists idx_planner_sessions_user_created
  on public.planner_sessions (user_id, created_at desc);
create index if not exists idx_planner_sessions_user_status
  on public.planner_sessions (user_id, status, updated_at desc);
create index if not exists idx_planner_inputs_session_created
  on public.planner_inputs (session_id, created_at desc);
create index if not exists idx_planner_inputs_user_created
  on public.planner_inputs (user_id, created_at desc);
create index if not exists idx_planner_proposals_session_created
  on public.planner_proposals (session_id, created_at desc);
create index if not exists idx_planner_proposals_user_variant
  on public.planner_proposals (user_id, variant, created_at desc);
create index if not exists idx_planner_proposals_parent
  on public.planner_proposals (parent_proposal_id, created_at desc);
create index if not exists idx_planner_decisions_session_created
  on public.planner_decisions (session_id, created_at desc);
create index if not exists idx_planner_decisions_user_type
  on public.planner_decisions (user_id, decision_type, created_at desc);
create index if not exists idx_planner_applied_blocks_session_created
  on public.planner_applied_blocks (session_id, created_at desc);
create index if not exists idx_planner_applied_blocks_block
  on public.planner_applied_blocks (block_id);

alter table public.habit_event_logs
  add column if not exists planner_session_id uuid,
  add column if not exists planner_proposal_id uuid,
  add column if not exists planner_decision_id uuid;

alter table public.habit_event_logs
  drop constraint if exists habit_event_logs_planner_session_fk;
alter table public.habit_event_logs
  add constraint habit_event_logs_planner_session_fk
  foreign key (planner_session_id) references public.planner_sessions(id) on delete set null;

alter table public.habit_event_logs
  drop constraint if exists habit_event_logs_planner_proposal_fk;
alter table public.habit_event_logs
  add constraint habit_event_logs_planner_proposal_fk
  foreign key (planner_proposal_id) references public.planner_proposals(id) on delete set null;

alter table public.habit_event_logs
  drop constraint if exists habit_event_logs_planner_decision_fk;
alter table public.habit_event_logs
  add constraint habit_event_logs_planner_decision_fk
  foreign key (planner_decision_id) references public.planner_decisions(id) on delete set null;

create index if not exists idx_habit_event_logs_planner_session
  on public.habit_event_logs (planner_session_id, occurred_at desc);
create index if not exists idx_habit_event_logs_planner_proposal
  on public.habit_event_logs (planner_proposal_id, occurred_at desc);
create index if not exists idx_habit_event_logs_planner_decision
  on public.habit_event_logs (planner_decision_id, occurred_at desc);
