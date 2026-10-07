function createSingerRow(
  container,
  singer = "",
  key = "",
  escapeHtml
) {

  const row =
    document.createElement(
      "div"
    );

  row.className =
    "singer-row";


  row.innerHTML = `

    <input
      type="text"
      class="singer-name"
      placeholder="Cantante"
      value="${escapeHtml(singer)}"
    >

    <input
      type="text"
      class="singer-key"
      placeholder="Tonalidad"
      value="${escapeHtml(key)}"
    >

    <button
      type="button"
      class="btn btn-subtle remove-singer"
    >
      ×
    </button>

  `;


  row
    .querySelector(
      ".remove-singer"
    )
    .addEventListener(
      "click",
      function() {

        row.remove();

      }
    );


  container.appendChild(
    row
  );

}


function resetNewSingerRows(
  container,
  escapeHtml
) {

  container.innerHTML = "";

  createSingerRow(
    container,
    "",
    "",
    escapeHtml
  );

}


function getSingerRows(
  container,
  normalizeText
) {

  const rows =
    Array.from(
      container.querySelectorAll(
        ".singer-row"
      )
    );


  const result = [];

  const seen =
    new Set();


  rows.forEach(row => {

    const singer =
      row
        .querySelector(
          ".singer-name"
        )
        .value
        .trim();

    const key =
      row
        .querySelector(
          ".singer-key"
        )
        .value
        .trim();


    if (!singer) {
      return;
    }


    const normalized =
      normalizeText(
        singer
      );

    if (
      seen.has(normalized)
    ) {
      return;
    }

    seen.add(
      normalized
    );


    result.push({
      singer,
      song_key:
        key || null
    });

  });


  return result;

}


function renderDetailSingers(
  container,
  singers,
  escapeHtml
) {

  container.innerHTML = "";


  if (!singers.length) {

    createSingerRow(
      container,
      "",
      "",
      escapeHtml
    );

    return;
  }


  singers.forEach(item => {

    createSingerRow(
      container,
      item.singer,
      item.song_key,
      escapeHtml
    );

  });

}


function readSongFormFields(
  document,
  fieldIds,
  color,
  parseDuration,
  normalizeText
) {

  const name =
    document.getElementById(
      fieldIds.name
    ).value.trim();

  const artist =
    document.getElementById(
      fieldIds.artist
    ).value.trim();

  const genre =
    document.getElementById(
      fieldIds.genre
    ).value.trim();

  const bpmValue =
    document.getElementById(
      fieldIds.bpm
    ).value;

  const bpm =
    bpmValue
      ? Number(bpmValue)
      : null;

  const duration =
    parseDuration(
      document.getElementById(
        fieldIds.duration
      ).value
    );

  const meter =
    document.getElementById(
      fieldIds.meter
    ).value ||
    null;

  const listStatus =
    document.getElementById(
      fieldIds.listStatus
    ).checked
      ? "Lista"
      : "Pendiente";

  const activeStatus =
    document.getElementById(
      fieldIds.activeStatus
    ).value;

  const singers =
    getSingerRows(
      document.getElementById(
        fieldIds.singers
      ),
      normalizeText
    );

  return {
    name,
    artist,
    genre,
    bpm,
    duration,
    meter,
    color,
    listStatus,
    activeStatus,
    singers
  };

}


function readCreateSongForm(
  document,
  selectedColor,
  parseDuration,
  normalizeText
) {

  return readSongFormFields(
    document,
    {
      name: "newSongName",
      artist: "newSongArtist",
      genre: "newSongGenre",
      bpm: "newSongBpm",
      duration: "newSongDuration",
      meter: "newSongMeter",
      listStatus: "newSongListStatus",
      activeStatus: "newSongActiveStatus",
      singers: "newSingersContainer"
    },
    selectedColor,
    parseDuration,
    normalizeText
  );

}


function readSongDetailForm(
  document,
  selectedColor,
  parseDuration,
  normalizeText
) {

  const song =
    readSongFormFields(
      document,
      {
        name: "detailName",
        artist: "detailArtist",
        genre: "detailGenre",
        bpm: "detailBpm",
        duration: "detailDuration",
        meter: "detailMeter",
        listStatus: "detailListStatus",
        activeStatus: "detailActiveStatus",
        singers: "detailSingersContainer"
      },
      selectedColor,
      parseDuration,
      normalizeText
    );

  const originalBpmValue =
    document.getElementById(
      "originalBpm"
    ).value;

  const originalBpm =
    originalBpmValue
      ? Number(originalBpmValue)
      : null;

  const originalKey =
    document.getElementById(
      "originalKey"
    ).value.trim();

  const originalDuration =
    parseDuration(
      document.getElementById(
        "originalDuration"
      ).value
    );

  const originalMeter =
    document.getElementById(
      "originalMeter"
    ).value.trim();

  return {
    ...song,
    originalBpm,
    originalKey,
    originalDuration,
    originalMeter
  };

}
