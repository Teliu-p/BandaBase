function getMultiFilterValues(containerId) {
  const container = document.getElementById(containerId);

  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map(input => input.value);
}


function getMultiFilterSummary(selected, defaultText) {
  if (!selected.length) {
    return defaultText;
  }

  if (selected.length <= 2) {
    return selected.join(", ");
  }

  return selected.length + " seleccionados";
}


function bindMultiFilterContainer(container, render) {
  if (!container || container.dataset.bound === "true") {
    return;
  }

  const toggle = container.querySelector(".filter-multi-toggle");
  const menu = container.querySelector(".filter-multi-menu");

  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener("click", function(event) {
    event.stopPropagation();

    document.querySelectorAll(".filter-multi.open").forEach(other => {
      if (other !== container) {
        other.classList.remove("open");
      }
    });

    container.classList.toggle("open");
  });

  menu.addEventListener("click", function(event) {
    event.stopPropagation();
  });

  menu.addEventListener("change", function() {
    const selected = getMultiFilterValues(container.id);
    const label = container.querySelector(".filter-multi-label");

    if (label) {
      label.textContent =
        getMultiFilterSummary(
          selected,
          container.dataset.defaultText || ""
        );
    }

    render();
  });

  container.dataset.bound = "true";
}


function renderMultiFilter(
  container,
  defaultText,
  values,
  selectedValues,
  getLabel
) {
  if (!container) {
    return;
  }

  container.dataset.defaultText = defaultText;

  const menu = container.querySelector(".filter-multi-menu");
  const label = container.querySelector(".filter-multi-label");

  if (!menu || !label) {
    return;
  }

  const selectedSet = new Set(selectedValues || []);

  menu.innerHTML = "";

  values.forEach(value => {
    const item = document.createElement("label");
    item.className = "filter-multi-option";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.checked = selectedSet.has(value);

    const text = document.createElement("span");
    text.textContent = getLabel(value);

    item.appendChild(input);
    item.appendChild(text);
    menu.appendChild(item);
  });

  if (!values.length) {
    menu.innerHTML =
      '<div class="filter-multi-empty">Sin opciones</div>';
  }

  const selected =
    Array.from(
      menu.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
    ).map(input => input.value);

  label.textContent =
    getMultiFilterSummary(
      selected,
      defaultText
    );
}


function populateMultiSongFilter(
  containerId,
  defaultText,
  values,
  getLabel
) {
  const container =
    document.getElementById(containerId);

  if (!container) {
    return;
  }

  const selected =
    getMultiFilterValues(containerId);

  renderMultiFilter(
    container,
    defaultText,
    values,
    selected.filter(value => values.includes(value)),
    getLabel
  );

  bindMultiFilterContainer(
    container,
    renderSongs
  );
}


function populateSongFilters(
  songs,
  getSongSingers,
  uniqueSorted
) {
  const genres =
    uniqueSorted(
      songs.flatMap(
        song =>
          normalizeSongGenres(
            song.genre
          )
      )
    );

  const artists =
    uniqueSorted(
      songs.map(
        song =>
          song.artist
      )
    );

  const singers = [];

  songs.forEach(song => {
    getSongSingers(song).forEach(item => {
      if (
        item.singer &&
        item.singer.trim()
      ) {
        singers.push(item.singer);
      }
    });
  });

  populateMultiSongFilter(
    "filterGenre",
    "Todos los géneros",
    genres,
    value => value
  );

  populateMultiSongFilter(
    "filterArtist",
    "Todos los artistas",
    artists,
    value => value
  );

  populateMultiSongFilter(
    "filterSinger",
    "Todos los cantantes",
    uniqueSorted(singers),
    value => value
  );
}


function getSongFilterValues() {
  return {
    color:
      getMultiFilterValues("filterColor"),

    genre:
      getMultiFilterValues("filterGenre"),

    artist:
      getMultiFilterValues("filterArtist"),

    singer:
      getMultiFilterValues("filterSinger"),

    listStatus:
      document.getElementById(
        "filterListStatus"
      ).value,

    activeStatus:
      document.getElementById(
        "filterActiveStatus"
      ).value
  };
}


function hasNormalizedValue(
  values,
  value,
  normalizeText
) {
  return values.some(
    item =>
      normalizeText(item) ===
      normalizeText(value)
  );
}


function filterSongs(
  songs,
  filters,
  getSongSingers,
  normalizeText
) {
  const {
    color,
    genre,
    artist,
    singer,
    listStatus,
    activeStatus
  } =
    filters;

  return songs.filter(
    song => {

      if (
        color.length &&
        !color.includes(song.color)
      ) {
        return false;
      }

      if (
        genre.length &&
        !genre.some(
          selected =>
            hasNormalizedValue(
              normalizeSongGenres(song.genre),
              selected,
              normalizeText
            )
        )
      ) {
        return false;
      }

      if (
        artist.length &&
        !hasNormalizedValue(
          artist,
          song.artist || "",
          normalizeText
        )
      ) {
        return false;
      }

      if (
        listStatus &&
        song.status !== listStatus
      ) {
        return false;
      }

      if (
        activeStatus &&
        song.active_status !== activeStatus
      ) {
        return false;
      }

      if (singer.length) {
        const songSingers =
          getSongSingers(song)
            .map(
              item =>
                item.singer
            );

        if (
          !singer.some(
            selected =>
              hasNormalizedValue(
                songSingers,
                selected,
                normalizeText
              )
          )
        ) {
          return false;
        }
      }

      return true;
    }
  );
}
