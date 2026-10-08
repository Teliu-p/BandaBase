/* ============================================================
   COLOR PICKER
============================================================ */

function renderColorPicker(
  container,
  selectedColor,
  onSelect
) {

  container.innerHTML = "";

  const noneButton =
    document.createElement("button");

  noneButton.type = "button";

  noneButton.className =
    "color-option";

  if (
    !selectedColor
  ) {
    noneButton.classList.add("selected");
  }

  noneButton.title =
    "Sin color";

  noneButton.setAttribute(
    "aria-label",
    "Sin color"
  );

  noneButton.innerHTML = `
    <span class="color-none"></span>
  `;

  /*
    IMPORTANTE:
    El click se conecta directamente acá.
    No dependemos de un formulario ni de un input oculto.
  */

  noneButton.addEventListener(
    "click",
    function(event) {

      event.preventDefault();
      event.stopPropagation();

      onSelect(null);

      renderColorPicker(
        container,
        null,
        onSelect
      );

    }
  );

  container.appendChild(
    noneButton
  );


  SONG_COLORS.forEach(color => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "color-option";

    if (
      selectedColor === color.value
    ) {
      button.classList.add("selected");
    }

    button.title =
      color.name;

    button.setAttribute(
      "aria-label",
      "Color " + color.name
    );

    button.innerHTML = `
      <span
        class="color-swatch"
        style="background:${color.value};"
      ></span>
    `;

    button.addEventListener(
      "click",
      function(event) {

        event.preventDefault();
        event.stopPropagation();

        onSelect(color.value);

        renderColorPicker(
          container,
          color.value,
          onSelect
        );

      }
    );

    container.appendChild(
      button
    );

  });

}


/* ============================================================
   SELECTOR DE COLOR DE FILTRO
============================================================ */

function populateColorFilter() {
  populateMultiSongFilter(
    "filterColor",
    "Todos los colores",
    SONG_COLORS.map(
      color =>
        color.value
    ),
    value => {
      const color =
        SONG_COLORS.find(
          item =>
            item.value === value
        );

      return color
        ? color.name
        : value;
    }
  );
}
