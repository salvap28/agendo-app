create table if not exists public.push_subscriptions (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(endpoint)
);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Policies
create policy "Users can view their own subscriptions."
    on public.push_subscriptions for select
    using ( auth.uid() = user_id );

create policy "Users can insert their own subscriptions."
    on public.push_subscriptions for insert
    with check ( auth.uid() = user_id );

create policy "Users can update their own subscriptions."
    on public.push_subscriptions for update
    using ( auth.uid() = user_id );

create policy "Users can delete their own subscriptions."
    on public.push_subscriptions for delete
    using ( auth.uid() = user_id );
