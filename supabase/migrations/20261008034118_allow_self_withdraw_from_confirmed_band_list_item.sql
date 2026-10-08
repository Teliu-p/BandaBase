-- Allow a member to withdraw themselves even after becoming Participando.
-- The UI deletes the member annotation, so they can annotate again with a different function.

drop policy if exists band_list_items_delete_control_v3 on public.band_list_items;

create policy band_list_items_delete_control_v4
on public.band_list_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.band_lists l
    where l.id = band_list_items.list_id
      and l.deleted_at is null
      and public.is_band_member(l.band_id)
      and (
        public.is_band_admin(l.band_id)
        or l.created_by = auth.uid()
        or (
          band_list_items.item_type = 'member'
          and band_list_items.member_user_id = auth.uid()
          and band_list_items.status in ('Anotado', 'Confirmado')
        )
      )
  )
);
