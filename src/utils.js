function parseDuration(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.round(value);
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  if (text.includes(":")) {

    const parts =
      text.split(":");

    if (parts.length !== 2) {
      return null;
    }

    const minutes =
      Number(parts[0]);

    const seconds =
      Number(parts[1]);

    if (
      !Number.isFinite(minutes) ||
      !Number.isFinite(seconds)
    ) {
      return null;
    }

    return (
      Math.max(0, minutes) * 60 +
      Math.max(0, seconds)
    );
  }

  const number =
    Number(text);

  return Number.isFinite(number)
    ? Math.round(number)
    : null;
}


function formatDuration(seconds) {

  if (
    seconds === null ||
    seconds === undefined ||
    seconds === ""
  ) {
    return "—";
  }

  const total =
    Number(seconds);

  if (!Number.isFinite(total)) {
    return "—";
  }

  const minutes =
    Math.floor(total / 60);

  const remaining =
    Math.round(total % 60);

  return (
    minutes +
    ":" +
    String(remaining).padStart(2, "0")
  );
}


function normalizeText(value) {

  return String(value || "")
    .trim()
    .toLowerCase();
}


function uniqueSorted(values) {

  const map =
    new Map();

  values
    .filter(value => String(value || "").trim())
    .forEach(value => {

      const text =
        String(value).trim();

      map.set(
        normalizeText(text),
        text
      );

    });

  return Array.from(map.values())
    .sort((a, b) =>
      a.localeCompare(
        b,
        "es",
        { sensitivity: "base" }
      )
    );
}




const BAND_INSTRUMENT_OPTIONS = [
  { value: "guitar", label: "Guitarra", icon: "🎸" },
  { value: "voice", label: "Voz", icon: "🎤" },
  { value: "keyboard", label: "Teclado", icon: "🎹" },
  { value: "bass", label: "Bajo", icon: "🎸" },
  { value: "drums", label: "Batería", icon: "🥁" }
];

function getBandInstrumentOption(value) {
  return BAND_INSTRUMENT_OPTIONS.find(item => item.value === value) || null;
}

function formatBandInstruments(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => getBandInstrumentOption(value))
    .filter(Boolean)
    .map(item => item.icon + " " + item.label)
    .join(", ");
}

function normalizeBandInstruments(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .filter(value => BAND_INSTRUMENT_OPTIONS.some(item => item.value === value))
  )];
}

function getAudioGainMultiplier(value = 150) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1.5;
  return Math.max(0.5, Math.min(2, numeric / 100));
}



const STORAGE_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

function getStorageUploadSizeError(file) {
  if (!file || !Number.isFinite(Number(file.size)) || Number(file.size) <= STORAGE_UPLOAD_MAX_BYTES) {
    return null;
  }

  const sizeMiB = (Number(file.size) / (1024 * 1024)).toFixed(1);
  const name = String(file.name || "El archivo");
  return name + " pesa " + sizeMiB + " MiB. El límite actual de subida es 50 MiB; elegí un archivo más pequeño o comprimilo.";
}
