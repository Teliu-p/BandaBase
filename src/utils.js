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


