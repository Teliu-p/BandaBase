/* ============================================================
   COLOR PICKER
============================================================ */

function renderColorPicker(
  container,
  selectedColor,
  onSelect
) {
  container.innerHTML = "";
  container.classList.remove("is-open");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "color-option color-picker-toggle";
  toggle.title = selectedColor
    ? (SONG_COLORS.find(color => color.value === selectedColor)?.name || "Color seleccionado")
    : "Elegir color";
  toggle.setAttribute(
    "aria-label",
    selectedColor
      ? "Color seleccionado. Abrir gama de colores"
      : "Sin color. Abrir gama de colores"
  );
  toggle.setAttribute("aria-expanded", "false");

  toggle.innerHTML = selectedColor
    ? `<span class="color-swatch" style="background:${selectedColor};"></span>`
    : '<span class="color-none"></span>';

  const palette = document.createElement("div");
  palette.className = "color-palette";
  palette.id = (container.id || "songColorPicker") + "-palette";

  toggle.setAttribute("aria-controls", palette.id);
  toggle.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();

    const isOpen = container.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  function addColorOption(color, isNone = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-option";

    if (
      (isNone && !selectedColor) ||
      (!isNone && selectedColor === color.value)
    ) {
      button.classList.add("selected");
    }

    button.title = isNone ? "Sin color" : color.name;
    button.setAttribute(
      "aria-label",
      isNone ? "Sin color" : "Color " + color.name
    );
    button.innerHTML = isNone
      ? '<span class="color-none"></span>'
      : `<span class="color-swatch" style="background:${color.value};"></span>`;

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const nextColor = isNone ? null : color.value;
      onSelect(nextColor);
      renderColorPicker(container, nextColor, onSelect);
    });

    palette.appendChild(button);
  }

  addColorOption(null, true);
  SONG_COLORS.forEach(color => addColorOption(color));

  container.appendChild(toggle);
  container.appendChild(palette);
}
