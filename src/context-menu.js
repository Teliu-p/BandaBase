/* Menú contextual general de eliminación: click derecho en desktop y pulsación larga en touch. */

(function setupDeleteContextMenu() {
  const menu =
    document.getElementById(
      "contextDeleteMenu"
    );

  const action =
    document.getElementById(
      "contextDeleteAction"
    );

  if (!menu || !action) {
    return;
  }

  let deleteControl = null;
  let longPressTimer = null;
  let longPressControl = null;
  let longPressTriggered = false;

  function isDeleteControl(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (
      element.classList.contains(
        "proposal-delete"
      )
    ) {
      return true;
    }

    return Array.from(
      element.attributes || []
    ).some(
      attribute =>
        attribute.name.startsWith(
          "data-delete-"
        )
    );
  }

  function findDeleteControl(target) {
    if (!(target instanceof Element)) {
      return null;
    }

    let node = target;

    for (
      let level = 0;
      node && level < 7;
      level += 1
    ) {
      if (isDeleteControl(node)) {
        return node;
      }

      const candidate =
        Array.from(
          node.querySelectorAll(
            "button, [role='button']"
          )
        ).find(
          isDeleteControl
        );

      if (candidate) {
        return candidate;
      }

      node = node.parentElement;
    }

    return null;
  }

  function closeMenu() {
    menu.classList.add("hidden");
    deleteControl = null;
  }

  function openMenu(
    x,
    y,
    control
  ) {
    if (
      !control ||
      !document.contains(control)
    ) {
      return;
    }

    deleteControl =
      control;

    menu.classList.remove(
      "hidden"
    );

    const margin = 8;
    const rect =
      menu.getBoundingClientRect();

    const left = Math.min(
      x,
      window.innerWidth -
        rect.width -
        margin
    );

    const top = Math.min(
      y,
      window.innerHeight -
        rect.height -
        margin
    );

    menu.style.left =
      Math.max(
        margin,
        left
      ) + "px";

    menu.style.top =
      Math.max(
        margin,
        top
      ) + "px";
  }

  action.addEventListener(
    "click",
    function(event) {
      event.preventDefault();

      const control =
        deleteControl;

      closeMenu();

      if (
        control &&
        document.contains(control)
      ) {
        control.click();
      }
    }
  );

  document.addEventListener(
    "contextmenu",
    function(event) {
      const control =
        findDeleteControl(
          event.target
        );

      if (!control) {
        return;
      }

      event.preventDefault();

      openMenu(
        event.clientX,
        event.clientY,
        control
      );
    }
  );

  document.addEventListener(
    "pointerdown",
    function(event) {
      if (
        event.pointerType !==
        "touch"
      ) {
        return;
      }

      const control =
        findDeleteControl(
          event.target
        );

      if (!control) {
        return;
      }

      longPressTriggered =
        false;

      longPressControl =
        control;

      window.clearTimeout(
        longPressTimer
      );

      longPressTimer =
        window.setTimeout(
          function() {
            longPressTriggered =
              true;

            const rect =
              longPressControl.getBoundingClientRect();

            openMenu(
              rect.left +
                rect.width / 2,
              rect.bottom + 8,
              longPressControl
            );
          },
          550
        );
    },
    {
      passive: true
    }
  );

  function cancelLongPress() {
    window.clearTimeout(
      longPressTimer
    );

    longPressTimer =
      null;
    longPressControl =
      null;
  }

  document.addEventListener(
    "pointermove",
    function(event) {
      if (
        event.pointerType ===
        "touch"
      ) {
        cancelLongPress();
      }
    },
    {
      passive: true
    }
  );

  document.addEventListener(
    "pointerup",
    function(event) {
      if (
        event.pointerType ===
        "touch"
      ) {
        cancelLongPress();
      }
    },
    {
      passive: true
    }
  );

  document.addEventListener(
    "pointercancel",
    function(event) {
      if (
        event.pointerType ===
        "touch"
      ) {
        cancelLongPress();
      }
    },
    {
      passive: true
    }
  );

  document.addEventListener(
    "click",
    function(event) {
      if (
        longPressTriggered
      ) {
        event.preventDefault();
        event.stopPropagation();

        longPressTriggered =
          false;

        return;
      }

      if (
        !menu.classList.contains(
          "hidden"
        ) &&
        !menu.contains(
          event.target
        )
      ) {
        closeMenu();
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    function(event) {
      if (
        event.key === "Escape"
      ) {
        closeMenu();
      }
    }
  );

  window.addEventListener(
    "resize",
    closeMenu
  );

  window.addEventListener(
    "scroll",
    closeMenu,
    {
      passive: true
    }
  );
})();
