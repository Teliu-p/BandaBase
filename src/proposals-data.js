const PROPOSAL_COLUMNS = `
  id,
  band_id,
  title,
  detail,
  status,
  voting_type,
  created_by,
  created_at,
  decided_at
`;

const PROPOSAL_OPTION_COLUMNS = `
  id,
  proposal_id,
  label,
  position,
  created_at
`;

const PROPOSAL_VOTE_COLUMNS = `
  id,
  proposal_id,
  user_id,
  option_id,
  vote,
  created_at
`;

async function getProposalsByBandId(supabaseClient, bandId) {
  return await supabaseClient
    .from("proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });
}

async function createProposal(supabaseClient, proposalData, options) {
  const { data: proposal, error } = await supabaseClient
    .from("proposals")
    .insert(proposalData)
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error) return { data: null, error };

  const rows = options.map((label, index) => ({
    proposal_id: proposal.id,
    label,
    position: index
  }));

  const { error: optionError } = await supabaseClient
    .from("proposal_options")
    .insert(rows);

  if (optionError) {
    await supabaseClient.from("proposals").delete().eq("id", proposal.id);
    return { data: null, error: optionError };
  }

  return { data: proposal, error: null };
}

async function updateProposal(supabaseClient, proposalId, proposalData, options) {
  const { data: proposal, error } = await supabaseClient
    .from("proposals")
    .update(proposalData)
    .eq("id", proposalId)
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error) return { data: null, error };

  const { error: deleteError } = await supabaseClient
    .from("proposal_options")
    .delete()
    .eq("proposal_id", proposalId);

  if (deleteError) return { data: null, error: deleteError };

  const rows = options.map((label, index) => ({
    proposal_id: proposalId,
    label,
    position: index
  }));

  const { error: optionError } = await supabaseClient
    .from("proposal_options")
    .insert(rows);

  if (optionError) return { data: null, error: optionError };

  return { data: proposal, error: null };
}

async function deleteProposal(supabaseClient, proposalId) {
  return await supabaseClient
    .from("proposals")
    .delete()
    .eq("id", proposalId);
}

async function getProposalOptionsByProposalIds(supabaseClient, proposalIds) {
  if (!proposalIds.length) return { data: [], error: null };

  return await supabaseClient
    .from("proposal_options")
    .select(PROPOSAL_OPTION_COLUMNS)
    .in("proposal_id", proposalIds)
    .order("position", { ascending: true });
}

async function getProposalVotesByProposalIds(supabaseClient, proposalIds) {
  if (!proposalIds.length) return { data: [], error: null };

  return await supabaseClient
    .from("proposal_votes")
    .select(PROPOSAL_VOTE_COLUMNS)
    .in("proposal_id", proposalIds);
}

async function replaceMyProposalVotes(supabaseClient, proposalId, optionIds) {
  const { error: deleteError } = await supabaseClient
    .from("proposal_votes")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("user_id", currentUser.id);

  if (deleteError) return { data: null, error: deleteError };

  if (!optionIds.length) return { data: [], error: null };

  const rows = optionIds.map(optionId => ({
    proposal_id: proposalId,
    user_id: currentUser.id,
    option_id: optionId
  }));

  return await supabaseClient
    .from("proposal_votes")
    .insert(rows)
    .select(PROPOSAL_VOTE_COLUMNS);
}

async function closeProposal(supabaseClient, proposalId) {
  return await supabaseClient
    .from("proposals")
    .update({
      status: "Cerrada",
      decided_at: new Date().toISOString()
    })
    .eq("id", proposalId)
    .select(PROPOSAL_COLUMNS)
    .single();
}

async function reopenProposal(supabaseClient, proposalId) {
  return await supabaseClient
    .from("proposals")
    .update({
      status: "Abierta",
      decided_at: null
    })
    .eq("id", proposalId)
    .select(PROPOSAL_COLUMNS)
    .single();
}
