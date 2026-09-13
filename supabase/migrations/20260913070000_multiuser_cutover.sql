-- Multi-user CUTOVER. DO NOT APPLY until:
--   (1) Email + Google auth providers are enabled in the Supabase dashboard, and
--   (2) you have signed in ONCE as wael.kun16@gmail.com (so your auth.users row
--       and profile exist).
-- This links all existing single-user data to your account, makes you the admin,
-- restructures the per-user singleton tables, and switches RLS to strict
-- per-user isolation. Deploy the updated frontend + edge functions together with
-- this migration.

-- ---------------------------------------------------------------------------
-- 1) Backfill: assign every existing row to the owner (you), make you admin.
-- ---------------------------------------------------------------------------
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where email = 'wael.kun16@gmail.com';
  if owner_id is null then
    raise exception 'Sign in once as wael.kun16@gmail.com before running the cutover.';
  end if;

  update public.tasks              set user_id = owner_id where user_id is null;
  update public.goals              set user_id = owner_id where user_id is null;
  update public.sessions           set user_id = owner_id where user_id is null;
  update public.achievements       set user_id = owner_id where user_id is null;
  update public.chat_messages      set user_id = owner_id where user_id is null;
  update public.daily_plans        set user_id = owner_id where user_id is null;
  update public.push_subscriptions set user_id = owner_id where user_id is null;
  update public.settings           set user_id = owner_id where user_id is null;
  update public.active_timer       set user_id = owner_id where user_id is null;

  update public.profiles set role = 'admin', ai_enabled = true where id = owner_id;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Enforce ownership: NOT NULL on the collection tables.
-- ---------------------------------------------------------------------------
alter table public.tasks              alter column user_id set not null;
alter table public.goals              alter column user_id set not null;
alter table public.sessions           alter column user_id set not null;
alter table public.achievements       alter column user_id set not null;
alter table public.chat_messages      alter column user_id set not null;
alter table public.daily_plans        alter column user_id set not null;
alter table public.push_subscriptions alter column user_id set not null;

-- ---------------------------------------------------------------------------
-- 3) Singleton tables become one-row-per-user (user_id is the primary key).
-- ---------------------------------------------------------------------------
-- Drop the interim unique indexes (added by link_existing_data_to_owner) so the
-- new primary key on user_id isn't redundant.
drop index if exists public.settings_user_id_key;
drop index if exists public.active_timer_user_id_key;

alter table public.settings     drop constraint if exists settings_pkey cascade;
alter table public.settings     drop column if exists id;
alter table public.settings     alter column user_id set not null;
alter table public.settings     add primary key (user_id);

alter table public.active_timer drop constraint if exists active_timer_pkey cascade;
alter table public.active_timer drop column if exists id;
alter table public.active_timer alter column user_id set not null;
alter table public.active_timer add primary key (user_id);

-- ---------------------------------------------------------------------------
-- 4) Seed settings + active_timer for every NEW user (extends the signup hook).
-- ---------------------------------------------------------------------------
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

  insert into public.settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.active_timer (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) Strict RLS: each user sees only their own rows. Drop the permissive
--    anon/auth "USING (true)" policies and replace with owner checks.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'tasks','goals','sessions','achievements','chat_messages',
    'daily_plans','push_subscriptions','settings','active_timer'
  ] loop
    execute format('drop policy if exists anon_all_%1$s on public.%1$s;', t);
    execute format('drop policy if exists auth_all_%1$s on public.%1$s;', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid());', t);
  end loop;
end $$;

-- Retired calendar tables: remove anon access; no per-user policy → authenticated
-- reads return empty (the app no longer uses them).
drop policy if exists anon_all_calendar_events on public.calendar_events;
drop policy if exists auth_all_calendar_events on public.calendar_events;
drop policy if exists anon_all_calendar_sync on public.calendar_sync;
drop policy if exists auth_all_calendar_sync on public.calendar_sync;

-- ---------------------------------------------------------------------------
-- 6) Harden profiles: users cannot change their own role / ai_enabled.
--    Only display_name is user-writable; AI access is flipped via an
--    admin-only SECURITY DEFINER function.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant  update (display_name) on public.profiles to authenticated;

grant execute on function public.is_admin() to authenticated, anon;

create or replace function public.admin_set_ai_enabled(target uuid, val boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  update public.profiles set ai_enabled = val where id = target;
end;
$$;

revoke all on function public.admin_set_ai_enabled(uuid, boolean) from public;
grant execute on function public.admin_set_ai_enabled(uuid, boolean) to authenticated;
