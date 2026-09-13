-- Multi-user foundation (ADDITIVE / non-breaking). ALREADY APPLIED to the
-- remote project. Safe to run while the app still uses the anon key: existing
-- permissive RLS policies are left intact, new user_id columns are nullable,
-- and the signup trigger only seeds profiles. The strict RLS flip, NOT NULL,
-- singleton restructure and data backfill happen in the cutover migration.

-- 1) profiles: one row per auth user, holds role + AI access flag.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'user' check (role in ('user','admin')),
  ai_enabled   boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- is_admin(): SECURITY DEFINER so it bypasses RLS on profiles (no recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid() or public.is_admin());

-- handle_new_user(): auto-create a profile on signup (idempotent).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Add nullable user_id to the per-user data tables (DEFAULT auth.uid()).
alter table public.tasks              add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.goals              add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.sessions           add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.achievements       add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.chat_messages      add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.daily_plans        add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.push_subscriptions add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- Singletons: add user_id now (nullable, no default) so the cutover can
-- reassign the existing id=1 rows before restructuring the primary key.
alter table public.settings      add column if not exists user_id uuid references auth.users(id);
alter table public.active_timer  add column if not exists user_id uuid references auth.users(id);

-- 5) Indexes for per-user lookups.
create index if not exists idx_tasks_user_id              on public.tasks(user_id);
create index if not exists idx_goals_user_id              on public.goals(user_id);
create index if not exists idx_sessions_user_id           on public.sessions(user_id);
create index if not exists idx_achievements_user_id       on public.achievements(user_id);
create index if not exists idx_chat_messages_user_id      on public.chat_messages(user_id);
create index if not exists idx_daily_plans_user_id        on public.daily_plans(user_id);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
create index if not exists idx_settings_user_id           on public.settings(user_id);
create index if not exists idx_active_timer_user_id       on public.active_timer(user_id);
