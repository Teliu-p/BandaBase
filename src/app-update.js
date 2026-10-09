(function () {
  "use strict";

  const buildMeta = document.querySelector('meta[name="bandabase-build"]');
  const currentBuild = String(buildMeta?.content || "").trim();
  const reloadParameter = "_bb_reload";
  const checkIntervalMs = 60 * 1000;
  const safetyCheckIntervalMs = 15 * 1000;
  const idleBeforeRefreshMs = 2 * 60 * 1000;
  const maxWaitBeforeRefreshMs = 10 * 60 * 1000;

  const editorSelectors = [
    "#profileForm",
    "#createSongForm",
    "#songDetailForm",
    "#originalComparisonForm",
    "#materialForm",
    "#commentForm",
    "#bandListForm",
    "#generalCommentForm",
    "#proposalForm"
  ];

  let updateAvailable = false;
  let newestBuild = "";
  let firstDetectedAt = 0;
  let lastUserActivityAt = Date.now();
  let checkInProgress = false;
  let reloadRequested = false;
  let updateBanner = null;

  // Remove the one-time cache-busting query after the fresh page has loaded.
  const cleanUrl = new URL(window.location.href);
  if (cleanUrl.searchParams.has(reloadParameter)) {
    cleanUrl.searchParams.delete(reloadParameter);
    window.history.replaceState(
      window.history.state,
      "",
      cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
    );
  }

  // Local files opened outside GitHub Pages (without Liquid rendering) do not
  // have a meaningful build SHA, so the automatic checker safely stays off.
  if (!/^[0-9a-f]{7,40}$/i.test(currentBuild)) {
    return;
  }

  function isVisible(element) {
    if (!element || !element.isConnected || !element.getClientRects().length) {
      return false;
    }

    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function hasOpenEditor() {
    const activeElement = document.activeElement;
    const editableControlSelector =
      "input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']";

    if (
      activeElement &&
      activeElement.matches?.(editableControlSelector) &&
      isVisible(activeElement)
    ) {
      return true;
    }

    if (
      Array.from(
        document.querySelectorAll('[contenteditable="true"]')
      ).some(isVisible)
    ) {
      return true;
    }

    if (
      editorSelectors.some(selector =>
        isVisible(document.querySelector(selector))
      )
    ) {
      return true;
    }

    return Array.from(
      document.querySelectorAll("dialog[open]")
    ).some(isVisible);
  }

  function isPlayingAudio() {
    return Array.from(
      document.querySelectorAll("audio, video")
    ).some(media => !media.paused && !media.ended);
  }

  function isSafeToRefresh() {
    return !hasOpenEditor() && !isPlayingAudio();
  }

  function showUpdateNotice() {
    if (updateBanner || !document.body) {
      return;
    }

    updateBanner = document.createElement("div");
    updateBanner.className = "bb-update-banner";
    updateBanner.setAttribute("role", "status");
    updateBanner.setAttribute("aria-live", "polite");

    const message = document.createElement("span");
    message.className = "bb-update-banner-message";
    message.textContent =
      "Hay una nueva versión de BandaBase. Se actualizará automáticamente cuando sea seguro.";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "bb-update-banner-button";
    button.textContent = "Actualizar ahora";
    button.addEventListener("click", function () {
      refreshPage(true);
    });

    updateBanner.append(message, button);
    document.body.appendChild(updateBanner);
  }

  function refreshPage(userInitiated) {
    if (reloadRequested) {
      return;
    }

    if (!isSafeToRefresh()) {
      if (!userInitiated) {
        return;
      }

      const confirmed = window.confirm(
        "Hay un editor, formulario o audio en uso. Si actualizás ahora, podrías perder cambios sin guardar o interrumpir la reproducción. ¿Querés actualizar de todos modos?"
      );

      if (!confirmed) {
        return;
      }
    }

    reloadRequested = true;

    const reloadUrl = new URL(window.location.href);
    reloadUrl.searchParams.set(
      reloadParameter,
      String(Date.now())
    );

    window.location.replace(reloadUrl.href);
  }

  async function checkForUpdates() {
    if (
      checkInProgress ||
      document.visibilityState !== "visible"
    ) {
      return;
    }

    checkInProgress = true;

    try {
      const versionUrl =
        new URL("./version.json", window.location.href);

      // The small version file and its unique query avoid relying on a cached
      // response and use far less data than repeatedly downloading index.html.
      versionUrl.searchParams.set(
        "_check",
        String(Date.now())
      );

      const response = await fetch(
        versionUrl.href,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          }
        }
      );

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const deployedBuild =
        String(payload?.build_revision || "").trim();

      if (!/^[0-9a-f]{7,40}$/i.test(deployedBuild)) {
        return;
      }

      if (deployedBuild === currentBuild) {
        return;
      }

      if (!updateAvailable) {
        updateAvailable = true;
        newestBuild = deployedBuild;
        firstDetectedAt = Date.now();
        showUpdateNotice();
      } else {
        newestBuild = deployedBuild;
      }

      tryAutomaticRefresh();
    } catch {
      // If the member is offline or Pages is publishing, retry on the next
      // interval or when the tab becomes visible again.
    } finally {
      checkInProgress = false;
    }
  }

  function tryAutomaticRefresh() {
    if (
      !updateAvailable ||
      reloadRequested ||
      document.visibilityState !== "visible" ||
      !isSafeToRefresh()
    ) {
      return;
    }

    const idleFor =
      Date.now() - lastUserActivityAt;
    const updateWait =
      Date.now() - firstDetectedAt;

    if (
      idleFor >= idleBeforeRefreshMs ||
      updateWait >= maxWaitBeforeRefreshMs
    ) {
      refreshPage(false);
    }
  }

  function markUserActivity() {
    lastUserActivityAt = Date.now();
  }

  [
    "pointerdown",
    "keydown",
    "input",
    "change",
    "scroll"
  ].forEach(eventName => {
    document.addEventListener(
      eventName,
      markUserActivity,
      { capture: true, passive: true }
    );
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      void checkForUpdates();
      tryAutomaticRefresh();
    }
  });

  // Start quickly, then recheck while the app is open. The payload is tiny.
  void checkForUpdates();
  window.setInterval(
    checkForUpdates,
    checkIntervalMs
  );
  window.setInterval(
    tryAutomaticRefresh,
    safetyCheckIntervalMs
  );
})();
