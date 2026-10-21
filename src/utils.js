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
  { value: "guitar", label: "Guitarra", icon: "guitar" },
  { value: "voice", label: "Voz", icon: "voice" },
  { value: "keyboard", label: "Teclado", icon: "keyboard" },
  { value: "bass", label: "Bajo", icon: "bass" },
  { value: "drums", label: "Batería", icon: "drums" }
];

function getBandInstrumentOption(value) {
  return BAND_INSTRUMENT_OPTIONS.find(item => item.value === value) || null;
}

function getBandInstrumentIconHtml(value) {
  const option = getBandInstrumentOption(value);
  const icon = option?.icon || value;
  const bodies = {
    guitar:
      '<path d="M14.4 3.5 20.5 9.6M17.1 6.2l-3.4 3.4"/>' +
      '<path d="M12.5 9.4a4.5 4.5 0 0 0-5.9 5.9l-2.1 2.1a2.1 2.1 0 0 0 3 3l2.1-2.1a4.5 4.5 0 0 0 5.9-5.9l-2.2-2.2Z"/>' +
      '<circle cx="10.6" cy="13.5" r="1.4"/><path d="m11.5 12.5 5.7-5.7"/>',
    voice:
      '<rect x="9" y="3" width="6" height="12" rx="3"/>' +
      '<path d="M6.5 10.5a5.5 5.5 0 0 0 11 0M12 16v4M8.5 20h7"/>' +
      '<path d="M10.5 6h3M10.5 9h3"/>',
    keyboard:
      '<rect x="2.5" y="5.5" width="19" height="13" rx="1.8"/>' +
      '<path d="M6 5.8v7M9.5 5.8v7M13 5.8v7M16.5 5.8v7M5 12.5h14"/>' +
      '<path d="M7.7 5.8v4M11.2 5.8v4M14.7 5.8v4M18.2 5.8v4"/>',
    bass:
      '<path d="M15 3.5 20 8.5M17.4 5.9l-3 3"/>' +
      '<path d="M12.7 9.5a4.3 4.3 0 0 0-5.6 5.6l-2 2a2 2 0 0 0 2.8 2.8l2-2a4.3 4.3 0 0 0 5.6-5.6l-2.8-2.8Z"/>' +
      '<circle cx="10.8" cy="13.5" r="1.3"/><path d="m11.7 12.6 5.2-5.2M16.8 7.5l1.3 1.3"/>',
    drums:
      '<path d="M3 7.5h5M5.5 7.5v5M18.5 4.5v6M16 4.5h5M18.5 10.5l-2 9"/>' +
      '<ellipse cx="12" cy="15" rx="5.5" ry="6"/><ellipse cx="12" cy="15" rx="3.2" ry="3.6"/>' +
      '<path d="M7.5 9.5h4v3h-4zM13 7.5h4v3h-4zM6 19.5h12"/>'
  };
  if (!Object.prototype.hasOwnProperty.call(bodies, icon)) return "";
  return '<svg class="bb-instrument-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    bodies[icon] + "</svg>";
}

function formatBandInstruments(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => getBandInstrumentOption(value))
    .filter(Boolean)
    .map(item => item.label)
    .join(", ");
}

function formatBandInstrumentsHtml(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => getBandInstrumentOption(value))
    .filter(Boolean)
    .map(item =>
      '<span class="bb-band-instrument">' +
        '<span class="bb-band-instrument-icon">' +
          getBandInstrumentIconHtml(item.value) +
        '</span>' +
        '<span>' + item.label + '</span>' +
      '</span>'
    )
    .join(" ");
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
