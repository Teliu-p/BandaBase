/* Comentarios: texto + archivos + enlaces en un mismo editor. */

const commentComposerStates = {
  general: {
    selectionRange: null,
    pendingAttachments: {},
    originalAttachmentIds: new Set()
  },
  song: {
    selectionRange: null,
    pendingAttachments: {},
    originalAttachmentIds: new Set()
  },
  comparison: {
    selectionRange: null,
    pendingAttachments: {},
    originalAttachmentIds: new Set()
  }
};

let generalComments = [];
let generalEditingCommentId = null;
let generalCommentProfilesMap = {};

let currentComments = [];
let commentProfilesMap = {};
let editingCommentId = null;


function getCommentComposerConfig(type) {
  return type === "general"
    ? {
        editorId: "generalCommentComposerEditor",
        fileInputId: "generalCommentPendingFile",
        fileButtonId: "insertGeneralCommentFileBtn",
        linkButtonId: "insertGeneralCommentLinkBtn"
      }
    : type === "comparison"
      ? {
          editorId: "comparisonComposerEditor",
          fileInputId: "comparisonPendingFile",
          fileButtonId: "insertComparisonFileBtn",
          linkButtonId: "insertComparisonLinkBtn"
        }
      : {
          editorId: "commentComposerEditor",
          fileInputId: "commentPendingFile",
          fileButtonId: "insertCommentFileBtn",
          linkButtonId: "insertCommentLinkBtn"
        };
}


function getCommentState(type) {
  return commentComposerStates[type];
}


function getCommentAttachmentIcon(attachment) {
  if (attachment?.kind === "link") return "🔗";

  const mime = String(
    attachment?.mime_type || ""
  );

  if (mime.startsWith("audio/")) return "🎧";
  if (mime.includes("pdf")) return "📄";

  return "📎";
}


function getCommentAttachmentName(attachment) {
  return (
    attachment?.name ||
    attachment?.file_name ||
    "Archivo"
  );
}


function getSafeCommentUrl(value) {
  const url = String(value || "").trim();

  if (!url) return null;

  try {
    const parsed = new URL(url);

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


function rememberCommentSelection(type) {
  const editor = document.getElementById(
    getCommentComposerConfig(type).editorId
  );

  const selection = window.getSelection();

  if (
    !editor ||
    !selection ||
    !selection.rangeCount
  ) {
    return;
  }

  const range = selection.getRangeAt(0);

  if (
    editor.contains(range.startContainer) &&
    editor.contains(range.endContainer)
  ) {
    getCommentState(type).selectionRange =
      range.cloneRange();
  }
}


function restoreCommentSelection(type) {
  const editor = document.getElementById(
    getCommentComposerConfig(type).editorId
  );

  const range =
    getCommentState(type).selectionRange;

  if (!editor || !range) return false;

  const selection = window.getSelection();

  try {
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  } catch (error) {
    return false;
  }
}


function createCommentInlineAttachment(
  attachment,
  type,
  pendingKey = null
) {
  const wrapper =
    document.createElement("span");

  wrapper.className =
    "comment-inline-attachment";
  wrapper.contentEditable = "false";

  if (attachment?.id) {
    wrapper.dataset.attachmentId =
      attachment.id;
  }

  if (pendingKey) {
    wrapper.dataset.pendingKey =
      pendingKey;
  }

  wrapper.appendChild(
    document.createTextNode(
      getCommentAttachmentIcon(attachment) +
      " " +
      getCommentAttachmentName(attachment) +
      " "
    )
  );

  const removeButton =
    document.createElement("button");

  removeButton.type = "button";
  removeButton.className = "inline-remove";
  removeButton.textContent = "×";
  removeButton.title = "Quitar";

  removeButton.addEventListener(
    "mousedown",
    event => event.preventDefault()
  );

  removeButton.addEventListener(
    "click",
    event => {
      event.preventDefault();
      wrapper.remove();
    }
  );

  wrapper.appendChild(removeButton);

  return wrapper;
}


function insertCommentNodeAtSelection(
  type,
  node
) {
  const editor = document.getElementById(
    getCommentComposerConfig(type).editorId
  );

  const state = getCommentState(type);

  if (!editor) return;

  editor.focus();

  const hasSelection =
    restoreCommentSelection(type);

  let range = state.selectionRange;

  if (!hasSelection) {
    range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
  }

  range.deleteContents();

  const before =
    document.createTextNode(" ");
  const after =
    document.createTextNode(" ");

  range.insertNode(after);
  range.insertNode(node);
  range.insertNode(before);

  range.setStartAfter(after);
  range.collapse(true);

  const selection =
    window.getSelection();

  selection.removeAllRanges();
  selection.addRange(range);

  state.selectionRange =
    range.cloneRange();
}


function renderCommentComposer(
  type,
  blocks
) {
  const editor = document.getElementById(
    getCommentComposerConfig(type).editorId
  );

  if (!editor) return;

  editor.innerHTML = "";

  const safeBlocks =
    blocks?.length
      ? blocks
      : [{ block_type: "text", content: "" }];

  safeBlocks.forEach(block => {
    if (block.block_type === "text") {
      if (block.content) {
        editor.appendChild(
          document.createTextNode(
            block.content
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

      if (!attachment) return;

      editor.appendChild(
        createCommentInlineAttachment(
          attachment,
          type,
          block.pendingKey || null
        )
      );
    }
  });

  editor.focus();

  const range =
    document.createRange();

  range.selectNodeContents(editor);
  range.collapse(false);

  const selection =
    window.getSelection();

  selection.removeAllRanges();
  selection.addRange(range);

  getCommentState(type).selectionRange =
    range.cloneRange();
}


function collectCommentComposerBlocks(
  type
) {
  const editor = document.getElementById(
    getCommentComposerConfig(type).editorId
  );

  if (!editor) return [];

  const blocks = [];

  function appendText(value) {
    if (!value) return;

    const last =
      blocks[blocks.length - 1];

    if (
      last &&
      last.block_type === "text"
    ) {
      last.content += value;
    } else {
      blocks.push({
        block_type: "text",
        content: value
      });
    }
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      appendText(node.nodeValue || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (
      node.classList.contains(
        "comment-inline-attachment"
      )
    ) {
      blocks.push({
        block_type: "attachment",
        attachment_id:
          node.dataset.attachmentId ||
          null,
        pendingKey:
          node.dataset.pendingKey ||
          null
      });
      return;
    }

    Array.from(
      node.childNodes
    ).forEach(walk);
  }

  Array.from(
    editor.childNodes
  ).forEach(walk);

  return blocks;
}


function getCommentText(blocks) {
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
    .join("")
    .trim();
}


function resetCommentComposer(type) {
  const config =
    getCommentComposerConfig(type);
  const state =
    getCommentState(type);

  const editor =
    document.getElementById(
      config.editorId
    );

  const fileInput =
    document.getElementById(
      config.fileInputId
    );

  state.selectionRange = null;
  state.pendingAttachments = {};
  state.originalAttachmentIds =
    new Set();

  if (editor) editor.innerHTML = "";
  if (fileInput) fileInput.value = "";
}


function openCommentComposer(
  type,
  blocks = [],
  attachments = []
) {
  const state =
    getCommentState(type);

  state.pendingAttachments = {};
  state.originalAttachmentIds =
    new Set(
      (attachments || [])
        .map(
          attachment =>
            attachment.id
        )
        .filter(Boolean)
    );

  renderCommentComposer(
    type,
    blocks
  );
}
