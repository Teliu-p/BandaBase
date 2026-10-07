const PROPOSAL_COLUMNS = "id, band_id, title, detail, status, voting_type, created_by, created_at, decided_at";

async function getProposalsByBandId(client, bandId) {
  return client.from("proposals").select(PROPOSAL_COLUMNS).eq("band_id", bandId).order("created_at", { ascending: false });
}

async function getProposalOptions(client, proposalIds) {
  if (!proposalIds.length) return { data: [], error: null };
  return client.from("proposal_options").select("id, proposal_id, label, position").in("proposal_id", proposalIds).order("position");
}

async function getProposalVotes(client, proposalIds) {
  if (!proposalIds.length) return { data: [], error: null };
  return client.from("proposal_votes").select("id, proposal_id, user_id, option_id, vote").in("proposal_id", proposalIds);
}

async function createProposal(client, proposal, labels) {
  const { data, error } = await client.from("proposals").insert(proposal).select(PROPOSAL_COLUMNS).single();
  if (error) return { data: null, error };
  const rows = labels.map((label, position) => ({ proposal_id: data.id, label, position }));
  const result = await client.from("proposal_options").insert(rows);
  if (result.error) {
    await client.from("proposals").delete().eq("id", data.id);
    return { data: null, error: result.error };
  }
  return { data, error: null };
}

async function saveProposalVote(client, proposalId, optionIds, votingType) {
  const { error: removeError } = await client.from("proposal_votes").delete().eq("proposal_id", proposalId).eq("user_id", currentUser.id);
  if (removeError) return { error: removeError };
  if (!optionIds.length) return { error: null };

  const rows = optionIds.map(optionId => ({
    proposal_id: proposalId,
    user_id: currentUser.id,
    option_id: optionId,
    vote: votingType === "yes_no" ? (optionId === "yes" ? "Sí" : "No") : optionId
  }));
  return { error: (await client.from("proposal_votes").insert(rows)).error };
}

async function setProposalStatus(client, proposalId, status) {
  return client.from("proposals").update({
    status,
    decided_at: status === "Cerrada" ? new Date().toISOString() : null
  }).eq("id", proposalId);
}

async function deleteProposal(client, proposalId) {
  return client.from("proposals").delete().eq("id", proposalId);
}
