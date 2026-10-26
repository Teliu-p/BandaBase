/* Formato enriquecido exclusivo del compositor de Materiales. */

const MATERIAL_RICH_TEXT_PREFIX =
  "BANDABASE_RICH_TEXT_V1:";

const MATERIAL_RICH_TEXT_ALLOWED_SIZE_CLASSES =
  Object.freeze([
    "material-text-size-normal",
    "material-text-size-1",
    "material-text-size-2"
  ]);

const MATERIAL_NOTATION_SYMBOLS = Object.freeze({
  noteSixteenth: "\u{1D161}",
  noteEighth: "\u{1D160}",
  noteQuarter: "\u{1D15F}",
  noteHalf: "\u{1D15E}",
  noteWhole: "\u{1D15D}",
  restSixteenth: "\u{1D13F}",
  restEighth: "\u{1D13E}",
  restQuarter: "\u{1D13D}",
  restHalf: "\u{1D13C}",
  restWhole: "\u{1D13B}"
});

function getMaterialNotationSymbol(notationKey, dotted = false) {
  const symbol = MATERIAL_NOTATION_SYMBOLS[notationKey] || "";
  return symbol ? symbol + (dotted ? "\u{1D16D}" : "") : "";
}

const MATERIAL_NOTATION_LEGACY_KEYS = Object.freeze({
  "\u{1D161}": "noteSixteenth",
  "\u{1D160}": "noteEighth",
  "\u{1D15F}": "noteQuarter",
  "\u{1D15E}": "noteHalf",
  "\u{1D15D}": "noteWhole",
  "\u{1D13F}": "restSixteenth",
  "\u{1D13E}": "restEighth",
  "\u{1D13D}": "restQuarter",
  "\u{1D13C}": "restHalf",
  "\u{1D13B}": "restWhole",
  "♫": "noteEighthPair",
  "♬": "noteSixteenthPair"
});

const MATERIAL_NOTATION_LABELS = Object.freeze({
  noteSixteenth: "Semicorchea",
  noteEighth: "Corchea",
  noteQuarter: "Negra",
  noteHalf: "Blanca",
  noteWhole: "Redonda",
  restSixteenth: "Silencio de semicorchea",
  restEighth: "Silencio de corchea",
  restQuarter: "Silencio de negra",
  restHalf: "Silencio de blanca",
  restWhole: "Silencio de redonda",
  noteEighthPair: "Dos corcheas unidas",
  noteSixteenthPair: "Dos semicorcheas unidas"
});

const MATERIAL_NOTATION_SVG_BODIES = Object.freeze({
  noteSixteenth:
    '<ellipse cx="11" cy="23" rx="6" ry="3.8" transform="rotate(-22 11 23)" fill="currentColor"/>' +
    '<path d="M16 21.5V5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M16 5C24 6 23 11 18 14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M16 9C23 10 22 15 18 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  noteEighth:
    '<ellipse cx="11" cy="23" rx="6" ry="3.8" transform="rotate(-22 11 23)" fill="currentColor"/>' +
    '<path d="M16 21.5V5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M16 5C24 6 23 11 18 14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  noteQuarter:
    '<ellipse cx="11" cy="23" rx="6" ry="3.8" transform="rotate(-22 11 23)" fill="currentColor"/>' +
    '<path d="M16 21.5V5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  noteHalf:
    '<ellipse cx="11" cy="23" rx="6" ry="3.8" transform="rotate(-22 11 23)" fill="none" stroke="currentColor" stroke-width="2.8"/>' +
    '<path d="M16 21.5V5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
  noteWhole:
    '<ellipse cx="13" cy="22" rx="7" ry="4.2" transform="rotate(-22 13 22)" fill="none" stroke="currentColor" stroke-width="2.8"/>',
  restSixteenth:
    '<path d="M15 5L11 14L17 17L12 26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="20" cy="5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="11" r="2.5" fill="currentColor"/>',
  restEighth:
    '<path d="M16 8L12 15L18 18L12.5 26" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="21" cy="5" r="3" fill="currentColor"/>',
  restQuarter:
    '<path d="M18 4L11 11L19 15L11.5 22L17 27" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  restHalf:
    '<path d="M4 16H28" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<rect x="8" y="10" width="16" height="6" rx=".5" fill="currentColor"/>',
  restWhole:
    '<path d="M4 16H28" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
    '<rect x="8" y="16" width="16" height="6" rx=".5" fill="currentColor"/>',
  noteEighthPair:
    '<ellipse cx="9" cy="24" rx="5.5" ry="3.5" transform="rotate(-22 9 24)" fill="currentColor"/>' +
    '<ellipse cx="24" cy="19" rx="5.5" ry="3.5" transform="rotate(-22 24 19)" fill="currentColor"/>' +
    '<path d="M14 22.5V7M29 17.5V2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M14 7L29 2V6L14 11Z" fill="currentColor"/>',
  noteSixteenthPair:
    '<ellipse cx="9" cy="24" rx="5.5" ry="3.5" transform="rotate(-22 9 24)" fill="currentColor"/>' +
    '<ellipse cx="24" cy="19" rx="5.5" ry="3.5" transform="rotate(-22 24 19)" fill="currentColor"/>' +
    '<path d="M14 22.5V7M29 17.5V2" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '<path d="M14 7L29 2V6L14 11ZM14 12L29 7V11L14 16Z" fill="currentColor"/>'
});

function getMaterialNotationInfoFromLegacySymbol(value) {
  const characters = Array.from(String(value ?? ""));
  if (characters.length < 1 || characters.length > 2) return null;

  const notationKey = MATERIAL_NOTATION_LEGACY_KEYS[characters[0]];
  if (!notationKey) return null;

  const dotted = characters.length === 2 && characters[1] === "\u{1D16D}";
  if (characters.length === 2 && !dotted) return null;
  if (dotted && (notationKey === "noteEighthPair" || notationKey === "noteSixteenthPair")) {
    return null;
  }

  return { notationKey, dotted };
}

function isMaterialNotationKey(notationKey) {
  return Object.prototype.hasOwnProperty.call(
    MATERIAL_NOTATION_SVG_BODIES,
    notationKey
  );
}

function getMaterialNotationSvgMarkup(notationKey, dotted = false) {
  if (!isMaterialNotationKey(notationKey)) return "";

  const pair = notationKey === "noteEighthPair" || notationKey === "noteSixteenthPair";
  const viewBox = pair ? "0 0 36 32" : "0 0 32 32";
  const dot = dotted ? '<circle cx="27" cy="22" r="2" fill="currentColor"/>' : "";
  return '<svg class="material-notation-svg" xmlns="http://www.w3.org/2000/svg" viewBox="' +
    viewBox + '" aria-hidden="true" focusable="false">' +
    MATERIAL_NOTATION_SVG_BODIES[notationKey] + dot + "</svg>";
}

function getMaterialNotationFallbackText(notationKey, dotted = false) {
  if (notationKey === "noteEighthPair") return "♫";
  if (notationKey === "noteSixteenthPair") return "♬";
  return getMaterialNotationSymbol(notationKey, dotted);
}

function getMaterialNotationHtml(notationKey, dotted = false) {
  if (!isMaterialNotationKey(notationKey)) return "";
  const isPair = notationKey === "noteEighthPair" || notationKey === "noteSixteenthPair";
  const isDotted = Boolean(dotted) && !isPair;
  const label = MATERIAL_NOTATION_LABELS[notationKey] + (isDotted ? " con puntillo" : "");
  return '<span class="material-notation-symbol" data-material-notation="' +
    notationKey + '" data-material-dotted="' + String(isDotted) +
    '" contenteditable="false" role="img" aria-label="' + label + '">' +
    getMaterialNotationSvgMarkup(notationKey, isDotted) +
    '<span class="material-notation-fallback" aria-hidden="true">' +
    escapeMaterialHtmlText(getMaterialNotationFallbackText(notationKey, isDotted)) +
    "</span></span>";
}

function createMaterialNotationElement(notationKey, dotted = false) {
  const html = getMaterialNotationHtml(notationKey, dotted);
  if (!html) return null;
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.firstElementChild;
}

function getMaterialNotationInfoFromNode(node) {
  if (!node?.classList?.contains("material-notation-symbol")) return null;
  const notationKey = node.getAttribute("data-material-notation");
  if (!isMaterialNotationKey(notationKey)) return null;
  const dotted = node.getAttribute("data-material-dotted") === "true";
  if (dotted && (notationKey === "noteEighthPair" || notationKey === "noteSixteenthPair")) {
    return null;
  }
  return { notationKey, dotted };
}

const MATERIAL_LEGACY_NOTATION_PATTERN =
  /[\u{1D13B}-\u{1D13F}\u{1D15D}-\u{1D161}]\u{1D16D}?|[♫♬]/gu;

function renderMaterialNotationTextHtml(value, insideAnchor = false) {
  const text = combineMaterialNotationPairs(String(value ?? ""));
  const pattern = new RegExp(MATERIAL_LEGACY_NOTATION_PATTERN.source, "gu");
  let html = "";
  let lastIndex = 0;

  const appendText = chunk => {
    if (!chunk) return "";
    return insideAnchor
      ? escapeMaterialHtmlText(chunk).replaceAll("\n", "<br>")
      : renderMaterialAutoLinkedTextHtml(chunk);
  };

  for (const match of text.matchAll(pattern)) {
    html += appendText(text.slice(lastIndex, match.index));
    const notation = getMaterialNotationInfoFromLegacySymbol(match[0]);
    html += notation
      ? getMaterialNotationHtml(notation.notationKey, notation.dotted)
      : appendText(match[0]);
    lastIndex = match.index + match[0].length;
  }

  html += appendText(text.slice(lastIndex));
  return html;
}

function appendMaterialRichTextTextWithNotation(target, value, insideAnchor = false) {
  const text = combineMaterialNotationPairs(String(value ?? ""));
  const pattern = new RegExp(MATERIAL_LEGACY_NOTATION_PATTERN.source, "gu");
  let lastIndex = 0;

  const appendText = chunk => {
    if (!chunk) return;
    if (insideAnchor) {
      target.appendChild(document.createTextNode(chunk));
    } else {
      target.appendChild(createMaterialAutoLinkFragment(chunk));
    }
  };

  for (const match of text.matchAll(pattern)) {
    appendText(text.slice(lastIndex, match.index));
    const notation = getMaterialNotationInfoFromLegacySymbol(match[0]);
    const icon = notation
      ? createMaterialNotationElement(notation.notationKey, notation.dotted)
      : null;
    if (icon) {
      target.appendChild(icon);
    } else {
      appendText(match[0]);
    }
    lastIndex = match.index + match[0].length;
  }

  appendText(text.slice(lastIndex));
}


function getMaterialIndentRepeatDelay(repeatCount) {
  const count = Math.max(0, Number(repeatCount) || 0);
  return Math.max(25, 115 - Math.floor(count / 5) * 15);
}


function parseMaterialAudioMarkerTime(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isSafeInteger(seconds) && seconds <= 86400 ? seconds : null;
  }

  const parts = raw.split(":");
  if ((parts.length !== 2 && parts.length !== 3) || parts.some(part => !/^\d+$/.test(part))) {
    return null;
  }

  const values = parts.map(Number);
  if (values[values.length - 1] >= 60) return null;
  if (parts.length === 3 && values[1] >= 60) return null;

  const seconds = parts.length === 2
    ? values[0] * 60 + values[1]
    : values[0] * 3600 + values[1] * 60 + values[2];

  return Number.isSafeInteger(seconds) && seconds <= 86400 ? seconds : null;
}


function formatMaterialAudioMarkerLabel(value) {
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) return "00:00";

  const totalSeconds = Math.min(numeric, 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = number => String(number).padStart(2, "0");

  return hours
    ? hours + ":" + pad(minutes) + ":" + pad(seconds)
    : String(minutes) + ":" + pad(seconds);
}


function getMaterialAudioMarkerSecondsFromPlaybackTime(value) {
  if (!Number.isFinite(value) || value < 0 || value > 86400) return null;
  const seconds = Math.floor(value);
  return Number.isSafeInteger(seconds) ? seconds : null;
}


function combineMaterialNotationPairs(value) {
  return String(value ?? "")
    .replace(/\u{1D160}[ \u00a0]{1,2}\u{1D160}/gu, "♫")
    .replace(/\u{1D161}[ \u00a0]{1,2}\u{1D161}/gu, "♬")
    .replace(/([♫♬])[ \u00a0]{1,2}(?=[♫♬\u{1D160}\u{1D161}])/gu, "$1")
    .replace(/([\u{1D160}\u{1D161}])[ \u00a0]{1,2}(?=[♫♬])/gu, "$1");
}


function getMaterialShortcutAction(event) {
  if (
    !event ||
    !event.altKey ||
    event.shiftKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return null;
  }

  const shortcuts = {
    Digit1: "bold",
    Numpad1: "bold",
    Digit2: "italic",
    Numpad2: "italic",
    Digit3: "parentheses",
    Numpad3: "parentheses",
    Digit4: "brackets",
    Numpad4: "brackets",
    Digit5: "size1",
    Numpad5: "size1",
    Digit6: "size2",
    Numpad6: "size2",
    Digit0: "clearFormatting",
    Numpad0: "clearFormatting",
    KeyQ: "noteSixteenth",
    KeyW: "noteEighth",
    KeyE: "noteQuarter",
    KeyR: "noteHalf",
    KeyT: "noteWhole",
    KeyA: "restSixteenth",
    KeyS: "restEighth",
    KeyD: "restQuarter",
    KeyF: "restHalf",
    KeyG: "restWhole",
    KeyZ: "notationDot",
    KeyX: "audioMarker",
    KeyC: "indentMore",
    KeyV: "indentLess"
  };

  return shortcuts[event.code] || null;
}


const MATERIAL_KEYBOARD_SHORTCUT_BUTTONS = Object.freeze({
  bold: "materialBoldBtn",
  italic: "materialItalicBtn",
  parentheses: "materialParenthesesBtn",
  brackets: "materialBracketsBtn",
  size1: "materialSize1Btn",
  size2: "materialSize2Btn",
  noteSixteenth: "materialNoteSixteenthBtn",
  noteEighth: "materialNoteEighthBtn",
  noteQuarter: "materialNoteQuarterBtn",
  noteHalf: "materialNoteHalfBtn",
  noteWhole: "materialNoteWholeBtn",
  restSixteenth: "materialRestSixteenthBtn",
  restEighth: "materialRestEighthBtn",
  restQuarter: "materialRestQuarterBtn",
  restHalf: "materialRestHalfBtn",
  restWhole: "materialRestWholeBtn",
  notationDot: "materialNotationDotBtn",
  audioMarker: "materialAudioMarkerBtn"
});

function getMaterialKeyboardShortcutButtonId(action) {
  return MATERIAL_KEYBOARD_SHORTCUT_BUTTONS[action] || null;
}

/*
 * Divide a rich-text subtree around inline attachments without losing the
 * formatting wrappers surrounding each text segment. Attachments must become
 * independent material blocks even when the caret was inside bold/italic/size.
 */
function splitMaterialComposerNodeByAttachments(node) {

  if (!node) {
    return [];
  }

  if (
    node.nodeType === 1 &&
    node.classList?.contains("material-inline-attachment")
  ) {
    return [{
      attachment: node
    }];
  }

  if (
    node.nodeType !== 1 ||
    !node.querySelector?.(".material-inline-attachment")
  ) {
    return [{
      node: node.cloneNode(true)
    }];
  }

  const segments = [];
  let currentWrapper =
    node.cloneNode(false);
  let hasCurrentChildren = false;

  function flushTextSegment() {

    if (!hasCurrentChildren) {
      return;
    }

    segments.push({
      node: currentWrapper
    });

    currentWrapper =
      node.cloneNode(false);

    hasCurrentChildren = false;

  }

  Array.from(
    node.childNodes || []
  ).forEach(
    child => {

      splitMaterialComposerNodeByAttachments(
        child
      ).forEach(
        segment => {

          if (segment.attachment) {

            flushTextSegment();

            segments.push(
              segment
            );

            return;

          }

          currentWrapper.appendChild(
            segment.node
          );

          hasCurrentChildren = true;

        }
      );

    }
  );

  flushTextSegment();

  return segments;

}



function calculateMaterialForcedCaretPadding(
  caretX,
  caretY,
  targetX,
  targetY,
  lineHeight,
  spaceWidth,
  contentStartX
) {

  const safeLineHeight =
    Number.isFinite(lineHeight) && lineHeight > 0
      ? lineHeight
      : 20;

  const safeSpaceWidth =
    Number.isFinite(spaceWidth) && spaceWidth > 0
      ? spaceWidth
      : 4;

  const lineBreaks =
    Math.max(
      0,
      Math.round(
        (targetY - caretY) / safeLineHeight
      )
    );

  const horizontalStart =
    lineBreaks > 0
      ? contentStartX
      : caretX;

  const spaces =
    Math.max(
      0,
      Math.round(
        (targetX - horizontalStart) / safeSpaceWidth
      )
    );

  return {
    lineBreaks,
    spaces
  };

}



function getNextMaterialTextSizeClass(
  currentClass,
  targetClass
) {

  return currentClass === targetClass
    ? "material-text-size-normal"
    : targetClass;

}


function getMaterialAutoLinkUrl(
  value
) {

  const raw =
    String(value || "").trim();

  if (!raw) {
    return null;
  }

  const normalized =
    /^www\./i.test(raw)
      ? "https://" + raw
      : raw;

  try {

    const parsed =
      new URL(normalized);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    return parsed.href;

  } catch (error) {

    return null;

  }

}


function createMaterialAutoLinkAnchor(
  label,
  url
) {

  const safeUrl =
    getMaterialAutoLinkUrl(url);

  if (!safeUrl) {
    return null;
  }

  const anchor =
    document.createElement("a");

  anchor.href =
    safeUrl;

  anchor.target =
    "_blank";

  anchor.rel =
    "noopener noreferrer";

  anchor.textContent =
    label;

  return anchor;

}


function createMaterialAutoLinkFragment(
  text
) {

  const value =
    String(text || "");

  const fragment =
    document.createDocumentFragment();

  const pattern =
    /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

  let lastIndex =
    0;

  for (
    const match of
    value.matchAll(pattern)
  ) {

    const rawMatch =
      match[0];

    let candidate =
      rawMatch;

    let trailing =
      "";

    while (
      /[.,!?;:)\]}]+$/.test(
        candidate
      )
    ) {

      trailing =
        candidate.slice(-1) +
        trailing;

      candidate =
        candidate.slice(0, -1);

    }

    const safeUrl =
      getMaterialAutoLinkUrl(
        candidate
      );

    if (!safeUrl) {
      continue;
    }

    fragment.appendChild(
      document.createTextNode(
        value.slice(
          lastIndex,
          match.index
        )
      )
    );

    const anchor =
      createMaterialAutoLinkAnchor(
        candidate,
        safeUrl
      );

    fragment.appendChild(
      anchor
    );

    if (trailing) {
      fragment.appendChild(
        document.createTextNode(
          trailing
        )
      );
    }

    lastIndex =
      match.index +
      rawMatch.length;

  }

  fragment.appendChild(
    document.createTextNode(
      value.slice(lastIndex)
    )
  );

  return fragment;

}


function isMaterialRichTextContent(
  content
) {

  return String(
    content || ""
  ).startsWith(
    MATERIAL_RICH_TEXT_PREFIX
  );

}


function getMaterialRichTextHtml(
  content
) {

  if (
    !isMaterialRichTextContent(
      content
    )
  ) {
    return null;
  }

  return String(
    content
  ).slice(
    MATERIAL_RICH_TEXT_PREFIX.length
  );

}


function escapeMaterialHtmlText(
  value
) {

  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

}


function getMaterialRichTextSizeClass(
  element
) {

  if (!element) {
    return null;
  }

  if (
    element.tagName === "SPAN" &&
    element.classList.contains(
      "material-text-size-normal"
    )
  ) {
    return "material-text-size-normal";
  }

  if (
    element.tagName === "SPAN" &&
    element.classList.contains(
      "material-text-size-1"
    )
  ) {
    return "material-text-size-1";
  }

  if (
    element.tagName === "SPAN" &&
    element.classList.contains(
      "material-text-size-2"
    )
  ) {
    return "material-text-size-2";
  }

  if (
    element.tagName === "FONT"
  ) {

    const size =
      element.getAttribute(
        "size"
      );

    if (size === "3") {
      return "material-text-size-normal";
    }

    if (size === "5") {
      return "material-text-size-1";
    }

    if (size === "7") {
      return "material-text-size-2";
    }

  }

  return null;

}


function serializeMaterialAutoLinkedText(
  value
) {

  const text =
    String(value || "");

  const pattern =
    /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

  let html =
    "";

  let lastIndex =
    0;

  for (
    const match of
    text.matchAll(pattern)
  ) {

    const rawMatch =
      match[0];

    let candidate =
      rawMatch;

    let trailing =
      "";

    while (
      /[.,!?;:)\]}]+$/.test(
        candidate
      )
    ) {

      trailing =
        candidate.slice(-1) +
        trailing;

      candidate =
        candidate.slice(0, -1);

    }

    const safeUrl =
      getMaterialAutoLinkUrl(
        candidate
      );

    if (!safeUrl) {
      continue;
    }

    html +=
      escapeMaterialHtmlText(
        text.slice(
          lastIndex,
          match.index
        )
      );

    html +=
      '<a href="' +
      escapeMaterialHtmlText(safeUrl) +
      '" target="_blank" rel="noopener noreferrer">' +
      escapeMaterialHtmlText(candidate) +
      "</a>";

    html +=
      escapeMaterialHtmlText(
        trailing
      );

    lastIndex =
      match.index +
      rawMatch.length;

  }

  html +=
    escapeMaterialHtmlText(
      text.slice(lastIndex)
    );

  return html;

}


function renderMaterialAutoLinkedTextHtml(
  value
) {

  return serializeMaterialAutoLinkedText(
    value
  ).replaceAll(
    "\n",
    "<br>"
  );

}


function renderMaterialRichTextTextNode(
  value,
  insideAnchor = false
) {
  return renderMaterialNotationTextHtml(
    String(value || ""),
    insideAnchor
  );
}


function serializeMaterialRichTextNode(
  node
) {

  if (
    node.nodeType ===
    Node.TEXT_NODE
  ) {
    if (
      node.parentElement?.closest("a")
    ) {
      return escapeMaterialHtmlText(
        node.nodeValue || ""
      );
    }

    return serializeMaterialAutoLinkedText(
      node.nodeValue || ""
    );
  }

  if (
    node.nodeType !==
    Node.ELEMENT_NODE
  ) {
    return "";
  }

  if (node.classList?.contains("material-notation-symbol")) {
    const notation = getMaterialNotationInfoFromNode(node);
    return notation
      ? getMaterialNotationHtml(notation.notationKey, notation.dotted)
      : "";
  }

  if (node.classList?.contains("material-audio-marker")) {
    const markerSeconds = Number(node.getAttribute("data-audio-marker-seconds"));
    if (Number.isSafeInteger(markerSeconds) && markerSeconds >= 0 && markerSeconds <= 86400) {
      const label = formatMaterialAudioMarkerLabel(markerSeconds);
      return '<span class="material-audio-marker" data-audio-marker-seconds="' +
        markerSeconds + '">' + escapeMaterialHtmlText(label) + "</span>";
    }
    return escapeMaterialHtmlText(node.textContent || "");
  }

  if (
    node.classList?.contains(
      "material-inline-attachment"
    )
  ) {
    return "";
  }

  if (
    node.tagName === "BR"
  ) {
    return "\n";
  }

  const children =
    Array.from(
      node.childNodes || []
    )
      .map(
        serializeMaterialRichTextNode
      )
      .join("");

  if (
    node.tagName === "A"
  ) {

    const safeUrl =
      getMaterialAutoLinkUrl(
        node.getAttribute("href")
      );

    if (!safeUrl) {
      return children;
    }

    return (
      '<a href="' +
      escapeMaterialHtmlText(safeUrl) +
      '" target="_blank" rel="noopener noreferrer">' +
      children +
      "</a>"
    );

  }

  if (
    node.tagName === "I" ||
    node.tagName === "EM"
  ) {
    return (
      "<em>" +
      children +
      "</em>"
    );
  }

  if (
    node.tagName === "B" ||
    node.tagName === "STRONG"
  ) {
    return (
      "<strong>" +
      children +
      "</strong>"
    );
  }

  const sizeClass =
    getMaterialRichTextSizeClass(
      node
    );

  if (sizeClass) {
    return (
      '<span class="' +
      sizeClass +
      '">' +
      children +
      "</span>"
    );
  }

  return children;

}


function serializeMaterialRichTextChildren(
  nodes
) {

  return Array.from(
    nodes || []
  )
    .map(
      serializeMaterialRichTextNode
    )
    .join("");

}


function materialRichTextHasMarkup(
  html
) {

  return (
    /<(?:strong|em|a)\b|<span\b(?=[^>]*\bclass="[^"]*\b(?:material-text-size-(?:normal|[12])|material-audio-marker|material-notation-symbol)\b[^"]*")/i.test(
      String(html || "")
    )
  );

}


function makeMaterialStoredText(
  html
) {

  const value =
    String(html || "");

  if (
    !materialRichTextHasMarkup(
      value
    )
  ) {
    const template =
      document.createElement(
        "template"
      );

    template.innerHTML =
      value;

    return (
      template.content.textContent ||
      ""
    );
  }

  return (
    MATERIAL_RICH_TEXT_PREFIX +
    value
  );

}


function collectMaterialRichTextPlainText(
  content
) {

  const value =
    String(content || "");

  const html =
    getMaterialRichTextHtml(
      value
    );

  if (html === null) {
    return value;
  }

  const template =
    document.createElement(
      "template"
    );

  template.innerHTML =
    html;

  return (
    template.content.textContent ||
    ""
  );

}


function appendSanitizedMaterialNode(
  target,
  node,
  insideAnchor = false
) {

  if (
    node.nodeType ===
    Node.TEXT_NODE
  ) {
    appendMaterialRichTextTextWithNotation(
      target,
      node.nodeValue || "",
      insideAnchor
    );
    return;
  }

  if (
    node.nodeType !==
    Node.ELEMENT_NODE
  ) {
    return;
  }

  if (node.classList?.contains("material-notation-symbol")) {
    const notation = getMaterialNotationInfoFromNode(node);
    const safeNotation = notation
      ? createMaterialNotationElement(notation.notationKey, notation.dotted)
      : null;
    if (safeNotation) target.appendChild(safeNotation);
    return;
  }

  if (node.classList?.contains("material-audio-marker")) {
    const markerSeconds = Number(node.getAttribute("data-audio-marker-seconds"));
    if (!Number.isSafeInteger(markerSeconds) || markerSeconds < 0 || markerSeconds > 86400) {
      target.appendChild(document.createTextNode(node.textContent || ""));
      return;
    }

    const safeMarker = document.createElement("span");
    safeMarker.className = "material-audio-marker";
    safeMarker.dataset.audioMarkerSeconds = String(markerSeconds);
    safeMarker.setAttribute("contenteditable", "false");
    safeMarker.setAttribute("role", "button");
    safeMarker.setAttribute("tabindex", "0");
    safeMarker.textContent = formatMaterialAudioMarkerLabel(markerSeconds);
    target.appendChild(safeMarker);
    return;
  }

  if (
    node.classList?.contains(
      "material-inline-attachment"
    )
  ) {
    return;
  }

  if (
    node.tagName === "BR"
  ) {

    target.appendChild(
      document.createElement(
        "br"
      )
    );

    return;

  }

  let safeNode =
    null;

  if (
    node.tagName === "A"
  ) {

    const safeUrl =
      getMaterialAutoLinkUrl(
        node.getAttribute("href")
      );

    if (!safeUrl) {
      Array.from(
        node.childNodes || []
      ).forEach(
        child =>
          appendSanitizedMaterialNode(
            target,
            child,
            true
          )
      );

      return;
    }

    safeNode =
      document.createElement(
        "a"
      );

    safeNode.href =
      safeUrl;

    safeNode.target =
      "_blank";

    safeNode.rel =
      "noopener noreferrer";

  } else if (
    node.tagName === "I" ||
    node.tagName === "EM"
  ) {

    safeNode =
      document.createElement(
        "em"
      );

  } else if (
    node.tagName === "B" ||
    node.tagName === "STRONG"
  ) {

    safeNode =
      document.createElement(
        "strong"
      );

  } else {

    const sizeClass =
      getMaterialRichTextSizeClass(
        node
      );

    if (sizeClass) {

      safeNode =
        document.createElement(
          "span"
        );

      safeNode.className =
        sizeClass;

    }

  }

  if (!safeNode) {

    Array.from(
      node.childNodes || []
    ).forEach(
      child =>
        appendSanitizedMaterialNode(
          target,
          child,
          insideAnchor
        )
    );

    return;

  }

  Array.from(
    node.childNodes || []
  ).forEach(
    child =>
      appendSanitizedMaterialNode(
        safeNode,
        child,
        node.tagName === "A" || insideAnchor
      )
  );

  target.appendChild(
    safeNode
  );

}


function createMaterialRichTextFragment(
  content
) {

  let html =
    getMaterialRichTextHtml(
      content
    );

  if (html === null) {
    const legacyPattern = new RegExp(
      MATERIAL_LEGACY_NOTATION_PATTERN.source,
      "u"
    );
    if (!legacyPattern.test(String(content || ""))) {
      return null;
    }
    html = renderMaterialNotationTextHtml(content);
  }

  const template =
    document.createElement(
      "template"
    );

  template.innerHTML =
    html;

  const fragment =
    document.createDocumentFragment();

  Array.from(
    template.content.childNodes
  ).forEach(
    node =>
      appendSanitizedMaterialNode(
        fragment,
        node
      )
  );

  return fragment;

}

/*
 * Paste rich clipboard HTML through the same allowlist used by stored
 * Materiales content. We keep emphasis, supported text sizes, links, notation
 * SVGs and audio markers, but never import arbitrary styles/scripts/embeds.
 */
function createMaterialClipboardFragment(html, plainText = "") {
  const fallbackText = String(plainText || "");
  const rawHtml = String(html || "");

  if (!rawHtml.trim()) {
    return createMaterialAutoLinkFragment(fallbackText);
  }

  const template = document.createElement("template");
  template.innerHTML = rawHtml;
  const fragment = document.createDocumentFragment();

  function appendClipboardChildren(source, target) {
    const nodes = Array.from(source.childNodes || []);
    let previousWasBlock = false;

    nodes.forEach((node, index) => {
      const isBlock = node.nodeType === Node.ELEMENT_NODE &&
        ["ADDRESS", "ARTICLE", "BLOCKQUOTE", "BODY", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL"].includes(node.tagName);

      if (index > 0 && (previousWasBlock || isBlock)) {
        target.appendChild(document.createElement("br"));
      }

      if (isBlock) {
        const children = Array.from(node.childNodes || []);
        const isEmptyLine = children.length === 1 &&
          children[0].nodeType === Node.ELEMENT_NODE &&
          children[0].tagName === "BR";

        if (!isEmptyLine) {
          appendClipboardChildren(node, target);
        }

        previousWasBlock = true;
        return;
      }

      // Clipboard HTML from a selected audio chip may contain its player
      // controls. Do not create a cross-material attachment reference; preserve
      // the visible track name instead of importing unsafe or invalid markup.
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (["SCRIPT", "STYLE", "META", "LINK", "IFRAME", "OBJECT", "EMBED", "HEAD"].includes(node.tagName)) {
          previousWasBlock = false;
          return;
        }

        if (node.classList?.contains("material-inline-audio")) {
          const name = node.querySelector?.(".material-inline-audio-name")?.textContent ||
            node.querySelector?.(".material-inline-audio-label")?.textContent ||
            "";
          if (name) target.appendChild(document.createTextNode(name));
          previousWasBlock = false;
          return;
        }
      }

      appendSanitizedMaterialNode(target, node);
      previousWasBlock = false;
    });
  }

  appendClipboardChildren(template.content, fragment);

  if (!fragment.childNodes.length && fallbackText) {
    return createMaterialAutoLinkFragment(fallbackText);
  }

  return fragment;
}


function renderMaterialRichTextHtml(
  content
) {

  let html =
    getMaterialRichTextHtml(
      content
    );

  if (html === null) {
    const legacyPattern = new RegExp(
      MATERIAL_LEGACY_NOTATION_PATTERN.source,
      "u"
    );
    if (!legacyPattern.test(String(content || ""))) {
      return null;
    }
    html = renderMaterialNotationTextHtml(content);
  }

  const template =
    document.createElement(
      "template"
    );

  template.innerHTML =
    html;

  function renderNode(
    node,
    insideAnchor = false
  ) {

    if (
      node.nodeType ===
      Node.TEXT_NODE
    ) {
      return renderMaterialRichTextTextNode(
        node.nodeValue || "",
        insideAnchor
      );
    }

    if (
      node.nodeType !==
      Node.ELEMENT_NODE
    ) {
      return "";
    }

    if (
      node.tagName === "BR"
    ) {
      return "<br>";
    }

    if (node.classList?.contains("material-notation-symbol")) {
      const notation = getMaterialNotationInfoFromNode(node);
      return notation
        ? getMaterialNotationHtml(notation.notationKey, notation.dotted)
        : "";
    }

    if (node.classList?.contains("material-audio-marker")) {
      const markerSeconds = Number(node.getAttribute("data-audio-marker-seconds"));
      if (Number.isSafeInteger(markerSeconds) && markerSeconds >= 0 && markerSeconds <= 86400) {
        const label = formatMaterialAudioMarkerLabel(markerSeconds);
        return '<button type="button" class="material-audio-marker" data-material-audio-marker ' +
          'data-material-audio-marker-seconds="' + markerSeconds + '" aria-pressed="false" ' +
          'aria-label="Ir a ' + label + '">' +
          label + "</button>";
      }
      return Array.from(node.childNodes || []).map(child => renderNode(child, insideAnchor)).join("");
    }

    if (
      node.tagName === "A"
    ) {

      const safeUrl =
        getMaterialAutoLinkUrl(
          node.getAttribute("href")
        );

      if (!safeUrl) {
        return Array.from(
          node.childNodes || []
        )
          .map(
            child => renderNode(child, true)
          )
          .join("");
      }

      const children =
        Array.from(
          node.childNodes || []
        )
          .map(
            child => renderNode(child, true)
          )
          .join("");

      return (
        '<a href="' +
        escapeMaterialHtmlText(safeUrl) +
        '" target="_blank" rel="noopener noreferrer">' +
        children +
        "</a>"
      );

    }

    const children =
      Array.from(
        node.childNodes || []
      )
        .map(
          child => renderNode(child, insideAnchor)
        )
        .join("");

    if (
      node.tagName === "I" ||
      node.tagName === "EM"
    ) {
      return (
        "<em>" +
        children +
        "</em>"
      );
    }

    if (
      node.tagName === "B" ||
      node.tagName === "STRONG"
    ) {
      return (
        "<strong>" +
        children +
        "</strong>"
      );
    }

    const sizeClass =
      getMaterialRichTextSizeClass(
        node
      );

    if (sizeClass) {
      return (
        '<span class="' +
        sizeClass +
        '">' +
        children +
        "</span>"
      );
    }

    return children;

  }

  return Array.from(
    template.content.childNodes
  )
    .map(
      renderNode
    )
    .join("");

}
