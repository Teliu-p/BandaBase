/* ============================================================
   COPIAS LOCALES DE AUDIO DE MATERIALES (OPFS)
   Descarga completa y reproducible sin depender de la red durante
   la reproducción. Las copias pertenecen a este navegador/dispositivo.
============================================================ */

const MATERIAL_AUDIO_OPFS_DIRECTORY = "bandabase-material-audio-cache-v1";
const materialAudioCacheObjectUrls = new Map();

function isMaterialAudioOfflineCacheAvailable() {
  return Boolean(
    typeof window !== "undefined" &&
    window.isSecureContext &&
    navigator.storage &&
    typeof navigator.storage.getDirectory === "function" &&
    typeof URL.createObjectURL === "function"
  );
}

function getMaterialAudioCacheFileStem(attachment) {
  const id = String(attachment?.id || "");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new Error("No se pudo identificar el audio que se va a preparar.");
  }
  return id;
}

async function getMaterialAudioCacheDirectory() {
  if (!isMaterialAudioOfflineCacheAvailable()) {
    throw new Error("Este navegador no permite guardar audios completos para reproducirlos sin conexión. Actualizá Chrome e intentá nuevamente.");
  }
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(MATERIAL_AUDIO_OPFS_DIRECTORY, { create: true });
}

function notifyMaterialAudioCacheProgress(callback, loadedBytes, totalBytes) {
  if (typeof callback !== "function") return;
  try {
    callback({
      loadedBytes,
      totalBytes,
      percent: Number.isFinite(totalBytes) && totalBytes > 0
        ? Math.min(100, loadedBytes / totalBytes * 100)
        : null
    });
  } catch {
    // La actualización visual no debe interrumpir una descarga válida.
  }
}

async function readMaterialAudioPreparedFile(attachment) {
  if (!attachment?.id || !attachment?.storage_path) return null;

  try {
    const directory = await getMaterialAudioCacheDirectory();
    const stem = getMaterialAudioCacheFileStem(attachment);
    const [audioHandle, metadataHandle] = await Promise.all([
      directory.getFileHandle(stem + ".audio"),
      directory.getFileHandle(stem + ".json")
    ]);
    const [file, metadataFile] = await Promise.all([
      audioHandle.getFile(),
      metadataHandle.getFile()
    ]);
    const metadata = JSON.parse(await metadataFile.text());

    if (
      metadata?.attachmentId !== String(attachment.id) ||
      metadata?.storagePath !== String(attachment.storage_path) ||
      !Number.isSafeInteger(metadata?.sizeBytes) ||
      metadata.sizeBytes <= 0 ||
      file.size !== metadata.sizeBytes
    ) {
      return null;
    }

    return { file, metadata };
  } catch {
    return null;
  }
}

async function isMaterialAudioPrepared(attachment) {
  return Boolean(await readMaterialAudioPreparedFile(attachment));
}

async function getMaterialAudioPreparedUrl(attachment) {
  const prepared = await readMaterialAudioPreparedFile(attachment);
  if (!prepared) return null;

  const cacheKey = String(attachment.id) + "|" + String(attachment.storage_path);
  const existingUrl = materialAudioCacheObjectUrls.get(cacheKey);
  if (existingUrl) return existingUrl;

  const objectUrl = URL.createObjectURL(prepared.file);
  materialAudioCacheObjectUrls.set(cacheKey, objectUrl);
  return objectUrl;
}

async function prepareMaterialAudioAttachment(attachment, onProgress) {
  if (!attachment?.id || !attachment?.storage_path) {
    throw new Error("No se encontró el audio que se va a preparar.");
  }

  const existing = await readMaterialAudioPreparedFile(attachment);
  if (existing) {
    notifyMaterialAudioCacheProgress(onProgress, existing.file.size, existing.file.size);
    return {
      alreadyPrepared: true,
      sizeBytes: existing.file.size,
      persistent: existing.metadata.persistent === true
    };
  }

  const directory = await getMaterialAudioCacheDirectory();
  const stem = getMaterialAudioCacheFileStem(attachment);
  const audioFileName = stem + ".audio";
  const metadataFileName = stem + ".json";

  let persistent = false;
  try {
    if (typeof navigator.storage.persist === "function") {
      persistent = await navigator.storage.persist();
    }
  } catch {
    // La preparación sigue siendo válida aunque el navegador no conceda persistencia.
  }

  const accessUrl = await getAttachmentAccessUrl("material_attachments", attachment);
  let response;
  try {
    response = await fetch(accessUrl, { method: "GET", cache: "no-store" });
  } catch {
    throw new Error("No se pudo descargar el audio completo. Revisá que la computadora anfitriona, el servidor de audio y Tailscale estén disponibles.");
  }

  // Only HTTP 200 guarantees that this is the complete resource, not a Range response.
  if (response.status !== 200 || !response.body || typeof response.body.getReader !== "function") {
    try { await response.body?.cancel(); } catch {}
    throw new Error("El servidor no entregó el archivo de audio completo. Volvé a intentar la preparación.");
  }

  const rawLength = Number(response.headers.get("content-length"));
  const totalBytes = Number.isSafeInteger(rawLength) && rawLength > 0 ? rawLength : null;
  let insufficientSpace = false;
  if (totalBytes !== null && typeof navigator.storage?.estimate === "function") {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = Number(estimate?.quota);
      const usage = Number(estimate?.usage);
      if (Number.isFinite(quota) && quota > 0 && Number.isFinite(usage)) {
        insufficientSpace = quota - usage < totalBytes;
      }
    } catch {
      // A failed estimate should not prevent an otherwise valid download.
    }
  }
  if (insufficientSpace) {
    try { await response.body.cancel(); } catch {}
    throw new Error("No hay espacio suficiente en el almacenamiento del navegador para preparar este audio. Liberá espacio o quitá copias preparadas que ya no uses.");
  }

  // Old incomplete files are never treated as prepared because the JSON
  // completion record is written only after the audio file has been closed.
  await Promise.all([
    directory.removeEntry(audioFileName).catch(() => {}),
    directory.removeEntry(metadataFileName).catch(() => {})
  ]);

  let writable = null;
  let reader = null;
  let completed = false;
  let loadedBytes = 0;

  try {
    const audioHandle = await directory.getFileHandle(audioFileName, { create: true });
    writable = await audioHandle.createWritable({ keepExistingData: false });
    reader = response.body.getReader();
    notifyMaterialAudioCacheProgress(onProgress, 0, totalBytes);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || !value.byteLength) continue;
      await writable.write(value);
      loadedBytes += value.byteLength;
      notifyMaterialAudioCacheProgress(onProgress, loadedBytes, totalBytes);
    }

    if (loadedBytes <= 0 || (totalBytes !== null && loadedBytes !== totalBytes)) {
      throw new Error("La descarga quedó incompleta (" + loadedBytes + " de " + (totalBytes ?? "un tamaño desconocido") + " bytes). No se guardó como audio preparado.");
    }

    await writable.close();
    writable = null;

    const savedFile = await audioHandle.getFile();
    if (savedFile.size !== loadedBytes) {
      throw new Error("El tamaño guardado no coincide con el audio descargado. Volvé a preparar el archivo.");
    }

    const metadata = {
      attachmentId: String(attachment.id),
      storagePath: String(attachment.storage_path),
      sizeBytes: savedFile.size,
      contentType: response.headers.get("content-type") || attachment.mime_type || "application/octet-stream",
      etag: response.headers.get("etag") || null,
      lastModified: response.headers.get("last-modified") || null,
      savedAt: new Date().toISOString(),
      persistent
    };
    const metadataHandle = await directory.getFileHandle(metadataFileName, { create: true });
    const metadataWritable = await metadataHandle.createWritable();
    await metadataWritable.write(JSON.stringify(metadata));
    await metadataWritable.close();
    completed = true;

    notifyMaterialAudioCacheProgress(onProgress, loadedBytes, totalBytes ?? loadedBytes);
    return { alreadyPrepared: false, sizeBytes: savedFile.size, persistent };
  } catch (error) {
    try { await reader?.cancel(); } catch {}
    try { await writable?.abort(); } catch {}
    if (!completed) {
      await Promise.all([
        directory.removeEntry(audioFileName).catch(() => {}),
        directory.removeEntry(metadataFileName).catch(() => {})
      ]);
    }
    if (error?.name === "QuotaExceededError") {
      throw new Error("El navegador se quedó sin espacio al guardar el audio. Liberá espacio y volvé a prepararlo.");
    }
    throw error;
  }
}

async function clearMaterialAudioPrepared(attachment) {
  if (!attachment?.id) return false;
  const stem = getMaterialAudioCacheFileStem(attachment);
  const cacheKey = String(attachment.id) + "|" + String(attachment.storage_path || "");
  const objectUrl = materialAudioCacheObjectUrls.get(cacheKey);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    materialAudioCacheObjectUrls.delete(cacheKey);
  }

  try {
    const directory = await getMaterialAudioCacheDirectory();
    await Promise.all([
      directory.removeEntry(stem + ".audio").catch(() => {}),
      directory.removeEntry(stem + ".json").catch(() => {})
    ]);
    return true;
  } catch (error) {
    throw new Error(error?.message || "No se pudo quitar la copia preparada de este dispositivo.");
  }
}
