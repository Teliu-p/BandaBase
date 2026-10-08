/* Interfaz de creación y edición de Propuestas. */

function getProposalOptionLabelsFromForm() {
  return [...document.querySelectorAll(".proposal-option-input")]
    .map(input => input.value.trim())
    .filter(Boolean);
}

function renderProposalOptionInputs(labels = ["", ""]) {
  const container = document.getElementById(
    "proposalOptionsInputs"
  );

  if (!container) {
    return;
  }

  container.innerHTML = labels
    .map(
      (label, index) =>
        `
        <div class="proposal-option-input-row">
          <input
            type="text"
            class="proposal-option-input"
            value="${escapeHtml(label || "")}"
            placeholder="Opción ${index + 1}"
            maxlength="120"
          >
          <button
            type="button"
            class="btn btn-subtle btn-danger proposal-remove-option"
            aria-label="Quitar opción"
          >
            ×
          </button>
        </div>
        `
    )
    .join("");

  container
    .querySelectorAll(".proposal-remove-option")
    .forEach(button => {
      button.addEventListener("click", () => {
        button
          .closest(".proposal-option-input-row")
          ?.remove();
        normalizeProposalOptionInputs();
      });
    });
}

function normalizeProposalOptionInputs() {
  document
    .querySelectorAll(".proposal-option-input")
    .forEach((input, index) => {
      input.placeholder = `Opción ${index + 1}`;
    });
}

function updateProposalTypeUI() {
  const type =
    document.getElementById("proposalVotingType")?.value;

  const addButton =
    document.getElementById("addProposalOptionBtn");

  const help =
    document.getElementById("proposalOptionsHelp");

  if (type === "yes_no") {
    renderProposalOptionInputs(["Sí", "No"]);
    addButton?.classList.add("hidden");

    if (help) {
      help.textContent =
        "La propuesta se votará por Sí o No.";
    }

    return;
  }

  addButton?.classList.remove("hidden");

  if (help) {
    help.textContent =
      type === "multiple"
        ? "Cada integrante puede elegir varias opciones."
        : "Cada integrante puede elegir una sola opción.";
  }

  const inputs = document.querySelectorAll(
    ".proposal-option-input"
  );

  if (!inputs.length) {
    renderProposalOptionInputs(["", ""]);
  }
}

function resetProposalForm() {
  const form =
    document.getElementById("proposalForm");

  form?.reset();

  const type =
    document.getElementById("proposalVotingType");

  if (type) {
    type.value = "single";
  }

  document
    .getElementById("proposalForm")
    ?.classList.add("hidden");

  renderProposalOptionInputs(["", ""]);
  resetProposalComposer();
  openProposalComposer();
  updateProposalTypeUI();
}

function openProposalForm() {
  const form =
    document.getElementById("proposalForm");

  if (!form) {
    return;
  }

  form.classList.toggle("hidden");

  if (!form.classList.contains("hidden")) {
    document
      .getElementById("proposalTitle")
      ?.focus();
  }
}

document
  .getElementById("showProposalFormBtn")
  ?.addEventListener(
    "click",
    openProposalForm
  );

document
  .getElementById("cancelProposalBtn")
  ?.addEventListener(
    "click",
    resetProposalForm
  );

document
  .getElementById("proposalVotingType")
  ?.addEventListener(
    "change",
    updateProposalTypeUI
  );

document
  .getElementById("proposalVotingVisibility")
  ?.addEventListener(
    "change",
    event => {
      const help =
        document.getElementById(
          "proposalVisibilityHelp"
        );

      if (!help) {
        return;
      }

      help.textContent =
        event.target.value === "anonymous"
          ? "No se muestran los nombres de quienes votan."
          : "Se muestran los nombres de quienes votan en cada opción.";
    }
  );

document
  .getElementById("addProposalOptionBtn")
  ?.addEventListener(
    "click",
    () => {
      const container =
        document.getElementById(
          "proposalOptionsInputs"
        );

      if (!container) {
        return;
      }

      const row =
        document.createElement("div");

      row.className =
        "proposal-option-input-row";

      row.innerHTML = `
        <input
          type="text"
          class="proposal-option-input"
          placeholder="Nueva opción"
          maxlength="120"
        >
        <button
          type="button"
          class="btn btn-subtle btn-danger proposal-remove-option"
          aria-label="Quitar opción"
        >
          ×
        </button>
      `;

      container.appendChild(row);

      row
        .querySelector("button")
        ?.addEventListener(
          "click",
          () => {
            row.remove();
            normalizeProposalOptionInputs();
          }
        );

      normalizeProposalOptionInputs();
    }
  );

document
  .getElementById(
    "insertProposalFileBtn"
  )
  ?.addEventListener(
    "mousedown",
    function() {
      rememberProposalSelection();
    }
  );

document
  .getElementById(
    "insertProposalFileBtn"
  )
  ?.addEventListener(
    "click",
    function() {
      const input =
        document.getElementById(
          "proposalPendingFile"
        );

      if (!input) {
        return;
      }

      input.value = "";
      input.click();
    }
  );

document
  .getElementById(
    "proposalPendingFile"
  )
  ?.addEventListener(
    "change",
    function() {
      const file =
        this.files &&
        this.files[0];

      if (!file) {
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      proposalPendingAttachments[
        pendingKey
      ] = {
        kind:
          "file",
        name:
          file.name,
        file
      };

      const node =
        createProposalInlineAttachment(
          proposalPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertProposalNodeAtSelection(
        node
      );

      this.value = "";
    }
  );

document
  .getElementById(
    "insertProposalLinkBtn"
  )
  ?.addEventListener(
    "mousedown",
    function() {
      rememberProposalSelection();
    }
  );

document
  .getElementById(
    "insertProposalLinkBtn"
  )
  ?.addEventListener(
    "click",
    function() {
      const name =
        window.prompt(
          "Nombre del enlace",
          "Enlace"
        );

      if (name === null) {
        return;
      }

      const url =
        window.prompt(
          "Pegá la URL",
          "https://"
        );

      if (url === null) {
        return;
      }

      const safeUrl =
        normalizeProposalLink(
          url
        );

      if (!safeUrl) {
        showNotice(
          "La URL debe comenzar con http:// o https://.",
          "error"
        );
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      proposalPendingAttachments[
        pendingKey
      ] = {
        kind:
          "link",
        name:
          name.trim() ||
          "Enlace",
        url:
          safeUrl
      };

      const node =
        createProposalInlineAttachment(
          proposalPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertProposalNodeAtSelection(
        node
      );
    }
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "keydown",
    function(event) {
      if (
        event.key ===
        "Enter"
      ) {
        event.preventDefault();
        rememberProposalSelection();

        insertProposalNodeAtSelection(
          document.createTextNode(
            "\n"
          )
        );

        return;
      }

      if (
        event.key ===
        "Tab"
      ) {
        event.preventDefault();
        rememberProposalSelection();

        insertProposalNodeAtSelection(
          document.createTextNode(
            "  "
          )
        );
      }
    }
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "keyup",
    rememberProposalSelection
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "mouseup",
    rememberProposalSelection
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "focus",
    rememberProposalSelection
  );

document
  .getElementById(
    "proposalComposerEditor"
  )
  ?.addEventListener(
    "paste",
    function(event) {
      event.preventDefault();

      const text =
        event.clipboardData?.getData(
          "text/plain"
        ) || "";

      rememberProposalSelection();

      insertProposalNodeAtSelection(
        document.createTextNode(
          text
        )
      );
    }
  );

document
  .getElementById("proposalForm")
  ?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (!currentBand || !currentUser) {
        showNotice(
          "No se encontró la banda o el usuario.",
          "error"
        );
        return;
      }

      const title =
        document
          .getElementById("proposalTitle")
          ?.value
          .trim() || "";

      const proposalBlocks =
        collectProposalComposerBlocks();

      const detail =
        collectProposalLegacyText(
          proposalBlocks
        );

      const votingVisibility =
        document
          .getElementById("proposalVotingVisibility")
          ?.value || "public";

      const votingType =
        document.getElementById(
          "proposalVotingType"
        )?.value || "single";

      let options =
        getProposalOptionLabelsFromForm();

      if (votingType === "yes_no") {
        options = ["Sí", "No"];
      }

      if (!title) {
        showNotice(
          "La propuesta necesita un título.",
          "error"
        );
        return;
      }

      if (options.length < 2) {
        showNotice(
          "Agregá al menos dos opciones.",
          "error"
        );
        return;
      }

      if (
        new Set(
          options.map(
            option =>
              option.toLocaleLowerCase()
          )
        ).size !== options.length
      ) {
        showNotice(
          "No puede haber opciones repetidas.",
          "error"
        );
        return;
      }

      const result =
        await createProposal(
          supabaseClient,
          {
            band_id:
              currentBand.id,
            title,
            detail:
              detail || null,
            status:
              "Abierta",
            voting_type:
              votingType,
            voting_visibility:
              votingVisibility,
            created_by:
              currentUser.id
          },
          options
        );

      if (result.error) {
        showNotice(
          result.error.message,
          "error"
        );
        return;
      }

      const attachmentErrors =
        await saveProposalComposerContent(
          result.data,
          proposalBlocks
        );

      if (attachmentErrors.length) {
        showNotice(
          "La propuesta se publicó, pero algunos adjuntos no se pudieron guardar.",
          "error"
        );
        console.error(
          attachmentErrors.join("\n")
        );
      } else {
        showNotice(
          "Propuesta publicada.",
          "success"
        );
      }

      resetProposalForm();
      await loadProposals();
    }
  );

renderProposalOptionInputs(["", ""]);
updateProposalTypeUI();
