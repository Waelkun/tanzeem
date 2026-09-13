-- CUTOVER: strict per-user isolation (as actually applied). Data was already
-- linked to the owner. The singleton `id` columns were retained here for
-- compatibility with the previously deployed functions and dropped in a later
-- migration once every function was redeployed.

-- 1) Enforce ownership on collection tables.
alter table public.tasks              alter column user_id set not null;
alter table public.goals              alter column user_id set not null;
alter table public.sessions           alter column user_id set not null;
alter table public.achievements       alter column user_id set not null;
alter table public.chat_messages      alter column user_id set not null;
alter table public.daily_plans        alter column user_id set not null;
alter table public.push_subscriptions alter column user_id set not null;

-- 2) settings + active_timer become keyed by user_id.
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid='public.settings'::regclass and contype='c' loop
    execute format('alter table public.settings drop constraint %I', c);
  end loop;
end $$;
alter table public.settings alter column id drop default;
alter table public.settings drop constraint if exists settings_pkey cascade;
drop index if exists public.settings_user_id_key;
alter table public.settings alter column user_id set not null;
alter table public.settings add primary key (user_id);

do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid='public.active_timer'::regclass and contype='c' loop
    execute format('alter table public.active_timer drop constraint %I', c);
  end loop;
end $$;
alter table public.active_timer alter column id drop default;
alter table public.active_timer drop constraint if exists active_timer_pkey cascade;
drop index if exists public.active_timer_user_id_key;
alter table public.active_timer alter column user_id set not null;
alter table public.active_timer add primary key (user_id);

-- 3) Strict RLS: each user sees only their own rows.
do $$ declare t text; begin
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

-- Retired calendar tables: remove anon/auth access entirely.
drop policy if exists anon_all_calendar_events on public.calendar_events;
drop policy if exists auth_all_calendar_events on public.calendar_events;
drop policy if exists anon_all_calendar_sync on public.calendar_sync;
drop policy if exists auth_all_calendar_sync on public.calendar_sync;

-- 4) Harden profiles: users can't change their own role / ai_enabled.
revoke update on public.profiles from authenticated;
grant  update (display_name) on public.profiles to authenticated;
