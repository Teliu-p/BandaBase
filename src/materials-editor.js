/* Editor y compositor de Materiales. */

let materialIndentRepeatTimer = null;
let materialIndentRepeatButton = null;
let materialIndentRepeatDirection = 0;
let materialIndentRepeatCount = 0;
let materialIndentPointerHandled = false;
let materialIndentPointerResetTimer = null;

/*
 * Doble clic: fija el punto de escritura en espacios vacíos.
 * El clic simple conserva el posicionamiento nativo.
 */
function getMaterialRangeCaretPoint(sourceRange, editor, targetY = null) {
  const range = sourceRange.cloneRange();
  range.collapse(true);
  const rect = range.getBoundingClientRect();
  if (rect?.height) return { x: rect.left, y: rect.top + rect.height / 2, height: rect.height };

  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue || "";
    const offset = range.startOffset;
    const charRect = index => {
      if (index < 0 || index >= value.length || value[index] === "\n") return null;
      const r = document.createRange();
      r.setStart(node, index);
      r.setEnd(node, index + 1);
      const box = r.getBoundingClientRect();
      return box?.height ? box : null;
    };
    let before = offset - 1;
    let after = offset;
    while (before >= 0 && value[before] === "\n") before--;
    while (after < value.length && value[after] === "\n") after++;
    const left = charRect(before);
    const right = charRect(after);
    if (left && right) {
      const y1 = left.top + left.height / 2;
      const y2 = right.top + right.height / 2;
      const height = Math.max(left.height, right.height);
      const style = getComputedStyle(editor);
      const x0 = editor.getBoundingClientRect().left + editor.clientLeft +
        (parseFloat(style.paddingLeft) || 0);
      if (y2 - y1 >= height * 1.5) return { x: x0, y: y1 + height, height };
      if (value[offset - 1] === "\n" && y2 > y1) return { x: right.left, y: y2, height: right.height };
      return { x: left.right, y: y1, height: left.height };
    }
    if (right) return { x: right.left, y: right.top + right.height / 2, height: right.height };
    if (left) return { x: left.right, y: left.top + left.height / 2, height: left.height };
  }

  const style = getComputedStyle(editor);
  const box = editor.getBoundingClientRect();
  const font = parseFloat(style.fontSize) || 16;
  return {
    x: box.left + editor.clientLeft + (parseFloat(style.paddingLeft) || 0),
    y: Number.isFinite(targetY) ? targetY : box.top + editor.clientTop +
      (parseFloat(style.paddingTop) || 0) + font * 0.75,
    height: font * 1.5
  };
}

function getMaterialSpaceWidth(range, editor) {
  const node = range.startContainer;
  const target = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement || editor;
  const style = getComputedStyle(target);
  const probe = document.createElement("span");
  Object.assign(probe.style, {
    position: "absolute", visibility: "hidden", whiteSpace: "pre",
    fontFamily: style.fontFamily, fontSize: style.fontSize,
    fontWeight: style.fontWeight, fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing
  });
  probe.textContent = "          ";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width / 10;
  probe.remove();
  return width || (parseFloat(style.fontSize) || 16) * 0.3;
}

function hasMaterialTextAtOrAfterPointOnLine(editor, targetX, targetY, lineHeight) {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue || "";
    for (let index = 0; index < value.length; index++) {
      if (value[index] === "\n" || value[index] === "\r") continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const box = range.getBoundingClientRect();
      if (!box?.height) continue;
      const center = box.top + box.height / 2;
      if (Math.abs(center - targetY) <= Math.max(box.height, lineHeight) * 0.55 &&
          box.right > targetX + 1) return true;
    }
  }
  return false;
}

function moveMaterialCaretAboveBlankLine(range, editor) {
  const node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue || "";
    let index = range.startOffset - 1;
    while (index >= 0 && /[ \t\u00a0]/.test(value[index])) index--;
    if (index >= 0 && value[index] === "\n") {
      range.setStart(node, index);
      range.collapse(true);
      return true;
    }
    if (range.startOffset > 0) return false;
  }

  let current = node;
  while (current && current !== editor) {
    if (!current.previousSibling) {
      current = current.parentNode;
      continue;
    }
    current = current.previousSibling;
    while (current.nodeType === Node.ELEMENT_NODE && current.lastChild &&
           !current.classList?.contains("material-inline-attachment")) current = current.lastChild;
    if (current.nodeType === Node.TEXT_NODE) {
      const value = current.nodeValue || "";
      let index = value.length - 1;
      while (index >= 0 && /[ \t\u00a0]/.test(value[index])) index--;
      if (index >= 0 && value[index] === "\n") {
        range.setStart(current, index);
        range.collapse(true);
        return true;
      }
      if (value.trim()) return false;
    } else if (current.nodeType === Node.ELEMENT_NODE) {
      if (current.tagName === "BR") {
        range.setStartBefore(current);
        range.collapse(true);
        return true;
      }
      if (current.classList?.contains("material-inline-attachment")) return false;
    }
  }
  return false;
}

function placeMaterialCaretAtDoubleClick(event) {
  const editor = document.getElementById("materialComposerEditor");
  if (!editor || !editor.contains(event.target) ||
      event.target.closest?.(".material-inline-attachment")) return;

  event.preventDefault();
  let range = null;
  if (typeof document.caretPositionFromPoint === "function") {
    const point = document.caretPositionFromPoint(event.clientX, event.clientY);
    if (point && editor.contains(point.offsetNode)) {
      range = document.createRange();
      range.setStart(point.offsetNode, point.offset);
      range.collapse(true);
    }
  }
  if (!range && typeof document.caretRangeFromPoint === "function") {
    const point = document.caretRangeFromPoint(event.clientX, event.clientY);
    if (point && editor.contains(point.startContainer) && editor.contains(point.endContainer)) {
      range = point.cloneRange();
      range.collapse(true);
    }
  }
  if (!range) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  editor.focus();
  const selection = window.getSelection();
  if (!selection) return;
  const style = getComputedStyle(editor);
  const bounds = editor.getBoundingClientRect();
  const font = parseFloat(style.fontSize) || 16;
  const lineHeight = parseFloat(style.lineHeight) || font * 1.5;
  let caret = getMaterialRangeCaretPoint(range, editor, event.clientY);

  // Si el navegador eligió el renglón de abajo, retroceder por el salto anterior.
  const linesAbove = Math.max(0, Math.round((caret.y - event.clientY) / lineHeight));
  for (let i = 0; i < linesAbove; i++) {
    if (!moveMaterialCaretAboveBlankLine(range, editor)) break;
    caret = getMaterialRangeCaretPoint(range, editor, event.clientY);
    if (Math.abs(event.clientY - caret.y) < lineHeight * 0.45) break;
  }

  const spaceWidth = getMaterialSpaceWidth(range, editor);
  const startX = bounds.left + editor.clientLeft + (parseFloat(style.paddingLeft) || 0);
  const padding = calculateMaterialForcedCaretPadding(
    caret.x, caret.y, event.clientX, event.clientY,
    lineHeight, spaceWidth, startX
  );
  let prefix = "\n".repeat(padding.lineBreaks);
  if (padding.lineBreaks > 0) {
    prefix += " ".repeat(padding.spaces);
  } else if (event.clientX > caret.x &&
             !hasMaterialTextAtOrAfterPointOnLine(editor, event.clientX, event.clientY, lineHeight)) {
    prefix += " ".repeat(padding.spaces);
  }
  if (prefix) {
    const filler = document.createTextNode(prefix);
    range.insertNode(filler);
    range.setStart(filler, filler.length);
    range.collapse(true);
  }
  selection.removeAllRanges();
  selection.addRange(range);
  materialSelectionRange = range.cloneRange();
  updateMaterialFormattingButtonStates();
}



function rememberMaterialSelection() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  const selection =
    window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const range =
    selection.getRangeAt(0);

  if (
    editor.contains(
      range.startContainer
    ) &&
    editor.contains(
      range.endContainer
    )
  ) {

    materialSelectionRange =
      range.cloneRange();

    updateMaterialFormattingButtonStates();

  }

}


function restoreMaterialSelection(
  rangeToRestore = materialSelectionRange
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (
    !editor ||
    !rangeToRestore ||
    !editor.contains(rangeToRestore.startContainer) ||
    !editor.contains(rangeToRestore.endContainer)
  ) {
    return false;
  }

  const selection =
    window.getSelection();

  if (!selection) {
    return false;
  }

  try {

    selection.removeAllRanges();

    selection.addRange(
      rangeToRestore
    );

    materialSelectionRange =
      rangeToRestore.cloneRange();

    updateMaterialFormattingButtonStates();

    return true;

  } catch (error) {

    return false;

  }

}


function createMaterialInlineAttachment(
  attachment,
  pendingKey = null
) {

  const wrapper =
    document.createElement("span");

  wrapper.className =
    "material-inline-attachment";

  wrapper.contentEditable =
    "false";

  if (attachment?.id) {

    wrapper.dataset.attachmentId =
      attachment.id;

  }

  if (pendingKey) {

    wrapper.dataset.pendingKey =
      pendingKey;

  }

  const icon =
    getMaterialAttachmentIcon(
      attachment
    );

  const name =
    attachment?.name ||
    "Archivo";

  const label =
    document.createElement("span");

  label.className =
    "material-inline-attachment-label";

  label.textContent =
    icon +
    " " +
    name +
    " ";

  wrapper.appendChild(
    label
  );

  const removeButton =
    document.createElement(
      "button"
    );

  removeButton.type =
    "button";

  removeButton.className =
    "inline-remove";

  removeButton.textContent =
    "×";

  removeButton.title =
    "Quitar";

  removeButton.setAttribute(
    "aria-label",
    "Quitar " + name
  );

  removeButton.addEventListener(
    "mousedown",
    function(event) {

      event.preventDefault();

    }
  );

  removeButton.addEventListener(
    "click",
    function(event) {

      event.preventDefault();

      wrapper.remove();

    }
  );

  wrapper.appendChild(
    removeButton
  );

  return wrapper;

}



function insertMaterialNotation(symbol, button = null) {
  if (!focusMaterialEditorForFormatting()) {
    return false;
  }

  insertMaterialNodeAtSelection(
    document.createTextNode(symbol)
  );

  if (button) {
    showMaterialFormatActionFeedback(button);
  }

  const editor = document.getElementById("materialComposerEditor");
  editor?.focus();
  rememberMaterialSelection();
  return true;
}


function insertMaterialAudioMarker(button = null) {
  const input = window.prompt(
    "Tiempo del marcador (mm:ss, hh:mm:ss o segundos):",
    "0:30"
  );
  if (input === null) return false;

  const seconds = parseMaterialAudioMarkerTime(input);
  if (seconds === null) {
    showNotice("Tiempo inválido. Usá mm:ss, hh:mm:ss o un número de segundos (máximo 24 horas).", "error");
    return false;
  }

  const marker = document.createElement("span");
  marker.className = "material-audio-marker";
  marker.dataset.audioMarkerSeconds = String(seconds);
  marker.setAttribute("contenteditable", "false");
  marker.setAttribute("role", "button");
  marker.setAttribute("tabindex", "0");
  marker.textContent = formatMaterialAudioMarkerLabel(seconds);
  marker.title = "Marcador de audio: " + marker.textContent;

  insertMaterialNodeAtSelection(marker);

  if (button) showMaterialFormatActionFeedback(button);
  document.getElementById("materialComposerEditor")?.focus();
  rememberMaterialSelection();
  return true;
}


function findLastMaterialTextCharacter(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue || "";
    return value.length ? { node, offset: value.length - 1 } : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (node.tagName === "BR" || node.classList?.contains("material-inline-attachment")) {
    return { blocked: true };
  }
  for (let index = node.childNodes.length - 1; index >= 0; index--) {
    const found = findLastMaterialTextCharacter(node.childNodes[index]);
    if (found) return found;
  }
  return null;
}


function findFirstMaterialTextCharacter(node) {
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    const value = node.nodeValue || "";
    return value.length ? { node, offset: 0 } : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  if (node.tagName === "BR" || node.classList?.contains("material-inline-attachment")) {
    return { blocked: true };
  }
  for (let index = 0; index < node.childNodes.length; index++) {
    const found = findFirstMaterialTextCharacter(node.childNodes[index]);
    if (found) return found;
  }
  return null;
}


function findNextMaterialTextCharacterAfter(node, editor) {
  let cursor = node;
  while (cursor && cursor !== editor) {
    let sibling = cursor.nextSibling;
    while (sibling) {
      const found = findFirstMaterialTextCharacter(sibling);
      if (found) return found.blocked ? null : found;
      sibling = sibling.nextSibling;
    }
    cursor = cursor.parentNode;
  }
  return null;
}


function getSelectedMaterialLineBreaks(range, editor) {
  const breaks = [];
  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
  );

  let node = walker.nextNode();
  while (node) {
    if (
      node.nodeType === Node.TEXT_NODE &&
      !node.parentElement?.closest(".material-inline-attachment")
    ) {
      const value = node.nodeValue || "";
      for (let offset = 0; offset < value.length; offset++) {
        if (value[offset] === "\n" && range.comparePoint(node, offset + 1) === 0) {
          breaks.push({ kind: "text", node, offset: offset + 1 });
        }
      }
    } else if (
      node.nodeType === Node.ELEMENT_NODE &&
      node.tagName === "BR" &&
      range.intersectsNode(node)
    ) {
      breaks.push({ kind: "br", node });
    }
    node = walker.nextNode();
  }

  return breaks;
}


function findPreviousMaterialTextCharacter(range, editor) {
  const container = range.startContainer;
  const offset = range.startOffset;
  if (container.nodeType === Node.TEXT_NODE && offset > 0) {
    return { node: container, offset: offset - 1 };
  }

  let cursor = container;
  if (container.nodeType === Node.ELEMENT_NODE) {
    for (let index = Math.min(offset, container.childNodes.length) - 1; index >= 0; index--) {
      const found = findLastMaterialTextCharacter(container.childNodes[index]);
      if (found) return found.blocked ? null : found;
    }
  }

  while (cursor && cursor !== editor) {
    let sibling = cursor.previousSibling;
    while (sibling) {
      const found = findLastMaterialTextCharacter(sibling);
      if (found) return found.blocked ? null : found;
      sibling = sibling.previousSibling;
    }
    cursor = cursor.parentNode;
  }
  return null;
}


function changeMaterialIndentSpaces(direction) {
  const editor = document.getElementById("materialComposerEditor");
  const selection = window.getSelection();
  if (!editor || !selection) return false;

  let range = null;
  if (
    selection.rangeCount &&
    editor.contains(selection.getRangeAt(0).startContainer) &&
    editor.contains(selection.getRangeAt(0).endContainer)
  ) {
    range = selection.getRangeAt(0).cloneRange();
  } else if (
    materialSelectionRange &&
    editor.contains(materialSelectionRange.startContainer) &&
    editor.contains(materialSelectionRange.endContainer)
  ) {
    range = materialSelectionRange.cloneRange();
  }
  if (!range) return false;

  const isCollapsed = range.collapsed;
  const lineBreaks = isCollapsed
    ? []
    : getSelectedMaterialLineBreaks(range, editor);

  if (direction > 0) {
    // If a selection spans several explicit lines, prefix each selected line
    // with one real, persistent space. Insert from the end backward so offsets
    // in earlier text nodes remain valid.
    for (let index = lineBreaks.length - 1; index >= 0; index--) {
      const lineBreak = lineBreaks[index];
      const insertionRange = document.createRange();
      if (lineBreak.kind === "text") {
        insertionRange.setStart(lineBreak.node, lineBreak.offset);
      } else {
        insertionRange.setStartAfter(lineBreak.node);
      }
      insertionRange.collapse(true);
      insertionRange.insertNode(document.createTextNode("\u00a0"));
    }

    const insertionRange = range.cloneRange();
    insertionRange.collapse(true);
    const space = document.createTextNode("\u00a0");
    insertionRange.insertNode(space);
    range.setStartAfter(space);
    if (isCollapsed) range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    materialSelectionRange = range.cloneRange();
    updateMaterialFormattingButtonStates();
    return true;
  }

  // Remove one character from each selected line, beginning with the last
  // line so DOM offsets stay stable. Only actual leading spaces are removed.
  for (let index = lineBreaks.length - 1; index >= 0; index--) {
    const lineBreak = lineBreaks[index];
    let character = null;
    if (lineBreak.kind === "text") {
      const value = lineBreak.node.nodeValue || "";
      if (value[lineBreak.offset] === " " || value[lineBreak.offset] === "\u00a0") {
        character = { node: lineBreak.node, offset: lineBreak.offset };
      }
    } else {
      const found = findNextMaterialTextCharacterAfter(lineBreak.node, editor);
      if (found) {
        const value = found.node.nodeValue || "";
        if (value[found.offset] === " " || value[found.offset] === "\u00a0") {
          character = found;
        }
      }
    }

    if (character) {
      const deletionRange = document.createRange();
      deletionRange.setStart(character.node, character.offset);
      deletionRange.setEnd(character.node, character.offset + 1);
      deletionRange.deleteContents();
    }
  }

  const previous = findPreviousMaterialTextCharacter(range, editor);
  if (previous) {
    const value = previous.node.nodeValue || "";
    const character = value[previous.offset];
    if (character === " " || character === "\u00a0") {
      const deletionRange = document.createRange();
      deletionRange.setStart(previous.node, previous.offset);
      deletionRange.setEnd(previous.node, previous.offset + 1);
      deletionRange.deleteContents();
    } else if (isCollapsed) {
      return false;
    } else {
      const current = range.startContainer;
      if (current.nodeType === Node.TEXT_NODE) {
        const valueAtStart = current.nodeValue || "";
        if (valueAtStart[range.startOffset] === " " || valueAtStart[range.startOffset] === "\u00a0") {
          const deletionRange = document.createRange();
          deletionRange.setStart(current, range.startOffset);
          deletionRange.setEnd(current, range.startOffset + 1);
          deletionRange.deleteContents();
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
  } else {
    if (!isCollapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
      const current = range.startContainer;
      const valueAtStart = current.nodeValue || "";
      if (valueAtStart[range.startOffset] === " " || valueAtStart[range.startOffset] === "\u00a0") {
        const deletionRange = document.createRange();
        deletionRange.setStart(current, range.startOffset);
        deletionRange.setEnd(current, range.startOffset + 1);
        deletionRange.deleteContents();
      } else {
        return false;
      }
    } else {
      return false;
    }
  }

  selection.removeAllRanges();
  selection.addRange(range);
  materialSelectionRange = range.cloneRange();
  updateMaterialFormattingButtonStates();
  return true;
}


function stopMaterialIndentRepeat() {
  if (materialIndentRepeatTimer !== null) {
    window.clearTimeout(materialIndentRepeatTimer);
  }
  materialIndentRepeatTimer = null;
  materialIndentRepeatButton = null;
  materialIndentRepeatDirection = 0;
  materialIndentRepeatCount = 0;
}


function scheduleMaterialIndentRepeat() {
  if (!materialIndentRepeatButton) return;
  const delay =
    materialIndentRepeatCount === 0
      ? 320
      : getMaterialIndentRepeatDelay(materialIndentRepeatCount);
  materialIndentRepeatTimer = window.setTimeout(() => {
    if (!materialIndentRepeatButton) return;
    changeMaterialIndentSpaces(materialIndentRepeatDirection);
    materialIndentRepeatCount += 1;
    scheduleMaterialIndentRepeat();
  }, delay);
}


function startMaterialIndentRepeat(event, button, direction) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  stopMaterialIndentRepeat();
  rememberMaterialSelection();
  materialIndentPointerHandled = true;
  materialIndentRepeatButton = button;
  materialIndentRepeatDirection = direction;
  materialIndentRepeatCount = 0;
  changeMaterialIndentSpaces(direction);
  scheduleMaterialIndentRepeat();
}


function bindMaterialIndentRepeatButton(button, direction) {
  if (!button) return;
  button.addEventListener("pointerdown", event => {
    startMaterialIndentRepeat(event, button, direction);
  });
  button.addEventListener("click", () => {
    if (materialIndentPointerHandled) {
      materialIndentPointerHandled = false;
      return;
    }
    changeMaterialIndentSpaces(direction);
  });
}


function toggleMaterialIndent(forceIndent = true) {
  return changeMaterialIndentSpaces(forceIndent === false ? -1 : 1);
}


function executeMaterialNumericShortcut(action) {
  const editor = document.getElementById("materialComposerEditor");
  if (!editor) return false;

  if (action === "indentMore") {
    return toggleMaterialIndent(true);
  }

  const buttonByAction = {
    bold: "materialBoldBtn",
    italic: "materialItalicBtn",
    parentheses: "materialParenthesesBtn",
    brackets: "materialBracketsBtn",
    size1: "materialSize1Btn",
    size2: "materialSize2Btn",
    noteQuarter: "materialNoteQuarterBtn",
    noteEighth: "materialNoteEighthBtn",
    noteSixteenth: "materialNoteSixteenthBtn"
  };

  const button = document.getElementById(buttonByAction[action]);
  if (!button) return false;
  button.click();
  return true;
}


function insertMaterialNodeAtSelection(
  node
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return;
  }

  const savedRange =
    materialSelectionRange?.cloneRange() || null;

  editor.focus();

  const hasSelection =
    restoreMaterialSelection(savedRange);

  let range =
    hasSelection
      ? materialSelectionRange
      : null;

  if (
    !hasSelection
  ) {

    range =
      document.createRange();

    range.selectNodeContents(
      editor
    );

    range.collapse(
      false
    );

  }

  range.deleteContents();

  const spacerBefore =
    document.createTextNode(
      " "
    );

  const spacerAfter =
    document.createTextNode(
      " "
    );

  range.insertNode(
    spacerAfter
  );

  range.insertNode(
    node
  );

  range.insertNode(
    spacerBefore
  );

  range.setStartAfter(
    spacerAfter
  );

  range.collapse(
    true
  );

  const selection =
    window.getSelection();

  selection.removeAllRanges();
  selection.addRange(
    range
  );

  materialSelectionRange =
    range.cloneRange();

}


function renderMaterialComposer(
  blocks
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return;
  }

  editor.innerHTML =
    "";

  const safeBlocks =
    blocks?.length
      ? blocks
      : [
          {
            block_type:
              "text",
            content:
              ""
          }
        ];

  safeBlocks.forEach(
    block => {

      if (
        block.block_type ===
        "text"
      ) {

        const richFragment =
          createMaterialRichTextFragment(
            block.content || ""
          );

        if (richFragment) {

          editor.appendChild(
            richFragment
          );

        } else {

          editor.appendChild(
            createMaterialAutoLinkFragment(
              block.content || ""
            )
          );

        }

        return;

      }

      if (
        block.block_type ===
        "attachment"
      ) {

        const attachment =
          block.attachment ||
          block.pending;

        if (!attachment) {
          return;
        }

        const inline =
          createMaterialInlineAttachment(
            attachment,
            block.pendingKey || null
          );

        editor.appendChild(
          inline
        );

      }

    }
  );

  if (
    !editor.childNodes.length
  ) {

    editor.appendChild(
      document.createTextNode("")
    );

  }

}


function collectMaterialComposerBlocks() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return [];
  }

  const blocks = [];
  let textNodes = [];

  function flushText() {

    if (!textNodes.length) {
      return;
    }

    const html =
      serializeMaterialRichTextChildren(
        textNodes
      );

    blocks.push({
      block_type:
        "text",
      content:
        makeMaterialStoredText(
          html
        )
    });

    textNodes =
      [];

  }

  function appendAttachmentBlock(
    element
  ) {

    blocks.push({
      block_type:
        "attachment",
      attachment_id:
        element.dataset.attachmentId ||
        null,
      pendingKey:
        element.dataset.pendingKey ||
        null
    });

  }

  Array.from(
    editor.childNodes
  ).forEach(
    node => {

      splitMaterialComposerNodeByAttachments(
        node
      ).forEach(
        segment => {

          if (segment.attachment) {

            flushText();

            appendAttachmentBlock(
              segment.attachment
            );

            return;

          }

          if (segment.node) {

            textNodes.push(
              segment.node
            );

          }

        }
      );

    }
  );

  flushText();

  if (!blocks.length) {

    blocks.push({
      block_type:
        "text",
      content:
        ""
    });

  }

  return blocks;

}


function collectMaterialLegacyText(
  blocks
) {

  return blocks
    .filter(
      block =>
        block.block_type ===
        "text"
    )
    .map(
      block =>
        block.content || ""
    )
    .join("\n\n")
    .trim();

}

function openMaterialEditor(
  material = null
) {

  editingMaterialId =
    material?.id ||
    null;

  // Evitar que la vista expandida y el formulario de edición muestren
  // simultáneamente el mismo contenido como si fueran dos materiales.
  if (editingMaterialId) {

    openMaterialIds.delete(
      editingMaterialId
    );

    renderMaterials();

  }

  materialDraftInitialAttachmentIds =
    new Set(
      (
        material?.attachments ||
        []
      ).map(
        attachment =>
          attachment.id
      )
    );

  materialPendingAttachments = {};

  document.getElementById(
    "materialName"
  ).value =
    material?.name ||
    "";

  renderMaterialComposer(
    material?.blocks ||
    [
      {
        block_type:
          "text",
        content:
          material?.content ||
          ""
      }
    ]
  );

  rememberMaterialSelection();

  document.getElementById(
    "materialForm"
  ).classList.remove(
    "hidden"
  );

  document.getElementById(
    "showMaterialFormBtn"
  ).textContent =
    material
      ? "Editando material"
      : "+ Añadir material";

  document.getElementById(
    "materialName"
  ).focus();

}


function showMaterialForm() {

  openMaterialEditor();

}


function hideMaterialForm() {

  editingMaterialId =
    null;

  materialDraftInitialAttachmentIds =
    new Set();

  materialSelectionRange =
    null;

  materialPendingAttachments =
    {};

  const form =
    document.getElementById(
      "materialForm"
    );

  form.classList.add(
    "hidden"
  );

  form.reset();

  document.getElementById(
    "materialComposerEditor"
  ).innerHTML =
    "";

  document.getElementById(
    "showMaterialFormBtn"
  ).textContent =
    "+ Añadir material";

}


bindMaterialFormattingControls();


document
  .getElementById(
    "showMaterialFormBtn"
  )
  .addEventListener(
    "click",
    showMaterialForm
  );


document
  .getElementById(
    "cancelMaterialBtn"
  )
  .addEventListener(
    "click",
    hideMaterialForm
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "keydown",
    function(event) {

      const shortcutAction =
        getMaterialNumericShortcutAction(event);

      if (shortcutAction) {
        event.preventDefault();
        rememberMaterialSelection();
        executeMaterialNumericShortcut(shortcutAction);
        return;
      }

      if (
        event.key ===
        "Enter"
      ) {

        event.preventDefault();

        rememberMaterialSelection();

        const textNode =
          document.createTextNode(
            "\n"
          );

        insertMaterialNodeAtSelection(
          textNode
        );

        return;

      }

      if (
        event.key ===
        "Tab"
      ) {

        event.preventDefault();

        const textNode =
          document.createTextNode(
            "  "
          );

        insertMaterialNodeAtSelection(
          textNode
        );

      }

    }
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "keyup",
    rememberMaterialSelection
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "mouseup",
    rememberMaterialSelection
  );


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "focus",
    rememberMaterialSelection
  );

document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "dblclick",
    placeMaterialCaretAtDoubleClick
  );


function focusMaterialEditorForFormatting() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return false;
  }

  // El evento focus puede intentar guardar la selección actual
  // mientras el navegador mueve el foco desde el toolbar.
  // Conservamos una copia anterior y la restauramos después.
  const savedRange =
    materialSelectionRange?.cloneRange() || null;

  editor.focus();

  return restoreMaterialSelection(savedRange);

}


function executeMaterialTextCommand(
  command,
  value = null
) {

  if (
    !focusMaterialEditorForFormatting()
  ) {
    return;
  }

  try {

    document.execCommand(
      command,
      false,
      value
    );

  } catch (error) {

    console.error(
      error
    );

  }

  rememberMaterialSelection();

}


function getMaterialCurrentFontSizeCommandValue() {

  try {

    return String(
      document.queryCommandValue(
        "fontSize"
      ) || ""
    );

  } catch (error) {

    return "";

  }

}


function getMaterialTextSizeClassFromElement(
  element
) {

  if (!element) {
    return null;
  }

  if (
    element.classList?.contains(
      "material-text-size-normal"
    )
  ) {
    return "material-text-size-normal";
  }

  if (
    element.classList?.contains(
      "material-text-size-1"
    )
  ) {
    return "material-text-size-1";
  }

  if (
    element.classList?.contains(
      "material-text-size-2"
    )
  ) {
    return "material-text-size-2";
  }

  if (element.tagName === "FONT") {

    const size =
      element.getAttribute("size");

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


function getMaterialTextSizeElementForRange(
  range,
  editor,
  exactContentsOnly = false
) {

  if (!range || !editor) {
    return null;
  }

  const selectedText =
    range.toString();

  let element =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;

  while (
    element &&
    element !== editor
  ) {

    const sizeClass =
      getMaterialTextSizeClassFromElement(
        element
      );

    if (
      sizeClass &&
      element.contains(
        range.endContainer
      )
    ) {

      if (
        !exactContentsOnly ||
        selectedText === element.textContent
      ) {
        return element;
      }

    }

    element =
      element.parentElement;

  }

  return null;

}


function unwrapMaterialTextSizeElement(
  element
) {

  const parent =
    element?.parentNode;

  if (!parent) {
    return;
  }

  while (
    element.firstChild
  ) {

    parent.insertBefore(
      element.firstChild,
      element
    );

  }

  parent.removeChild(
    element
  );

}


function clearMaterialTextSizeDescendants(
  root
) {

  if (!root?.querySelectorAll) {
    return;
  }

  const sizeElements =
    Array.from(
      root.querySelectorAll(
        [
          "span.material-text-size-normal",
          "span.material-text-size-1",
          "span.material-text-size-2",
          'font[size="3"]',
          'font[size="5"]',
          'font[size="7"]'
        ].join(",")
      )
    ).reverse();

  sizeElements.forEach(
    unwrapMaterialTextSizeElement
  );

}


function convertMaterialTextSizeElementToSpan(
  element
) {

  if (
    !element ||
    element.tagName !== "FONT"
  ) {
    return element;
  }

  const span =
    document.createElement("span");

  while (
    element.firstChild
  ) {
    span.appendChild(
      element.firstChild
    );
  }

  element.replaceWith(
    span
  );

  return span;

}


function setMaterialFormattingButtonState(
  button,
  active
) {

  if (!button) {
    return;
  }

  const isActive =
    Boolean(active);

  button.classList.toggle(
    "is-active",
    isActive
  );

  button.setAttribute(
    "aria-pressed",
    String(isActive)
  );

}


function updateMaterialFormattingButtonStates() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  const selection =
    window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const range =
    selection.getRangeAt(0);

  if (
    !editor.contains(range.startContainer) ||
    !editor.contains(range.endContainer)
  ) {
    return;
  }

  function isCommandActive(command) {

    try {

      return document.queryCommandState(command);

    } catch (error) {

      return false;

    }

  }

  const sizeElement =
    getMaterialTextSizeElementForRange(
      range,
      editor
    );

  const sizeClass =
    getMaterialTextSizeClassFromElement(
      sizeElement
    );

  const fontSize =
    getMaterialCurrentFontSizeCommandValue();

  setMaterialFormattingButtonState(
    document.getElementById("materialBoldBtn"),
    isCommandActive("bold")
  );

  setMaterialFormattingButtonState(
    document.getElementById("materialItalicBtn"),
    isCommandActive("italic")
  );

  setMaterialFormattingButtonState(
    document.getElementById("materialSize1Btn"),
    sizeClass === "material-text-size-1" ||
      (!sizeClass && fontSize === "5")
  );

  setMaterialFormattingButtonState(
    document.getElementById("materialSize2Btn"),
    sizeClass === "material-text-size-2" ||
      (!sizeClass && fontSize === "7")
  );

}

function showMaterialFormatActionFeedback(button) {

  if (!button) {
    return;
  }

  const timer =
    Number(button.dataset.feedbackTimer || 0);

  if (timer) {
    window.clearTimeout(timer);
  }

  button.classList.add(
    "is-action-feedback"
  );

  button.dataset.feedbackTimer =
    String(window.setTimeout(
      function() {

        button.classList.remove(
          "is-action-feedback"
        );

        delete button.dataset.feedbackTimer;

      },
      650
    ));

}


function toggleMaterialTextSize(
  sizeValue
) {

  if (
    !focusMaterialEditorForFormatting()
  ) {
    return;
  }

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  const selection =
    window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const range =
    selection.getRangeAt(0);

  const targetClass =
    String(sizeValue) === "5"
      ? "material-text-size-1"
      : "material-text-size-2";

  // El cursor sin texto seleccionado sigue usando el modo de escritura
  // nativo del navegador. Para texto seleccionado usamos clases propias,
  // que sí reconocemos después de guardar y volver a abrir el material.
  if (range.collapsed) {

    const currentSizeElement =
      getMaterialTextSizeElementForRange(
        range,
        editor
      );

    const currentClass =
      getMaterialTextSizeClassFromElement(
        currentSizeElement
      );

    const currentSize =
      currentClass === "material-text-size-1"
        ? "5"
        : currentClass === "material-text-size-2"
          ? "7"
          : currentClass === "material-text-size-normal"
            ? "3"
            : getMaterialCurrentFontSizeCommandValue();

    const nextSize =
      currentSize === String(sizeValue)
        ? "3"
        : String(sizeValue);

    try {

      document.execCommand(
        "fontSize",
        false,
        nextSize
      );

    } catch (error) {

      console.error(
        error
      );

    }

    rememberMaterialSelection();
    return;

  }

  const exactSizeElement =
    getMaterialTextSizeElementForRange(
      range,
      editor,
      true
    );

  const containingSizeElement =
    exactSizeElement ||
    getMaterialTextSizeElementForRange(
      range,
      editor
    );

  const currentClass =
    getMaterialTextSizeClassFromElement(
      containingSizeElement
    );

  const nextClass =
    getNextMaterialTextSizeClass(
      currentClass,
      targetClass
    );

  if (exactSizeElement) {

    clearMaterialTextSizeDescendants(
      exactSizeElement
    );

    const wrapper =
      convertMaterialTextSizeElementToSpan(
        exactSizeElement
      );

    wrapper.className =
      nextClass;

    const updatedRange =
      document.createRange();

    updatedRange.selectNodeContents(
      wrapper
    );

    selection.removeAllRanges();
    selection.addRange(
      updatedRange
    );

    materialSelectionRange =
      updatedRange.cloneRange();

    updateMaterialFormattingButtonStates();

    return;

  }

  // Al cambiar solo una parte de un texto ya formateado, el contenido
  // extraído puede traer copias de sus tamaños anteriores. Quitamos esos
  // tamaños antes de aplicar uno solo al fragmento seleccionado.
  const contents =
    range.extractContents();

  clearMaterialTextSizeDescendants(
    contents
  );

  const wrapper =
    document.createElement("span");

  wrapper.className =
    nextClass;

  wrapper.appendChild(
    contents
  );

  range.insertNode(
    wrapper
  );

  const updatedRange =
    document.createRange();

  updatedRange.selectNodeContents(
    wrapper
  );

  selection.removeAllRanges();
  selection.addRange(
    updatedRange
  );

  materialSelectionRange =
    updatedRange.cloneRange();

  updateMaterialFormattingButtonStates();

}

function insertMaterialWrapper(
  left,
  right
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return;
  }

  const savedRange =
    materialSelectionRange?.cloneRange() || null;

  editor.focus();

  const restored =
    restoreMaterialSelection(savedRange);

  let range =
    restored
      ? materialSelectionRange
      : null;

  if (!range) {

    range =
      document.createRange();

    range.selectNodeContents(
      editor
    );

    range.collapse(
      false
    );

  }

  const selection =
    window.getSelection();

  if (
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const hasSelection =
    !range.collapsed;

  if (hasSelection) {

    const contents =
      range.extractContents();

    const fragment =
      document.createDocumentFragment();

    const opening =
      document.createTextNode(
        left
      );

    const closing =
      document.createTextNode(
        right
      );

    fragment.appendChild(
      opening
    );

    fragment.appendChild(
      contents
    );

    fragment.appendChild(
      closing
    );

    range.insertNode(
      fragment
    );

    // Dejar el cursor después del paréntesis/corchete de cierre
    // evita que la siguiente acción actúe sobre el rango anterior.
    range.setStartAfter(
      closing
    );

    range.collapse(
      true
    );

  } else {

    const opening =
      document.createTextNode(
        left
      );

    const closing =
      document.createTextNode(
        right
      );

    range.insertNode(
      closing
    );

    range.insertNode(
      opening
    );

    range.setStartAfter(
      opening
    );

    range.collapse(
      true
    );

  }

  selection.removeAllRanges();
  selection.addRange(
    range
  );

  materialSelectionRange =
    range.cloneRange();

}


function bindMaterialFormattingControls() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return;
  }

  const boldButton =
    document.getElementById(
      "materialBoldBtn"
    );

  const italicButton =
    document.getElementById(
      "materialItalicBtn"
    );

  const parenthesesButton =
    document.getElementById(
      "materialParenthesesBtn"
    );

  const bracketsButton =
    document.getElementById(
      "materialBracketsBtn"
    );

  const size1Button =
    document.getElementById(
      "materialSize1Btn"
    );

  const size2Button =
    document.getElementById(
      "materialSize2Btn"
    );

  const noteQuarterButton = document.getElementById("materialNoteQuarterBtn");
  const noteEighthButton = document.getElementById("materialNoteEighthBtn");
  const noteSixteenthButton = document.getElementById("materialNoteSixteenthBtn");
  const audioMarkerButton = document.getElementById("materialAudioMarkerBtn");
  const indentButton = document.getElementById("materialIndentBtn");
  const outdentButton = document.getElementById("materialOutdentBtn");


  const remember =
    () =>
      rememberMaterialSelection();


  editor.addEventListener(
    "mouseup",
    remember
  );

  editor.addEventListener(
    "keyup",
    remember
  );

  editor.addEventListener(
    "input",
    remember
  );

  editor.addEventListener(
    "focus",
    remember
  );


  boldButton?.addEventListener(
    "mousedown",
    event => {
      event.preventDefault();
      rememberMaterialSelection();
    }
  );

  boldButton?.addEventListener(
    "click",
    function() {
      executeMaterialTextCommand(
        "bold"
      );
    }
  );


  italicButton?.addEventListener(
    "mousedown",
    event => {
      event.preventDefault();
      rememberMaterialSelection();
    }
  );

  italicButton?.addEventListener(
    "click",
    function() {
      executeMaterialTextCommand(
        "italic"
      );
    }
  );


  size1Button?.addEventListener(
    "mousedown",
    event => {
      event.preventDefault();
      rememberMaterialSelection();
    }
  );

  size1Button?.addEventListener(
    "click",
    function() {
      toggleMaterialTextSize(
        "5"
      );
    }
  );


  size2Button?.addEventListener(
    "mousedown",
    event => {
      event.preventDefault();
      rememberMaterialSelection();
    }
  );

  size2Button?.addEventListener(
    "click",
    function() {
      toggleMaterialTextSize(
        "7"
      );
    }
  );


  parenthesesButton?.addEventListener(
    "mousedown",
    event => {
      event.preventDefault();
      rememberMaterialSelection();
    }
  );

  parenthesesButton?.addEventListener(
    "click",
    function() {
      insertMaterialWrapper(
        "(",
        ")"
      );
      showMaterialFormatActionFeedback(parenthesesButton);
      editor.focus();
    }
  );


  bracketsButton?.addEventListener(
    "mousedown",
    event => {
      event.preventDefault();
      rememberMaterialSelection();
    }
  );

  bracketsButton?.addEventListener(
    "click",
    function() {
      insertMaterialWrapper(
        "[",
        "]"
      );
      showMaterialFormatActionFeedback(bracketsButton);
      editor.focus();
    }
  );

  noteQuarterButton?.addEventListener("mousedown", event => {
    event.preventDefault();
    rememberMaterialSelection();
  });
  noteQuarterButton?.addEventListener("click", () => insertMaterialNotation("♩", noteQuarterButton));

  noteEighthButton?.addEventListener("mousedown", event => {
    event.preventDefault();
    rememberMaterialSelection();
  });
  noteEighthButton?.addEventListener("click", () => insertMaterialNotation("♪", noteEighthButton));

  noteSixteenthButton?.addEventListener("mousedown", event => {
    event.preventDefault();
    rememberMaterialSelection();
  });
  noteSixteenthButton?.addEventListener("click", () => insertMaterialNotation("♬", noteSixteenthButton));

  audioMarkerButton?.addEventListener("mousedown", event => {
    event.preventDefault();
    rememberMaterialSelection();
  });
  audioMarkerButton?.addEventListener("click", () => insertMaterialAudioMarker(audioMarkerButton));

  bindMaterialIndentRepeatButton(indentButton, 1);
  bindMaterialIndentRepeatButton(outdentButton, -1);

  const stopRepeat = () => {
    stopMaterialIndentRepeat();
    if (materialIndentPointerResetTimer !== null) {
      window.clearTimeout(materialIndentPointerResetTimer);
    }
    materialIndentPointerResetTimer = window.setTimeout(() => {
      materialIndentPointerHandled = false;
      materialIndentPointerResetTimer = null;
    }, 0);
  };

  document.addEventListener("pointerup", stopRepeat, true);
  document.addEventListener("pointercancel", stopRepeat, true);
  window.addEventListener("blur", stopRepeat);

}


document
  .getElementById(
    "materialComposerEditor"
  )
  .addEventListener(
    "paste",
    function(event) {

      event.preventDefault();

      const text =
        event.clipboardData?.getData(
          "text/plain"
        ) ||
        "";

      rememberMaterialSelection();

      insertMaterialNodeAtSelection(
        createMaterialAutoLinkFragment(
          text
        )
      );

    }
  );


document
  .getElementById(
    "insertMaterialFileBtn"
  )
  .addEventListener(
    "mousedown",
    function() {

      rememberMaterialSelection();

    }
  );


document
  .getElementById(
    "insertMaterialFileBtn"
  )
  .addEventListener(
    "click",
    function() {

      const input =
        document.getElementById(
          "materialPendingFile"
        );

      input.value =
        "";

      input.click();

    }
  );


document
  .getElementById(
    "materialPendingFile"
  )
  .addEventListener(
    "change",
    function() {

      const file =
        this.files &&
        this.files[0];

      if (!file) {
        return;
      }

      const pendingKey =
        crypto.randomUUID();

      materialPendingAttachments[
        pendingKey
      ] = {
        kind:
          "file",
        name:
          file.name,
        mime_type:
          file.type || null,
        file
      };

      const node =
        createMaterialInlineAttachment(
          materialPendingAttachments[
            pendingKey
          ],
          pendingKey
        );

      insertMaterialNodeAtSelection(
        node
      );

      this.value =
        "";

    }
  );


document
  .getElementById(
    "insertMaterialLinkBtn"
  )
  .addEventListener(
    "mousedown",
    function() {

      rememberMaterialSelection();

    }
  );


document
  .getElementById(
    "insertMaterialLinkBtn"
  )
  .addEventListener(
    "click",
    function() {

      const url =
        window.prompt(
          "Pegá la URL",
          "https://"
        );

      if (
        url === null
      ) {
        return;
      }

      const safeUrl =
        getSafeMaterialUrl(
          url
        );

      if (!safeUrl) {

        showNotice(
          "La URL debe comenzar con http:// o https://.",
          "error"
        );

        return;

      }

      const editor =
        document.getElementById(
          "materialComposerEditor"
        );

      if (
        !editor ||
        !focusMaterialEditorForFormatting()
      ) {
        return;
      }

      const selection =
        window.getSelection();

      if (
        selection &&
        selection.rangeCount &&
        !selection
          .getRangeAt(0)
          .collapsed
      ) {

        document.execCommand(
          "createLink",
          false,
          safeUrl
        );

      } else {

        insertMaterialNodeAtSelection(
          createMaterialAutoLinkFragment(
            safeUrl
          )
        );

      }

      rememberMaterialSelection();

    }
  );
