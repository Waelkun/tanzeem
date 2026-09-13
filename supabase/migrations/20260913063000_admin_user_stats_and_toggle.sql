-- Admin-only per-user statistics (counts, tracked time, estimated data size).
create or replace function public.admin_user_stats()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  ai_enabled boolean,
  created_at timestamptz,
  tasks bigint,
  sessions bigint,
  achievements bigint,
  goals bigint,
  chat_messages bigint,
  daily_plans bigint,
  tracked_seconds bigint,
  est_bytes bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select
      p.id, p.email, p.display_name, p.role, p.ai_enabled, p.created_at,
      (select count(*) from tasks t where t.user_id = p.id),
      (select count(*) from sessions s where s.user_id = p.id),
      (select count(*) from achievements a where a.user_id = p.id),
      (select count(*) from goals g where g.user_id = p.id),
      (select count(*) from chat_messages c where c.user_id = p.id),
      (select count(*) from daily_plans d where d.user_id = p.id),
      coalesce((select sum(s.duration_seconds) from sessions s where s.user_id = p.id), 0)::bigint,
      (
        coalesce((select sum(pg_column_size(t.*)) from tasks t where t.user_id = p.id), 0) +
        coalesce((select sum(pg_column_size(s.*)) from sessions s where s.user_id = p.id), 0) +
        coalesce((select sum(pg_column_size(a.*)) from achievements a where a.user_id = p.id), 0) +
        coalesce((select sum(pg_column_size(g.*)) from goals g where g.user_id = p.id), 0) +
        coalesce((select sum(pg_column_size(c.*)) from chat_messages c where c.user_id = p.id), 0) +
        coalesce((select sum(pg_column_size(d.*)) from daily_plans d where d.user_id = p.id), 0)
      )::bigint
    from profiles p
    order by p.created_at;
end;
$$;

revoke all on function public.admin_user_stats() from public;
grant execute on function public.admin_user_stats() to authenticated;

-- Admin-only AI toggle: users can never flip their own ai_enabled directly.
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

grant execute on function public.is_admin() to authenticated;
