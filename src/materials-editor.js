/* Editor y compositor de Materiales. */

/*
 * El doble clic permite fijar el punto de escritura en espacios vacíos
 * del compositor. El clic simple conserva el comportamiento nativo.
 */
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


function getMaterialRangeCaretPoint(
  sourceRange,
  editor
) {

  const range =
    sourceRange.cloneRange();

  range.collapse(true);

  let rect =
    range.getBoundingClientRect();

  if (
    rect &&
    rect.height > 0
  ) {
    return {
      x: rect.left,
      y: rect.top + rect.height / 2,
      height: rect.height
    };
  }

  const node =
    range.startContainer;

  if (node.nodeType === Node.TEXT_NODE) {

    const value =
      node.nodeValue || "";

    const offset =
      range.startOffset;

    function getCharacterRect(index) {

      if (
        index < 0 ||
        index >= value.length ||
        value[index] === "\n"
      ) {
        return null;
      }

      const characterRange =
        document.createRange();

      characterRange.setStart(
        node,
        index
      );

      characterRange.setEnd(
        node,
        index + 1
      );

      const characterRect =
        characterRange.getBoundingClientRect();

      if (!characterRect || !characterRect.height) {
        return null;
      }

      return characterRect;

    }

    let beforeIndex = offset - 1;
    let afterIndex = offset;

    while (
      beforeIndex >= 0 &&
      value[beforeIndex] === "\n"
    ) {
      beforeIndex -= 1;
    }

    while (
      afterIndex < value.length &&
      value[afterIndex] === "\n"
    ) {
      afterIndex += 1;
    }

    const beforeRect =
      getCharacterRect(beforeIndex);

    const afterRect =
      getCharacterRect(afterIndex);

    if (
      beforeRect &&
      afterRect
    ) {

      const beforeCenter =
        beforeRect.top + beforeRect.height / 2;

      const afterCenter =
        afterRect.top + afterRect.height / 2;

      const lineHeight =
        Math.max(
          beforeRect.height,
          afterRect.height
        );

      if (
        afterCenter - beforeCenter >=
        lineHeight * 1.5
      ) {
        return {
          x: editor.getBoundingClientRect().left +
            editor.clientLeft +
            parseFloat(getComputedStyle(editor).paddingLeft || "0"),
          y: beforeCenter + lineHeight,
          height: lineHeight
        };
      }

      if (
        value[offset - 1] === "\n" &&
        afterCenter > beforeCenter
      ) {
        return {
          x: afterRect.left,
          y: afterCenter,
          height: afterRect.height
        };
      }

      return {
        x: beforeRect.right,
        y: beforeCenter,
        height: beforeRect.height
      };

    }

    if (afterRect) {
      return {
        x: afterRect.left,
        y: afterRect.top + afterRect.height / 2,
        height: afterRect.height
      };
    }

    if (beforeRect) {
      return {
        x: beforeRect.right,
        y: beforeRect.top + beforeRect.height / 2,
        height: beforeRect.height
      };
    }

  }

  const editorRect =
    editor.getBoundingClientRect();

  const editorStyle =
    getComputedStyle(editor);

  const fontSize =
    parseFloat(editorStyle.fontSize) || 16;

  return {
    x: editorRect.left +
      editor.clientLeft +
      (parseFloat(editorStyle.paddingLeft) || 0),
    y: editorRect.top +
      editor.clientTop +
      (parseFloat(editorStyle.paddingTop) || 0) +
      fontSize * 0.75,
    height: fontSize * 1.5
  };

}


function getMaterialSpaceWidth(
  range,
  editor
) {

  const node =
    range.startContainer;

  const styleTarget =
    node.nodeType === Node.ELEMENT_NODE
      ? node
      : node.parentElement || editor;

  const style =
    getComputedStyle(styleTarget);

  const probe =
    document.createElement("span");

  probe.style.position =
    "absolute";

  probe.style.visibility =
    "hidden";

  probe.style.whiteSpace =
    "pre";

  probe.style.fontFamily =
    style.fontFamily;

  probe.style.fontSize =
    style.fontSize;

  probe.style.fontWeight =
    style.fontWeight;

  probe.style.fontStyle =
    style.fontStyle;

  probe.style.letterSpacing =
    style.letterSpacing;

  probe.textContent =
    "          ";

  document.body.appendChild(
    probe
  );

  const width =
    probe.getBoundingClientRect().width / 10;

  probe.remove();

  return width ||
    (parseFloat(style.fontSize) || 16) * 0.3;

}


function hasMaterialTextAtOrAfterPointOnLine(
  editor,
  targetX,
  targetY,
  lineHeight
) {

  const walker =
    document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT
    );

  let node;

  while (
    (node = walker.nextNode())
  ) {

    const value =
      node.nodeValue || "";

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {

      if (
        value[index] === "\n" ||
        value[index] === "\r"
      ) {
        continue;
      }

      const range =
        document.createRange();

      range.setStart(
        node,
        index
      );

      range.setEnd(
        node,
        index + 1
      );

      const rect =
        range.getBoundingClientRect();

      if (
        !rect ||
        !rect.height
      ) {
        continue;
      }

      const centerY =
        rect.top + rect.height / 2;

      if (
        Math.abs(centerY - targetY) <=
          Math.max(rect.height, lineHeight) * 0.55 &&
        rect.right > targetX + 1
      ) {
        return true;
      }

    }

  }

  return false;

}


function placeMaterialCaretAtDoubleClick(
  event
) {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (
    !editor ||
    !editor.contains(event.target)
  ) {
    return;
  }

  if (
    event.target.closest?.(
      ".material-inline-attachment"
    )
  ) {
    return;
  }

  event.preventDefault();

  let range = null;

  if (
    typeof document.caretPositionFromPoint ===
    "function"
  ) {

    const position =
      document.caretPositionFromPoint(
        event.clientX,
        event.clientY
      );

    if (
      position &&
      editor.contains(position.offsetNode)
    ) {

      range =
        document.createRange();

      range.setStart(
        position.offsetNode,
        position.offset
      );

      range.collapse(true);

    }

  }

  if (
    !range &&
    typeof document.caretRangeFromPoint ===
    "function"
  ) {

    const pointRange =
      document.caretRangeFromPoint(
        event.clientX,
        event.clientY
      );

    if (
      pointRange &&
      editor.contains(pointRange.startContainer) &&
      editor.contains(pointRange.endContainer)
    ) {

      range =
        pointRange.cloneRange();

      range.collapse(true);

    }

  }

  if (!range) {

    range =
      document.createRange();

    range.selectNodeContents(
      editor
    );

    range.collapse(false);

  }

  editor.focus();

  const selection =
    window.getSelection();

  if (!selection) {
    return;
  }

  const caretPoint =
    getMaterialRangeCaretPoint(
      range,
      editor
    );

  const editorRect =
    editor.getBoundingClientRect();

  const editorStyle =
    getComputedStyle(editor);

  const fontSize =
    parseFloat(editorStyle.fontSize) || 16;

  const lineHeight =
    parseFloat(editorStyle.lineHeight) ||
    fontSize * 1.5;

  const spaceWidth =
    getMaterialSpaceWidth(
      range,
      editor
    );

  const contentStartX =
    editorRect.left +
    editor.clientLeft +
    (parseFloat(editorStyle.paddingLeft) || 0);

  const padding =
    calculateMaterialForcedCaretPadding(
      caretPoint.x,
      caretPoint.y,
      event.clientX,
      event.clientY,
      lineHeight,
      spaceWidth,
      contentStartX
    );

  let prefix =
    "\n".repeat(
      padding.lineBreaks
    );

  if (
    padding.lineBreaks > 0
  ) {

    prefix +=
      " ".repeat(
        padding.spaces
      );

  } else if (
    event.clientX > caretPoint.x &&
    !hasMaterialTextAtOrAfterPointOnLine(
      editor,
      event.clientX,
      event.clientY,
      lineHeight
    )
  ) {

    prefix +=
      " ".repeat(
        padding.spaces
      );

  }

  if (prefix) {

    const paddingNode =
      document.createTextNode(
        prefix
      );

    range.insertNode(
      paddingNode
    );

    range.setStart(
      paddingNode,
      paddingNode.length
    );

    range.collapse(true);

  }

  selection.removeAllRanges();

  selection.addRange(
    range
  );

  materialSelectionRange =
    range.cloneRange();

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
    document.createTextNode(
      icon +
      " " +
      name +
      " "
    );

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

  Array.from(
    editor.childNodes
  ).forEach(
    node => {

      if (
        node.nodeType ===
        Node.TEXT_NODE
      ) {

        textNodes.push(
          node
        );

        return;

      }

      if (
        node.nodeType !==
        Node.ELEMENT_NODE
      ) {
        return;
      }

      const element =
        node;

      if (
        element.classList.contains(
          "material-inline-attachment"
        )
      ) {

        flushText();

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

        return;

      }

      textNodes.push(
        element
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
