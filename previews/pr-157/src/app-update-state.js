/*
 * Política para recuperar un documento viejo de la caché móvil sin repetir
 * el aviso cuando la versión ya confirmada sigue siendo la publicada.
 */
function shouldSilentlyRefreshKnownBuild(
  currentBuild,
  deployedBuild,
  lastConfirmedBuild,
  forcedReloadAttempt
) {
  return Boolean(
    lastConfirmedBuild &&
    /^[0-9a-f]{7,40}$/i.test(String(lastConfirmedBuild)) &&
    currentBuild !== lastConfirmedBuild &&
    deployedBuild === lastConfirmedBuild &&
    !forcedReloadAttempt
  );
}
