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
    // An unavailable local server must not prevent existing Storage files
    // from continuing to work.
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
  // Keep using the existing private Supabase Storage object in that case.
  if (response.status === 409) return null;

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
 * Resolve a private attachment through the local library when it is present.
 * Uncopied files and an unavailable local server retain the existing
 * Supabase Storage signed-URL behavior. The local server rechecks the
 * attachment row with the user's JWT and RLS before returning a ticket.
 */
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
  const isAudio = String(attachment.mime_type || "").toLowerCase().startsWith("audio/");

  if (isAudio) {
    const localUrl = await requestLocalAttachmentUrl(table, attachmentId, download);
    if (localUrl) return localUrl;
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
