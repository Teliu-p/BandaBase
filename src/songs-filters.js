function populateFilterSelect(
  select,
  defaultText,
  values
) {

  const current =
    select.value;

  select.innerHTML = "";

  const defaultOption =
    document.createElement(
      "option"
    );

  defaultOption.value = "";
  defaultOption.textContent =
    defaultText;

  select.appendChild(
    defaultOption
  );


  values.forEach(value => {

    const option =
      document.createElement(
        "option"
      );

    option.value =
      value;

    option.textContent =
      value;

    select.appendChild(
      option
    );

  });


  if (
    values.includes(current)
  ) {
    select.value =
      current;
  }

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
        song => song.artist
      )
    );

  const singers = [];

  songs.forEach(song => {

    getSongSingers(song)
      .forEach(item => {

        if (
          item.singer &&
          item.singer.trim()
        ) {
          singers.push(
            item.singer
          );
        }

      });

  });


  populateFilterSelect(
    document.getElementById(
      "filterGenre"
    ),
    "Todos los géneros",
    genres
  );

  populateFilterSelect(
    document.getElementById(
      "filterArtist"
    ),
    "Todos los artistas",
    artists
  );

  populateFilterSelect(
    document.getElementById(
      "filterSinger"
    ),
    "Todos los cantantes",
    uniqueSorted(singers)
  );

}


function getSongFilterValues() {

  const color =
    document.getElementById(
      "filterColor"
    ).value;

  const genre =
    document.getElementById(
      "filterGenre"
    ).value;

  const artist =
    document.getElementById(
      "filterArtist"
    ).value;

  const singer =
    document.getElementById(
      "filterSinger"
    ).value;

  const listStatus =
    document.getElementById(
      "filterListStatus"
    ).value;

  const activeStatus =
    document.getElementById(
      "filterActiveStatus"
    ).value;

  return {
    color,
    genre,
    artist,
    singer,
    listStatus,
    activeStatus
  };

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
        color &&
        song.color !== color
      ) {
        return false;
      }

      if (
        genre &&
        !normalizeSongGenres(
          song.genre
        ).some(
          item =>
            normalizeText(item) ===
            normalizeText(genre)
        )
      ) {
        return false;
      }

      if (
        artist &&
        song.artist !== artist
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

      if (singer) {

        const hasSinger =
          getSongSingers(song)
            .some(
              item =>
                normalizeText(
                  item.singer
                ) ===
                normalizeText(
                  singer
                )
            );

        if (!hasSinger) {
          return false;
        }

      }

      return true;

    }
  );

}
