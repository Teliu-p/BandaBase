-- This policy is strictly contained by songs_select_active_or_own_trash_or_admin.
-- The latter already grants the same active-song and admin visibility, plus
-- access to rows trashed by the current user. Keeping both only adds an
-- unnecessary permissive-policy evaluation and does not change effective access.
DROP POLICY IF EXISTS songs_select_active_or_admin ON public.songs;
