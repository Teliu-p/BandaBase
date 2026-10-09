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

    updateMaterialFormattingButtonStates();

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
    fontSize === "5"
  );

  setMaterialFormattingButtonState(
    document.getElementById("materialSize2Btn"),
    fontSize === "7"
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
