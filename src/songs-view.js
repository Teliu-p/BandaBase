function renderSongCards(
  container,
  songs,
  getSongSingers,
  escapeHtml,
  formatDuration,
  onOpenSong,
  onToggleRepertoire,
  onManageSongLists
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


        let statuses = `
          <label
            class="song-repertoire-toggle"
            title="Agregar o quitar del repertorio"
          >
            <input
              type="checkbox"
              class="song-repertoire-checkbox"
              data-song-repertoire="${escapeHtml(song.id)}"
              ${song.in_repertoire ? "checked" : ""}
            >
            <span>Repertorio</span>
          </label>
        `;

        if (typeof onManageSongLists === "function") {
          statuses += `
            <button
              type="button"
              class="btn btn-subtle song-list-manage"
              data-song-lists="${escapeHtml(song.id)}"
            >
              Agregar a lista
            </button>
          `;
        }


        const readinessStatus =
          song.status === "Lista"
            ? '<span class="status active">Lista</span>'
            : '<span class="status pending">Pendiente</span>';

        statuses += readinessStatus;

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
                formatSongGenres(song.genre) ||
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
      ".song-list-manage"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        function(event) {
          event.stopPropagation();
          void onManageSongLists(button.dataset.songLists);
        }
      );
    });

  container
    .querySelectorAll(
      ".song-repertoire-checkbox"
    )
    .forEach(checkbox => {

      checkbox.addEventListener(
        "click",
        function(event) {
          event.stopPropagation();
        }
      );

      checkbox.addEventListener(
        "change",
        function(event) {
          event.stopPropagation();
          void onToggleRepertoire(
            checkbox.dataset.songRepertoire,
            checkbox.checked
          );
        }
      );

    });


  container
    .querySelectorAll(
      ".song-card"
    )
    .forEach(card => {

      card.addEventListener(
        "click",
        function(event) {

          if (event.target.closest(".song-repertoire-toggle")) {
            return;
          }

          const id =
            card.dataset.songId;

          onOpenSong(id);

        }
      );

    });


}
