/* Editor y compositor de Materiales. */

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

  }

}


function restoreMaterialSelection() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (
    !editor ||
    !materialSelectionRange
  ) {
    return false;
  }

  const selection =
    window.getSelection();

  try {

    selection.removeAllRanges();

    selection.addRange(
      materialSelectionRange
    );

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

  editor.focus();

  const hasSelection =
    restoreMaterialSelection();

  let range =
    materialSelectionRange;

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
            document.createTextNode(
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

function getLastMaterialTextNode(
  node
) {

  if (!node) {
    return null;
  }

  if (
    node.nodeType ===
    Node.TEXT_NODE
  ) {
    return node;
  }

  for (
    let index =
      node.childNodes.length - 1;
    index >= 0;
    index -= 1
  ) {

    const textNode =
      getLastMaterialTextNode(
        node.childNodes[index]
      );

    if (textNode) {
      return textNode;
    }

  }

  return null;

}


function getMaterialTextNodeBeforeCaret(
  editor,
  selection
) {

  let container =
    selection.anchorNode;

  let offset =
    selection.anchorOffset;

  if (
    container?.nodeType ===
    Node.TEXT_NODE
  ) {
    return container;
  }

  while (
    container &&
    container !== editor
  ) {

    for (
      let index =
        Math.min(
          offset,
          container.childNodes.length
        ) - 1;
      index >= 0;
      index -= 1
    ) {

      const textNode =
        getLastMaterialTextNode(
          container.childNodes[index]
        );

      if (textNode) {
        return textNode;
      }

    }

    const parent =
      container.parentNode;

    if (!parent) {
      return null;
    }

    offset =
      Array.prototype.indexOf.call(
        parent.childNodes,
        container
      );

    container =
      parent;

  }

  for (
    let index =
      Math.min(
        offset,
        editor.childNodes.length
      ) - 1;
    index >= 0;
    index -= 1
  ) {

    const textNode =
      getLastMaterialTextNode(
        editor.childNodes[index]
      );

    if (textNode) {
      return textNode;
    }

  }

  return null;

}


function autoLinkMaterialUrlInTextNode(
  textNode,
  caretOffset = null
) {

  if (
    !textNode ||
    textNode.nodeType !==
      Node.TEXT_NODE ||
    textNode.parentElement?.closest("a")
  ) {
    return false;
  }

  const value =
    textNode.nodeValue || "";

  const offset =
    caretOffset === null
      ? value.length
      : Math.min(
          Math.max(caretOffset, 0),
          value.length
        );

  const beforeCaret =
    value.slice(0, offset);

  const match =
    beforeCaret.match(
      /((?:https?:\/\/|www\.)[^\s<>"']+)(\s*)$/i
    );

  if (!match) {
    return false;
  }

  let candidate =
    match[1];

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
    return false;
  }

  const anchor =
    createMaterialAutoLinkAnchor(
      candidate,
      safeUrl
    );

  if (!anchor) {
    return false;
  }

  const parent =
    textNode.parentNode;

  if (!parent) {
    return false;
  }

  const before =
    value.slice(
      0,
      match.index
    );

  const after =
    trailing +
    match[1].slice(candidate.length) +
    match[2] +
    value.slice(offset);

  const afterTextNode =
    document.createTextNode(
      after
    );

  const fragment =
    document.createDocumentFragment();

  if (before) {
    fragment.appendChild(
      document.createTextNode(
        before
      )
    );
  }

  fragment.appendChild(
    anchor
  );

  fragment.appendChild(
    afterTextNode
  );

  parent.replaceChild(
    fragment,
    textNode
  );

  if (
    caretOffset !== null
  ) {

    const selection =
      window.getSelection();

    if (selection) {

      const range =
        document.createRange();

      range.setStart(
        afterTextNode,
        trailing.length +
          match[1].slice(candidate.length).length +
          match[2].length
      );

      range.collapse(true);

      selection.removeAllRanges();
      selection.addRange(range);

    }

  }

  return true;

}


function autoLinkMaterialUrlNearCaret() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  const selection =
    window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount ||
    !selection.isCollapsed ||
    !editor.contains(
      selection.anchorNode
    )
  ) {
    return false;
  }

  const textNode =
    getMaterialTextNodeBeforeCaret(
      editor,
      selection
    );

  if (!textNode) {
    return false;
  }

  const caretOffset =
    selection.anchorNode === textNode
      ? selection.anchorOffset
      : null;

  if (
    autoLinkMaterialUrlInTextNode(
      textNode,
      caretOffset
    )
  ) {
    return true;
  }

  const walker =
    document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT
    );

  let previousTextNode = null;

  while (
    walker.nextNode()
  ) {

    const current =
      walker.currentNode;

    if (current === textNode) {
      break;
    }

    previousTextNode =
      current;
  }

  if (!previousTextNode) {
    return false;
  }

  return autoLinkMaterialUrlInTextNode(
    previousTextNode
  );

}


function insertMaterialLinkAtSelection(
  url
) {

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

  const range =
    materialSelectionRange;

  if (!range) {
    return;
  }

  const selection =
    window.getSelection();

  if (!selection) {
    return;
  }

  if (range.collapsed) {

    const anchor =
      createMaterialAutoLinkAnchor(
        url,
        url
      );

    if (!anchor) {
      return;
    }

    range.insertNode(
      anchor
    );

    range.setStartAfter(
      anchor
    );

    range.collapse(true);

  } else {

    const contents =
      range.extractContents();

    const anchor =
      document.createElement("a");

    anchor.href =
      getMaterialAutoLinkUrl(url);

    anchor.target =
      "_blank";

    anchor.rel =
      "noopener noreferrer";

    anchor.append(
      ...Array.from(
        contents.childNodes
      )
    );

    range.insertNode(
      anchor
    );

    range.setStartAfter(
      anchor
    );

    range.collapse(true);

  }

  selection.removeAllRanges();
  selection.addRange(range);

  materialSelectionRange =
    range.cloneRange();

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
    "keyup",
    function(event) {

      if (
        event.key !== " " &&
        event.key !== "Enter"
      ) {
        return;
      }

      autoLinkMaterialUrlNearCaret();
      rememberMaterialSelection();

    }
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


function focusMaterialEditorForFormatting() {

  const editor =
    document.getElementById(
      "materialComposerEditor"
    );

  if (!editor) {
    return false;
  }

  editor.focus();

  return restoreMaterialSelection();

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


function toggleMaterialTextSize(
  sizeValue
) {

  if (
    !focusMaterialEditorForFormatting()
  ) {
    return;
  }

  const currentSize =
    getMaterialCurrentFontSizeCommandValue();

  const nextSize =
    currentSize ===
      String(sizeValue)
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

  editor.focus();

  const restored =
    restoreMaterialSelection();

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

    fragment.appendChild(
      document.createTextNode(
        left
      )
    );

    fragment.appendChild(
      contents
    );

    fragment.appendChild(
      document.createTextNode(
        right
      )
    );

    range.insertNode(
      fragment
    );

    range.collapse(
      false
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

      if (url === null) {
        return;
      }

      const safeUrl =
        getSafeMaterialUrl(
          url
        );

      if (!safeUrl) {

        showNotice(
          "La URL debe comenzar por http:// o https://.",
          "error"
        );

        return;

      }

      insertMaterialLinkAtSelection(
        safeUrl
      );

    }
  );
