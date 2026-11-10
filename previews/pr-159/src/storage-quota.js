/* Cuota acumulada de Storage para las subidas hechas desde BandaBase. */

function formatStorageQuotaBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1000000) {
    return (bytes / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " MB";
  }
  if (bytes >= 1000) {
    return (bytes / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " kB";
  }
  return Math.round(bytes) + " bytes";
}

async function getStorageQuotaStatus(bandId = currentBand?.id) {
  if (!bandId) throw new Error("No hay una banda seleccionada para consultar el almacenamiento.");

  const { data, error } = await supabaseClient.rpc(
    "get_storage_quota_status",
    { p_band_id: bandId }
  );
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Supabase devolvió un estado de almacenamiento inválido.");
  }

  return {
    usedBytes: Math.max(0, Number(data.used_bytes) || 0),
    limitBytes: Math.max(0, Number(data.limit_bytes) || 0),
    remainingBytes: Math.max(0, Number(data.remaining_bytes) || 0),
    objectCount: Math.max(0, Number(data.object_count) || 0),
    warningPercent: Math.min(99, Math.max(1, Number(data.warning_percent) || 70)),
    criticalPercent: Math.min(100, Math.max(1, Number(data.critical_percent) || 85)),
    invalidSizeCount: Math.max(0, Number(data.invalid_size_count) || 0)
  };
}

async function assertStorageQuotaCanUpload(fileSizeBytes) {
  const fileSize = Number(fileSizeBytes);
  if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
    throw new Error("No se pudo verificar el tamaño del archivo.");
  }

  const quota = await getStorageQuotaStatus();
  if (quota.invalidSizeCount > 0) {
    throw new Error(
      "No se pueden aceptar nuevas subidas porque hay archivos cuyo tamaño no se puede verificar. Avisá a un administrador."
    );
  }
  if (fileSize > quota.remainingBytes) {
    throw new Error(
      "No hay espacio suficiente en BandaBase. Quedan " +
      formatStorageQuotaBytes(quota.remainingBytes) +
      " y el archivo ocupa " + formatStorageQuotaBytes(fileSize) +
      ". Eliminá archivos que ya no necesites y volvé a intentarlo."
    );
  }
}

function getStorageQuotaUploadErrorMessage(error) {
  const message = String(error?.message || error || "");
  return /BandaBase (?:alcanzó|bloqueó)|límite de almacenamiento/i.test(message)
    ? message
    : "";
}

async function renderAdminStorageQuota() {
  const container = document.getElementById("adminStorageQuota");
  if (!container) return;

  container.innerHTML = '<div class="admin-empty">Consultando almacenamiento…</div>';

  try {
    const quota = await getStorageQuotaStatus();
    const percent = quota.limitBytes > 0 ? quota.usedBytes / quota.limitBytes * 100 : 0;
    const safePercent = Math.min(100, Math.max(0, percent));
    const isCritical = quota.invalidSizeCount > 0 || percent >= quota.criticalPercent;
    const isWarning = !isCritical && percent >= quota.warningPercent;
    const stateClass = isCritical
      ? "storage-quota-meter--critical"
      : isWarning
        ? "storage-quota-meter--warning"
        : "";
    let statusMessage = "Almacenamiento dentro del margen previsto.";
    let statusClassName = "storage-quota-status";

    if (quota.invalidSizeCount > 0) {
      statusMessage = "Hay archivos cuyo tamaño no se puede verificar. Las nuevas subidas quedan bloqueadas por seguridad.";
      statusClassName += " storage-quota-status--critical";
    } else if (isCritical) {
      statusMessage = "Se alcanzó el umbral crítico. Revisá y eliminá archivos que ya no se necesiten.";
      statusClassName += " storage-quota-status--critical";
    } else if (isWarning) {
      statusMessage = "El almacenamiento está llegando al límite. Conviene liberar espacio.";
      statusClassName += " storage-quota-status--warning";
    }

    container.innerHTML =
      '<div class="storage-quota-summary">' +
        "<strong>" + formatStorageQuotaBytes(quota.usedBytes) + " / " +
        formatStorageQuotaBytes(quota.limitBytes) + "</strong>" +
        "<span>" + percent.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%</span>" +
      "</div>" +
      '<div class="storage-quota-track ' + stateClass + '" role="progressbar" ' +
        'aria-label="Almacenamiento utilizado" aria-valuemin="0" aria-valuemax="100" ' +
        'aria-valuenow="' + Math.round(safePercent) + '">' +
        '<span style="width:' + safePercent + '%"></span>' +
      "</div>" +
      '<div class="storage-quota-meta">' +
        "<span>Disponibles: " + formatStorageQuotaBytes(quota.remainingBytes) + "</span>" +
        "<span>" + quota.objectCount + " archivos contabilizados</span>" +
      "</div>" +
      '<p class="' + statusClassName + '">' + escapeHtml(statusMessage) + "</p>" +
      (quota.invalidSizeCount > 0
        ? '<p class="storage-quota-status storage-quota-status--critical">' +
            quota.invalidSizeCount + " archivos tienen tamaños no verificables.</p>"
        : "") +
      '<p class="admin-section-intro storage-quota-footnote">' +
        "Límite preventivo de BandaBase: 700 MB para todos los buckets de este proyecto. " +
        "Los audios de Materiales guardados en la biblioteca local no se incluyen. " +
        "Este indicador muestra bytes actuales; Supabase factura Storage con su propio promedio del período." +
      "</p>" +
      '<button type="button" id="refreshStorageQuotaBtn" class="btn btn-subtle">Actualizar consumo</button>';

    document.getElementById("refreshStorageQuotaBtn")?.addEventListener(
      "click",
      () => { void renderAdminStorageQuota(); }
    );
  } catch (error) {
    console.error("No se pudo consultar la cuota de Storage.", error);
    container.innerHTML =
      '<div class="admin-empty">No se pudo consultar el límite de almacenamiento. ' +
      "Verificá que la migración de cuota esté aplicada y volvé a intentar.</div>" +
      '<button type="button" id="refreshStorageQuotaBtn" class="btn btn-subtle">Reintentar</button>';
    document.getElementById("refreshStorageQuotaBtn")?.addEventListener(
      "click",
      () => { void renderAdminStorageQuota(); }
    );
  }
}
