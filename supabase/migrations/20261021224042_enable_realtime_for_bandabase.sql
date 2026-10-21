-- Enable Realtime on tables that back the shared BandaBase UI.
-- Realtime still applies each authenticated user's SELECT/RLS visibility.
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.audit_log,
  public.band_list_items,
  public.band_list_managers,
  public.band_lists,
  public.band_members,
  public.bands,
  public.comment_attachments,
  public.comment_blocks,
  public.comments,
  public.material_attachments,
  public.material_blocks,
  public.materials,
  public.profiles,
  public.proposal_attachments,
  public.proposal_blocks,
  public.proposal_options,
  public.proposal_votes,
  public.proposals,
  public.song_singers,
  public.songs;
