/* ============================================================
   NAVEGACIÓN
============================================================ */

function getNavigationStorageKey() {
  return currentBand?.id
    ? "bandabase.activeSection." + currentBand.id
    : "bandabase.activeSection";
}

function getSavedSection() {
  let saved = null;

  try {
    saved = localStorage.getItem(
      getNavigationStorageKey()
    );
  } catch (error) {
    console.warn(
      "No se pudo leer la sección guardada.",
      error
    );
  }

  const valid =
    saved &&
    document.querySelector(
      '.nav-btn[data-section="' +
      CSS.escape(saved) +
      '"]'
    );

  return valid ? saved : "inicio";
}

function persistSection(sectionName) {
  try {
    localStorage.setItem(
      getNavigationStorageKey(),
      sectionName
    );
  } catch (error) {
    console.warn(
      "No se pudo guardar la sección actual.",
      error
    );
  }
}

function setupNavigation() {

  if (navigationInitialized) {
    return;
  }

  document
    .querySelectorAll(
      ".nav-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        function() {

          const section =
            button.dataset.section;

          showSection(
            section
          );

        }
      );

    });

  navigationInitialized = true;

}


function showSection(
  sectionName
) {

  if (
    sectionName === "administracion" &&
    !window.bandabaseIsAdmin?.()
  ) {
    sectionName = "inicio";
  }


  document
    .querySelectorAll(
      ".app-section"
    )
    .forEach(section => {

      section.classList.add(
        "hidden"
      );

    });


  const target =
    document.getElementById(
      "section-" +
      sectionName
    );


  if (target) {

    target.classList.remove(
      "hidden"
    );

  } else {

    return;

  }

  persistSection(sectionName);


  document
    .querySelectorAll(
      ".nav-btn"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.section ===
          sectionName
      );

    });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });


  /*
    Si entramos en Canciones,
    siempre mostramos el navegador
    salvo que ya estemos editando
    una canción.
  */

  if (sectionName === "listas") {

    void loadBandLists();

  }


  if (sectionName === "propuestas") {

    void loadProposals();

  }


  if (sectionName === "inicio") {

    void loadHomeRecentData();

  }

  if (
    sectionName === "administracion" &&
    window.bandabaseIsAdmin?.()
  ) {

    void loadAdminPanel();

  }


  if (sectionName === "comentarios") {

    void loadGeneralComments();

  }


  if (
    sectionName === "canciones" &&
    !currentSong
  ) {

    document.getElementById(
      "songsBrowser"
    ).classList.remove(
      "hidden"
    );

    document.getElementById(
      "songDetail"
    ).classList.add(
      "hidden"
    );

  }

}


/* ============================================================
   INICIO - VISTAS PREVIAS
============================================================ */

function renderRecentListsPreview() {
  const container =
    document.getElementById(
      "recentListsPreview"
    );

  if (!container) {
    return;
  }

  const lists =
    (currentBandLists || [])
      .slice()
      .sort(
        (a, b) =>
          (Date.parse(b.created_at || "") || 0) -
          (Date.parse(a.created_at || "") || 0)
      )
      .slice(0, 5);

  if (!lists.length) {
    container.innerHTML =
      '<div class="home-recent-empty">Todavía no hay listas.</div>';
    return;
  }

  container.innerHTML =
    lists
      .map(list => {
        const items =
          getBandListItems(list.id);

        const songCount =
          items.filter(
            item =>
              item.item_type === "song" &&
              item.song_id
          ).length;

        const confirmed =
          items
            .filter(
              item =>
                item.item_type === "member" &&
                item.status === "Confirmado"
            )
            .map(
              item =>
                bandListMemberName(
                  item.member_user_id
                )
            );

        return (
          '<div class="list-detail-item">' +
            "<strong>" +
              escapeHtml(
                list.title || "Lista"
              ) +
            "</strong>" +
            '<div class="comment-meta">' +
              escapeHtml(
                list.status || "Planificada"
              ) +
              " · " +
              songCount +
              " canción" +
              (songCount === 1 ? "" : "es") +
            "</div>" +
            (
              confirmed.length
                ? '<div class="home-recent-detail">' +
                    "<strong>Participando:</strong> " +
                    escapeHtml(
                      confirmed.join(", ")
                    ) +
                  "</div>"
                : '<div class="home-recent-detail muted">Sin integrantes participando todavía.</div>'
            ) +
            (
              list.notes
                ? '<div class="comment-text">' +
                    escapeHtml(list.notes) +
                  "</div>"
                : ""
            ) +
          "</div>"
        );
      })
      .join("");
}


function getRecentProposalText(proposalId, fallbackDetail = "") {
  if (typeof getProposalBlocks === "function") {
    const blocks =
      getProposalBlocks(
        proposalId
      );

    const text =
      blocks
        .filter(
          block =>
            block.block_type === "text"
        )
        .map(
          block =>
            block.content || ""
        )
        .join("\n\n")
        .trim();

    if (text) {
      return text;
    }
  }

  return fallbackDetail || "";
}


function renderRecentProposalResults(
  proposal,
  options,
  voteStats
) {
  const statsByOption = {};

  (voteStats || []).forEach(stat => {
    statsByOption[stat.option_id] =
      Number(stat.vote_count || 0);
  });

  const totalVoters = Math.max(
    ...(voteStats || []).map(
      stat => Number(stat.voter_count || 0)
    ),
    0
  );

  if (!options.length) {
    return '<div class="home-recent-detail muted">Sin opciones de votación.</div>';
  }

  return (
    '<div class="home-proposal-results">' +
      '<div class="comment-meta">' +
        totalVoters +
        " integrante" +
        (totalVoters === 1 ? "" : "s") +
        " votaron" +
      "</div>" +
      options
        .map(option => {
          const count =
            statsByOption[option.id] || 0;

          const percent =
            totalVoters
              ? Math.round(
                  (count * 100) /
                    totalVoters
                )
              : 0;

          return (
            '<div class="home-proposal-result">' +
              '<div class="home-proposal-result-label">' +
                "<span>" +
                  escapeHtml(
                    option.label || "Opción"
                  ) +
                "</span>" +
                "<span>" +
                  count +
                  " (" +
                  percent +
                  "%)" +
                "</span>" +
              "</div>" +
              '<div class="home-proposal-result-bar">' +
                '<span style="width:' +
                percent +
                '%"></span>' +
              "</div>" +
            "</div>"
          );
        })
        .join("") +
    "</div>"
  );
}


async function loadRecentProposalsPreview() {
  const container =
    document.getElementById(
      "recentProposalsPreview"
    );

  if (!container || !currentBand) {
    return;
  }

  try {
    const {
      data,
      error
    } =
      await getProposalsByBandId(
        supabaseClient,
        currentBand.id
      );

    if (error) {
      throw error;
    }

    const proposals =
      (data || []).slice(0, 5);

    if (!proposals.length) {
      container.innerHTML =
        '<div class="home-recent-empty">Todavía no hay propuestas.</div>';
      return;
    }

    const ids =
      proposals.map(
        proposal =>
          proposal.id
      );

    const [
      optionsResult,
      voteStatsResult
    ] = await Promise.all([
      getProposalOptionsByProposalIds(
        supabaseClient,
        ids
      ),
      getProposalVoteStatsByProposalIds(
        supabaseClient,
        ids
      )
    ]);

    if (
      optionsResult.error ||
      voteStatsResult.error
    ) {
      throw (
        optionsResult.error ||
        voteStatsResult.error
      );
    }

    const optionsByProposal = {};
    const voteStatsByProposal = {};

    (optionsResult.data || [])
      .forEach(option => {
        (
          optionsByProposal[
            option.proposal_id
          ] ||= []
        ).push(option);
      });

    (voteStatsResult.data || [])
      .forEach(stat => {
        (
          voteStatsByProposal[
            stat.proposal_id
          ] ||= []
        ).push(stat);
      });

    container.innerHTML =
      proposals
        .map(proposal => {
          const text =
            getRecentProposalText(
              proposal.id,
              proposal.detail || ""
            );

          return (
            '<div class="list-detail-item">' +
              "<strong>" +
                escapeHtml(
                  proposal.title || "Propuesta"
                ) +
              "</strong>" +
              '<div class="comment-meta">' +
                escapeHtml(
                  proposal.status || "Abierta"
                ) +
                " · " +
                escapeHtml(
                  proposalTypeLabel(
                    proposal.voting_type
                  )
                ) +
              "</div>" +
              (
                text
                  ? '<div class="comment-text">' +
                      escapeHtml(text).slice(0, 220) +
                      (
                        text.length > 220
                          ? "…"
                          : ""
                      ) +
                    "</div>"
                  : ""
              ) +
              renderRecentProposalResults(
                proposal,
                optionsByProposal[proposal.id] || [],
                voteStatsByProposal[proposal.id] || []
              ) +
            "</div>"
          );
        })
        .join("");
  } catch (error) {
    container.innerHTML =
      '<div class="home-recent-empty">No se pudieron cargar las propuestas.</div>';
  }
}


async function loadHomeRecentData() {
  const listRefresh =
    await refreshBandListData();

  if (!listRefresh?.error) {
    renderRecentListsPreview();
  } else {
    const container =
      document.getElementById(
        "recentListsPreview"
      );

    if (container) {
      container.innerHTML =
        '<div class="home-recent-empty">No se pudieron cargar las listas.</div>';
    }
  }

  await Promise.all([
    loadRecentProposalsPreview(),
    loadRecentGeneralComments()
  ]);
}

/* ============================================================
   INICIO
============================================================ */

(async function() {

  try {

    const {
      data: {
        session
      }
    } =
      await supabaseClient.auth.getSession();

    await handleAuthSession(session);

  } catch (error) {

    console.error(error);

    showNotice(
      error.message ||
      "No se pudo cargar BandaBase.",
      "error"
    );

  }

})();
