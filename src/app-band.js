/* ============================================================
   BANDA ACTUAL
============================================================ */

async function loadCurrentBand() {

  const {
    data: membership,
    error: membershipError
  } =
    await supabaseClient
      .from("band_members")
      .select(
        "band_id, role, active, display_name, tags"
      )
      .eq(
        "user_id",
        currentUser.id
      )
      .eq(
        "active",
        true
      )
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {

    throw new Error(
      "Tu usuario no tiene acceso activo a BandaBase."
    );

  }

  const {
    data: band,
    error: bandError
  } =
    await supabaseClient
      .from("bands")
      .select("*")
      .eq(
        "id",
        membership.band_id
      )
      .single();

  if (bandError) {
    throw bandError;
  }

  currentBandRole =
    membership.role ||
    "member";

  currentBand = {
    ...band,
    membership
  };

  currentUserName.textContent =
    membership.display_name ||
    currentUser.email ||
    "Usuario";

}


/* ============================================================
   PERFIL
============================================================ */

async function loadCurrentProfile() {

  const {
    data: profile,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq(
        "user_id",
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  currentProfile =
    profile || {};

  document.getElementById(
    "profileName"
  ).value =
    currentProfile.full_name || "";

  renderProfileInstrumentPicker(
    currentProfile.instruments
  );

  document.getElementById(
    "profileRole"
  ).value =
    currentProfile.role || "";

  updateProfileSummary();
  setProfileEditing(false);

  await loadMembers();

}


async function loadMembers() {

  const membersList =
    document.getElementById(
      "membersList"
    );

  membersList.innerHTML =
    "Cargando...";

  const {
    data: members,
    error: memberError
  } =
    await supabaseClient
      .from("band_members")
      .select(
        "user_id, role, active, display_name, tags"
      )
      .eq(
        "band_id",
        currentBand.id
      )
      .eq(
        "active",
        true
      );

  if (memberError) {
    throw memberError;
  }

  if (!members?.length) {

    membersList.innerHTML =
      `<div class="member">
        No hay integrantes.
      </div>`;

    return;
  }

  const userIds =
    members.map(
      member =>
        member.user_id
    );

  const {
    data: profiles
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "user_id, full_name, instrument, instruments, role"
      )
      .in(
        "user_id",
        userIds
      );

  bandMemberProfilesMap =
    Object.fromEntries(
      (profiles || []).map(
        profile => [
          profile.user_id,
          profile
        ]
      )
    );

  allBandMembers =
    (members || []).map(
      member => ({
        ...member,
        profile:
          bandMemberProfilesMap[
            member.user_id
          ] || {}
      })
    );

  membersList.innerHTML =
    members
      .map(member => {

        const profile =
          bandMemberProfilesMap[
            member.user_id
          ] || {};

        const name =
          member.display_name ||
          profile.full_name ||
          "Sin nombre";

        const instrument =
          formatBandInstruments(profile.instruments) ||
          profile.instrument ||
          "Sin instrumento";

        const role =
          profile.role ||
          member.role ||
          "";

        return `
          <div class="member">

            <div>

              <div class="member-name">
                ${escapeHtml(name)}
              </div>

              <div class="member-info">
                ${escapeHtml(instrument)}
                ${role
                  ? " · " + escapeHtml(role)
                  : ""}
              </div>

            </div>

          </div>
        `;

      })
      .join("");

}


function renderProfileInstrumentPicker(selected) {
  const picker = document.getElementById("profileInstrumentPicker");
  if (!picker) return;

  const values = normalizeBandInstruments(selected);
  picker.innerHTML = BAND_INSTRUMENT_OPTIONS.map(option =>
    '<label class="profile-instrument-option">' +
      '<input type="checkbox" data-profile-instrument="' + escapeHtml(option.value) + '"' +
      (values.includes(option.value) ? ' checked' : '') + '>' +
      '<span>' + option.icon + ' ' + escapeHtml(option.label) + '</span>' +
    '</label>'
  ).join("");
}

function updateProfileSummary() {

  const name =
    currentProfile.full_name ||
    "Sin nombre";

  const instrument =
    formatBandInstruments(
      currentProfile.instruments
    ) ||
    currentProfile.instrument ||
    "";

  const role =
    currentProfile.role ||
    "";

  document.getElementById(
    "resumenPerfilNombre"
  ).textContent =
    name;

  document.getElementById(
    "resumenPerfilInfo"
  ).textContent =
    [instrument, role]
      .filter(Boolean)
      .join(" · ") ||
    "Sin instrumento ni rol";

}


function setProfileEditing(isEditing) {

  const profileForm =
    document.getElementById(
      "profileForm"
    );

  const profileSummary =
    document.getElementById(
      "profileSummary"
    );

  const profileEditBtn =
    document.getElementById(
      "profileEditBtn"
    );

  if (isEditing) {

    profileSummary.classList.add(
      "hidden"
    );

    profileForm.classList.remove(
      "hidden"
    );

    profileEditBtn.textContent =
      "Cancelar";

  } else {

    profileForm.classList.add(
      "hidden"
    );

    profileSummary.classList.remove(
      "hidden"
    );

    profileEditBtn.textContent =
      "Editar perfil";

  }

}


document.getElementById(
  "profileEditBtn"
).addEventListener(
  "click",
  function() {

    const editing =
      !document
        .getElementById("profileForm")
        .classList.contains("hidden");

    if (editing) {

      document.getElementById(
        "profileName"
      ).value =
        currentProfile.full_name || "";

      renderProfileInstrumentPicker(
        currentProfile.instruments
      );

      document.getElementById(
        "profileRole"
      ).value =
        currentProfile.role || "";

      setProfileEditing(false);
      return;

    }

    document.getElementById(
      "profileName"
    ).value =
      currentProfile.full_name || "";

    renderProfileInstrumentPicker(
      currentProfile.instruments
    );

    document.getElementById(
      "profileRole"
    ).value =
      currentProfile.role || "";

    setProfileEditing(true);

    document.getElementById(
      "profileName"
    ).focus();

  }
);


document.getElementById(
  "profileForm"
).addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    if (!currentUser || !currentBand) {
      return;
    }

    const fullName =
      document.getElementById(
        "profileName"
      ).value.trim();

    const instruments =
      normalizeBandInstruments(
        Array.from(
          document.querySelectorAll(
            "#profileInstrumentPicker input[data-profile-instrument]:checked"
          )
        ).map(
          input => input.dataset.profileInstrument
        )
      );

    const instrument =
      instruments
        .map(value => getBandInstrumentOption(value)?.label)
        .filter(Boolean)
        .join(", ");

    const role =
      document.getElementById(
        "profileRole"
      ).value.trim();


    const {
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .upsert(
          {
            user_id:
              currentUser.id,
            full_name:
              fullName || null,
            instrument:
              instrument || null,
            instruments,
            role:
              role || null
          },
          {
            onConflict:
              "user_id"
          }
        );

    if (profileError) {

      showNotice(
        profileError.message,
        "error"
      );

      return;
    }


    const {
      error: memberError
    } =
      await supabaseClient
        .from("band_members")
        .update({
          display_name:
            fullName || null
        })
        .eq(
          "band_id",
          currentBand.id
        )
        .eq(
          "user_id",
          currentUser.id
        );

    if (memberError) {

      showNotice(
        memberError.message,
        "error"
      );

      return;
    }

    currentProfile = {
      ...currentProfile,
      full_name:
        fullName || null,
      instrument:
        instrument || null,
      instruments,
      role:
        role || null
    };

    currentUserName.textContent =
      fullName ||
      currentUser.email ||
      "Usuario";

    showNotice(
      "Perfil guardado.",
      "success"
    );

    setProfileEditing(false);
    updateProfileSummary();

    await loadMembers();

  }
);
