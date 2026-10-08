/* Creación y edición de Listas. */

function selectedListManagers() {
  return Array.from(
    document.querySelectorAll(
      "#bandListManagersPicker input[data-list-manager]:checked"
    )
  ).map(
    input =>
      input.dataset.listManager
  );
}

function populateBandListManagersPicker(
  selected
) {
  const picker =
    document.getElementById(
      "bandListManagersPicker"
    );

  if (!picker) {
    return;
  }

  const members =
    (allBandMembers || [])
      .filter(
        member =>
          member.user_id !==
          currentUser?.id
      );

  picker.innerHTML =
    members.length
      ? members
          .slice()
          .sort(
            (a, b) =>
              String(
                a.display_name ||
                a.profile?.full_name ||
                ""
              ).localeCompare(
                String(
                  b.display_name ||
                  b.profile?.full_name ||
                  ""
                ),
                "es"
              )
          )
          .map(
            member => {
              const userId =
                member.user_id;

              const name =
                member.display_name ||
                member.profile?.full_name ||
                "Sin nombre";

              const instrument =
                member.profile?.instrument
                  ? ' <span class="member-info">· ' +
                    escapeHtml(
                      member.profile.instrument
                    ) +
                    "</span>"
                  : "";

              return (
                '<label class="list-check-option">' +
                '<input type="checkbox" data-list-manager="' +
                escapeHtml(userId) +
                '"' +
                (
                  selected.has(
                    userId
                  )
                    ? " checked"
                    : ""
                ) +
                ">" +
                "<span>" +
                escapeHtml(name) +
                instrument +
                "</span>" +
                "</label>"
              );
            }
          )
          .join("")
      : '<div class="empty-state">No hay otros integrantes activos para designar.</div>';
}

function showBandListForm(list) {
  editingBandListId =
    list?.id || null;

  if (
    list &&
    !isBandListCreator(list)
  ) {
    showNotice(
      "No tenés permiso para editar esta lista.",
      "error"
    );
    return;
  }

  const form =
    document.getElementById(
      "bandListForm"
    );

  form.reset();

  document.getElementById(
    "bandListTitle"
  ).value =
    list?.title || "";

  document.getElementById(
    "bandListStatus"
  ).value =
    list?.status ||
    "Planificada";

  document.getElementById(
    "bandListNotes"
  ).value =
    list?.notes || "";

  const selectedManagers =
    new Set(
      getBandListManagers(
        list?.id
      ).map(
        manager =>
          manager.user_id
      )
    );

  populateBandListManagersPicker(
    selectedManagers
  );

  populateBandListInstrumentSlotsPicker(
    list
      ? getListInstrumentSlots(list)
      : getDefaultBandListSlots()
  );

  document.getElementById(
    "showListFormBtn"
  ).textContent =
    list
      ? "Editando lista"
      : "+ Nueva lista";

  form.classList.remove(
    "hidden"
  );

  document.getElementById(
    "listsBrowser"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "listDetail"
  ).classList.add(
    "hidden"
  );

  document.getElementById(
    "bandListTitle"
  ).focus();
}

function hideBandListForm() {
  editingBandListId = null;

  const form = document.getElementById("bandListForm");
  form.classList.add("hidden");
  form.reset();

  document.getElementById("bandListStatus").value = "Planificada";
  document.getElementById("showListFormBtn").textContent =
    "+ Nueva lista";

  document.getElementById("listsBrowser").classList.remove("hidden");
}
