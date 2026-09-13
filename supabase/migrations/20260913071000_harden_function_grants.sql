-- Trigger function should never be callable via the API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- These are only needed by signed-in users (RLS / admin panel), never anon.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.admin_user_stats() from anon;
revoke execute on function public.admin_set_ai_enabled(uuid, boolean) from anon;
