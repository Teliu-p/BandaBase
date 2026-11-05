/* ============================================================
   ACCESO A ARCHIVOS ADJUNTOS
============================================================ */

const LOCAL_ATTACHMENT_TABLES = Object.freeze([
  "material_attachments",
  "comment_attachments",
  "proposal_attachments"
]);

const DEFAULT_LOCAL_AUDIO_SERVER_URL = "http://127.0.0.1:8788";
const LOCAL_AUDIO_SERVER_REQUEST_TIMEOUT_MS = 2500;
const MAX_LOCAL_MATERIAL_AUDIO_UPLOAD_BYTES = 1024 * 1024 * 1024;
const MATERIAL_AUDIO_MIME_BY_EXTENSION = Object.freeze({
  flac: "audio/flac",
  wav: "audio/wav",
  wave: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  aiff: "audio/aiff",
  aif: "audio/aiff",
  wma: "audio/x-ms-wma",
  caf: "audio/x-caf"
});

function getMaterialFileMimeType(file) {
  const name = String(file?.name || "");
  const extension = name.match(/\.([a-z0-9]{1,10})$/i)?.[1]?.toLowerCase();
  if (extension && MATERIAL_AUDIO_MIME_BY_EXTENSION[extension]) {
    return MATERIAL_AUDIO_MIME_BY_EXTENSION[extension];
  }
  const declared = String(file?.type || "").trim().toLowerCase();
  return declared || null;
}

function isMaterialAudioFile(file) {
  return String(getMaterialFileMimeType(file) || "").startsWith("audio/");
}

function getLocalMaterialAudioUploadSizeError(file) {
  const size = Number(file?.size || 0);
  if (size > MAX_LOCAL_MATERIAL_AUDIO_UPLOAD_BYTES) {
    return "El audio supera el límite de 1 GiB por archivo de la biblioteca local.";
  }
  return null;
}


function getLocalAudioServerBaseUrl() {
  const configuredUrl = typeof window !== "undefined"
    ? window.BANDABASE_AUDIO_SERVER_URL
    : null;
  const candidate = typeof configuredUrl === "string" && configuredUrl.trim()
    ? configuredUrl.trim()
    : DEFAULT_LOCAL_AUDIO_SERVER_URL;

  let parsedUrl;
  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error("La dirección del servidor local de audio no es válida.");
  }

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("La dirección del servidor local debe usar HTTP o HTTPS y no incluir credenciales.");
  }

  return parsedUrl.origin;
}


async function requestLocalAttachmentUrl(table, attachmentId, download) {
  let sessionResult;
  try {
    sessionResult = await supabaseClient.auth.getSession();
  } catch {
    return null;
  }

  if (sessionResult.error) return null;

  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) return null;

  const serverBaseUrl = getLocalAudioServerBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    LOCAL_AUDIO_SERVER_REQUEST_TIMEOUT_MS
  );

  let response;
  try {
    response = await fetch(new URL("/api/ticket", serverBaseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
      },
      body: JSON.stringify({
        table,
        attachment_id: attachmentId,
        download
      }),
      signal: controller.signal
    });
  } catch (error) {
    // Unavailable local access remains a Storage fallback only for the
    // attachment tables that have not opted into local-only Materials audio.
    if (error?.name === "AbortError" || error?.name === "TypeError") {
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The status code below will produce the useful error.
  }

  // HTTP 409 means this attachment is not in the local library yet.
  // Comments and proposals retain their previous Storage behavior; Materials
  // audio is local-only and must never fall back to a cloud object.
  if (response.status === 409) {
    if (table === "material_attachments") {
      throw new Error("Este audio todavía no está copiado a la biblioteca local. Volvé a adjuntarlo desde la computadora anfitriona.");
    }
    return null;
  }

  // A local server or Funnel 5xx response means the local route is unavailable.
  // Materials audio will stop locally; Comments/Proposals may still use Storage.
  // Client/permission errors (especially 403) remain explicit and are not hidden.
  if (response.status >= 500) return null;

  if (!response.ok) {
    throw new Error(
      payload?.error || "El servidor local rechazó la solicitud (HTTP " + response.status + ")."
    );
  }

  if (
    typeof payload?.url !== "string" ||
    !payload.url.startsWith("/api/media/")
  ) {
    throw new Error("El servidor local devolvió un enlace de audio no válido.");
  }

  return new URL(payload.url, serverBaseUrl).toString();
}


/**
 * Upload or remove audio belonging to Materials through the authenticated
 * local library server. These helpers intentionally do not call Supabase
 * Storage; the server rechecks the user session and the attachment row.
 */
async function uploadLocalMaterialAudio(attachmentId, file, mimeType = getMaterialFileMimeType(file)) {
  if (typeof attachmentId !== "string" || !attachmentId) {
    throw new Error("No se identificó el adjunto de audio que se va a guardar.");
  }
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    throw new Error("El archivo de audio está vacío o no se puede leer.");
  }
  if (!String(mimeType || "").startsWith("audio/")) {
    throw new Error("El archivo no tiene un formato de audio reconocido.");
  }

  let sessionResult;
  try {
    sessionResult = await supabaseClient.auth.getSession();
  } catch {
    throw new Error("No se pudo obtener la sesión para guardar el audio local.");
  }
  if (sessionResult.error) {
    throw new Error(sessionResult.error.message || "No se pudo validar la sesión de BandaBase.");
  }
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("Iniciá sesión en BandaBase para guardar el audio en la biblioteca local.");
  }

  const serverBaseUrl = getLocalAudioServerBaseUrl();
  let response;
  try {
    response = await fetch(
      new URL("/api/upload/" + encodeURIComponent(attachmentId), serverBaseUrl).toString(),
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + accessToken,
          "Content-Type": mimeType
        },
        body: file
      }
    );
  } catch {
    throw new Error("No se pudo conectar con la biblioteca local. Comprobá que el servidor de audio y Tailscale Funnel estén activos.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The HTTP status below is enough to report a useful failure.
  }
  if (!response.ok || payload?.ok !== true) {
    throw new Error(
      payload?.error ||
      "No se pudo guardar el audio en la biblioteca local (HTTP " + response.status + ")."
    );
  }
  return payload;
}


async function deleteLocalMaterialAttachment(attachmentId) {
  let sessionResult;
  try {
    sessionResult = await supabaseClient.auth.getSession();
  } catch {
    throw new Error("No se pudo obtener la sesión para quitar el audio local.");
  }
  if (sessionResult.error) {
    throw new Error(sessionResult.error.message || "No se pudo validar la sesión de BandaBase.");
  }
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) {
    throw new Error("Iniciá sesión en BandaBase para quitar el audio local.");
  }

  const serverBaseUrl = getLocalAudioServerBaseUrl();
  const response = await fetch(
    new URL("/api/delete/" + encodeURIComponent(attachmentId), serverBaseUrl).toString(),
    {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken
      }
    }
  );

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // The HTTP status below will explain the failure.
  }
  if (!response.ok || payload?.deleted !== true) {
    throw new Error(
      payload?.error ||
      "No se pudo quitar el audio de la biblioteca local (HTTP " + response.status + ")."
    );
  }
  return payload;
}


async function getAttachmentAccessUrl(table, attachment, options = {}) {
  if (!LOCAL_ATTACHMENT_TABLES.includes(table)) {
    throw new Error("Tipo de adjunto no admitido.");
  }

  const attachmentId = String(attachment?.id || "");
  const storagePath = String(attachment?.storage_path || "");
  if (!attachmentId || !storagePath) {
    throw new Error("No se encontró la ruta del archivo adjunto.");
  }

  const download = options.download === true;
  const isAudio = storagePath.startsWith("local:") || isMaterialAudioFile({
    name: attachment.name || attachment.file_name || attachment.title || "",
    type: attachment.mime_type || ""
  });

  if (isAudio) {
    const localUrl = await requestLocalAttachmentUrl(table, attachmentId, download);
    if (localUrl) return localUrl;

    if (table === "material_attachments") {
      throw new Error(
        "Este audio de Materiales está disponible únicamente en la biblioteca local. Encendé el equipo anfitrión y comprobá que el servidor de audio y Tailscale Funnel estén activos."
      );
    }
  }

  const downloadName = attachment.name || attachment.file_name || attachment.title || true;
  const signedUrlOptions = download
    ? { download: downloadName }
    : undefined;

  const { data, error } = await supabaseClient
    .storage
    .from("materials")
    .createSignedUrl(storagePath, 3600, signedUrlOptions);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "No se pudo preparar el archivo adjunto.");
  }

  return data.signedUrl;
}
