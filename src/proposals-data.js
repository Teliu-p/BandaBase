const PROPOSAL_COLUMNS =
  "id, band_id, title, detail, status, voting_type, voting_visibility, created_by, created_at, decided_at, deleted_at, deleted_by";

const PROPOSAL_ATTACHMENT_COLUMNS =
  "id, proposal_id, band_id, kind, title, file_name, storage_path, url, mime_type, file_size, created_by, created_at";

const PROPOSAL_BLOCK_COLUMNS =
  "id, proposal_id, block_type, content, attachment_id, position, created_at";

async function getProposalBlocksByProposalIds(
  client,
  proposalIds
) {
  if (!proposalIds.length) {
    return { data: [], error: null };
  }

  return client
    .from("proposal_blocks")
    .select(PROPOSAL_BLOCK_COLUMNS)
    .in("proposal_id", proposalIds)
    .order("position", { ascending: true });
}

async function replaceProposalBlocks(
  client,
  proposalId,
  blocks
) {
  const { error: deleteError } =
    await client
      .from("proposal_blocks")
      .delete()
      .eq("proposal_id", proposalId);

  if (deleteError) {
    return { data: null, error: deleteError };
  }

  if (!blocks.length) {
    return { data: [], error: null };
  }

  return client
    .from("proposal_blocks")
    .insert(blocks)
    .select(PROPOSAL_BLOCK_COLUMNS);
}

async function getProposalsByBandId(client, bandId) {
  return client
    .from("proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("band_id", bandId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
}

async function getProposalOptionsByProposalIds(client, proposalIds) {
  if (!proposalIds.length) {
    return { data: [], error: null };
  }

  return client
    .from("proposal_options")
    .select("id, proposal_id, label, position")
    .in("proposal_id", proposalIds)
    .order("position", { ascending: true });
}

async function getProposalVotesByProposalIds(client, proposalIds) {
  if (!proposalIds.length) {
    return { data: [], error: null };
  }

  return client
    .from("proposal_votes")
    .select("id, proposal_id, user_id, option_id, created_at")
    .in("proposal_id", proposalIds);
}

async function getProposalVoteStatsByProposalIds(
  client,
  proposalIds
) {
  if (!proposalIds.length) {
    return { data: [], error: null };
  }

  return await client.rpc(
    "get_proposal_vote_stats",
    {
      p_proposal_ids: proposalIds
    }
  );
}

async function createProposal(client, proposalData, optionLabels) {
  const { data: proposal, error } = await client
    .from("proposals")
    .insert(proposalData)
    .select(PROPOSAL_COLUMNS)
    .single();

  if (error) {
    return { data: null, error };
  }

  const optionRows = optionLabels.map((label, position) => ({
    proposal_id: proposal.id,
    label,
    position
  }));

  const { error: optionError } = await client
    .from("proposal_options")
    .insert(optionRows);

  if (optionError) {
    await client
      .from("proposals")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUser?.id || null
      })
      .eq("id", proposal.id);

    return { data: null, error: optionError };
  }

  return { data: proposal, error: null };
}



async function getProposalAttachmentsByProposalIds(
  client,
  proposalIds
) {
  if (!proposalIds.length) {
    return { data: [], error: null };
  }

  return client
    .from("proposal_attachments")
    .select(PROPOSAL_ATTACHMENT_COLUMNS)
    .in("proposal_id", proposalIds)
    .order("created_at", { ascending: true });
}


async function createProposalAttachment(
  client,
  attachmentData
) {
  return client
    .from("proposal_attachments")
    .insert(attachmentData)
    .select(PROPOSAL_ATTACHMENT_COLUMNS)
    .single();
}


async function replaceMyProposalVotes(client, proposalId, optionIds) {
  return await client.rpc(
    "replace_my_proposal_votes",
    {
      p_proposal_id: proposalId,
      p_option_ids: optionIds || []
    }
  );
}

async function setProposalStatus(client, proposalId, status) {
  return client
    .from("proposals")
    .update({
      status,
      decided_at:
        status === "Cerrada"
          ? new Date().toISOString()
          : null
    })
    .eq("id", proposalId);
}

async function deleteProposal(
  client,
  proposalId,
  deletedBy = currentUser?.id || null
) {
  return await client
    .from("proposals")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy
    })
    .eq("id", proposalId);
}

async function deleteProposals(
  client,
  proposalIds
) {
  const ids = [
    ...new Set(
      (proposalIds || []).filter(Boolean)
    )
  ];

  for (const proposalId of ids) {
    const { error } =
      await deleteProposal(
        client,
        proposalId
      );

    if (error) {
      return { error };
    }
  }

  return { error: null };
}
