-- The legacy `id` columns on the per-user singleton tables were NOT NULL with
-- no default, so upserts keyed by user_id (timer sync, settings save) failed
-- the not-null check. Nothing reads `id` anymore (all functions use user_id),
-- so drop it. user_id is already the primary key.
alter table public.settings     drop column if exists id;
alter table public.active_timer drop column if exists id;
