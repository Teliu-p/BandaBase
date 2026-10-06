function renderSongCards(
  container,
  songs,
  getSongSingers,
  escapeHtml,
  formatDuration,
  onOpenSong
) {

  if (!songs.length) {

    container.innerHTML = `
      <div class="empty-state">
        No hay canciones que coincidan con los filtros.
      </div>
    `;

    return;
  }


  container.innerHTML =
    songs
      .map(song => {

        const singers =
          getSongSingers(song);

        const singersText =
          singers.length
            ? singers
                .map(item => {

                  const singer =
                    escapeHtml(
                      item.singer
                    );

                  const key =
                    item.song_key
                      ? ` (${escapeHtml(item.song_key)})`
                      : "";

                  return (
                    singer +
                    key
                  );

                })
                .join(", ")
            : "Sin cantante asignado";


        const meta = [
          formatDuration(
            song.duration
          ),
          song.meter || "—",
          song.bpm
            ? `${song.bpm} BPM`
            : "—"
        ].join(" · ");


        const borderStyle =
          song.color
            ? `border-left-color:${escapeHtml(song.color)};`
            : "";


        let statuses = "";

        if (
          song.list_status ===
          "Lista"
        ) {

          statuses += `
            <span class="status">
              Lista
            </span>
          `;

        } else {

          statuses += `
            <span class="status pending">
              Pendiente
            </span>
          `;

        }


        if (
          song.active_status ===
          "Activa"
        ) {

          statuses += `
            <span class="status active">
              Activa
            </span>
          `;

        } else {

          statuses += `
            <span class="status inactive">
              Inactiva
            </span>
          `;

        }


        return `
          <article
            class="song-card"
            style="${borderStyle}"
            data-song-id="${escapeHtml(song.id)}"
          >

            <div class="song-title">
              ${escapeHtml(song.name)}
            </div>

            <div class="song-artist">
              ${escapeHtml(
                song.artist ||
                "Artista no especificado"
              )}
            </div>

            <div class="song-meta">
              ${meta}
            </div>

            <div class="song-genre">
              ${escapeHtml(
                song.genre ||
                "Género no especificado"
              )}
            </div>

            <div class="song-singers">
              ${singersText}
            </div>

            <div class="song-statuses">
              ${statuses}
            </div>

          </article>
        `;

      })
      .join("");


  container
    .querySelectorAll(
      ".song-card"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        function() {

          const id =
            card.dataset.songId;

          onOpenSong(id);

        }
      );

    });


}
