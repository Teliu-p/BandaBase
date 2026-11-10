/* Selección múltiple y borrado contextual para canciones, listas, propuestas y comentarios. */

(function setupContextDelete() {
  const menu = document.getElementById("contextDeleteMenu");
  const action = document.getElementById("contextDeleteAction");
  const cancel = document.getElementById("contextDeleteCancel");
  const summary = document.getElementById("contextDeleteSummary");

  if (!menu || !action || !cancel) return;

  const selection = new Map();
  let menuType = null;
  let longPressTimer = null;
  let longPressTriggered = false;
  let longPressTarget = null;

  function getContextTarget(target) {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-context-delete]");
  }

  function clearSelection() {
    selection.forEach(item => {
      item.element?.classList.remove(
        "context-delete-selected"
      );
    });
    selection.clear();
    menuType = null;
    closeMenu();
    updateSelectionUi();
  }

  function closeMenu() {
    menu.classList.add("hidden");

    menuType =
      selection.size
        ? [...selection.values()][0].type
        : null;
  }

  function updateSelectionUi() {
    const count = selection.size;

    if (count) {
      action.textContent =
        "Eliminar seleccionados (" + count + ")";
    } else {
      action.textContent = "Eliminar";
    }

    cancel.textContent = count
      ? "Cancelar selección"
      : "Cerrar";

    if (summary) {
      summary.textContent =
        count +
        (
          count === 1
            ? " seleccionado"
            : " seleccionados"
        );
    }
  }

  function selectTarget(target) {
    const type = target.dataset.contextDelete;
    const id = target.dataset.contextDeleteId;

    if (!type || !id) return false;

    if (
      selection.size &&
      [...selection.values()][0].type !== type
    ) {
      clearSelection();
    }

    if (!selection.has(id)) {
      selection.set(id, { type, id, element: target });
      target.classList.add("context-delete-selected");
    }

    menuType = type;
    updateSelectionUi();
    return true;
  }

  function unselectTarget(target) {
    const id = target.dataset.contextDeleteId;
    const item = selection.get(id);

    if (!item) return false;

    item.element?.classList.remove(
      "context-delete-selected"
    );
    selection.delete(id);

    if (!selection.size) {
      closeMenu();
    }

    updateSelectionUi();
    return true;
  }

  function openMenuAt(x, y, target) {
    if (!selectTarget(target)) return;

    menu.classList.remove("hidden");
    updateSelectionUi();

    const margin = 8;
    const rect = menu.getBoundingClientRect();

    menu.style.left =
      Math.max(
        margin,
        Math.min(
          x,
          window.innerWidth - rect.width - margin
        )
      ) + "px";

    menu.style.top =
      Math.max(
        margin,
        Math.min(
          y,
          window.innerHeight - rect.height - margin
        )
      ) + "px";
  }

  action.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();

    if (!selection.size) {
      closeMenu();
      return;
    }

    const ids = [...selection.keys()];
    const type = menuType;

    const result =
      await window.bandabaseDeleteSelected?.(
        type,
        ids
      );

    if (result?.cancelled) {
      return;
    }

    clearSelection();
  });

  cancel.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    clearSelection();
  });

  document.addEventListener("contextmenu", event => {
    const target = getContextTarget(event.target);

    if (!target) return;

    event.preventDefault();
    openMenuAt(
      event.clientX,
      event.clientY,
      target
    );
  });

  document.addEventListener(
    "click",
    event => {
      const target = getContextTarget(event.target);

      if (
        selection.size &&
        target &&
        target.dataset.contextDelete === menuType
      ) {
        if (
          event.target.closest(
            "button, input, select, textarea, a"
          )
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        if (selection.has(target.dataset.contextDeleteId)) {
          unselectTarget(target);
        } else {
          selectTarget(target);
        }
        return;
      }

      if (
        !menu.classList.contains("hidden") &&
        !menu.contains(event.target)
      ) {
        closeMenu();
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    event => {
      if (event.pointerType !== "touch") return;

      const target = getContextTarget(event.target);
      if (!target) return;

      window.clearTimeout(longPressTimer);
      longPressTarget = target;
      longPressTriggered = false;

      longPressTimer = window.setTimeout(() => {
        longPressTriggered = true;
        const rect =
          longPressTarget.getBoundingClientRect();

        openMenuAt(
          rect.left + rect.width / 2,
          rect.bottom + 8,
          longPressTarget
        );
      }, 550);
    },
    { passive: true }
  );

  function cancelLongPress() {
    window.clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressTarget = null;
  }

  ["pointerup", "pointercancel"].forEach(eventName => {
    document.addEventListener(
      eventName,
      event => {
        if (event.pointerType === "touch") {
          cancelLongPress();
        }
      },
      { passive: true }
    );
  });

  document.addEventListener(
    "pointermove",
    event => {
      if (event.pointerType === "touch") {
        cancelLongPress();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "click",
    event => {
      if (!longPressTriggered) return;

      longPressTriggered = false;

      if (
        getContextTarget(event.target)
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        clearSelection();
      }
    }
  );

  window.addEventListener("resize", clearSelection);
  window.addEventListener(
    "scroll",
    closeMenu,
    { passive: true }
  );

  window.bandabaseClearDeleteSelection =
    clearSelection;
})();