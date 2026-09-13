-- Link all pre-existing single-user data to the owner account and make them
-- admin. Non-breaking: did not change RLS or drop columns at this point.
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where email = 'wael.kun16@gmail.com';
  if owner_id is null then
    raise exception 'owner account not found';
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

-- Interim unique indexes so the app could upsert by user_id (superseded by the
-- user_id primary key added in the cutover).
create unique index if not exists settings_user_id_key     on public.settings(user_id);
create unique index if not exists active_timer_user_id_key on public.active_timer(user_id);
