/* Formato enriquecido exclusivo del compositor de Materiales. */

const MATERIAL_RICH_TEXT_PREFIX =
  "BANDABASE_RICH_TEXT_V1:";

const MATERIAL_RICH_TEXT_ALLOWED_SIZE_CLASSES =
  Object.freeze([
    "material-text-size-1",
    "material-text-size-2"
  ]);


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

    if (size === "5") {
      return "material-text-size-1";
    }

    if (size === "7") {
      return "material-text-size-2";
    }

  }

  return null;

}


function serializeMaterialRichTextNode(
  node
) {

  if (
    node.nodeType ===
    Node.TEXT_NODE
  ) {
    return escapeMaterialHtmlText(
      node.nodeValue || ""
    );
  }

  if (
    node.nodeType !==
    Node.ELEMENT_NODE
  ) {
    return "";
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
    /<(strong|a\b|span class="material-text-size-[12]")\b/.test(
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
  node
) {

  if (
    node.nodeType ===
    Node.TEXT_NODE
  ) {

    target.appendChild(
      document.createTextNode(
        node.nodeValue || ""
      )
    );

    return;

  }

  if (
    node.nodeType !==
    Node.ELEMENT_NODE
  ) {
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
            child
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
          child
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
        child
      )
  );

  target.appendChild(
    safeNode
  );

}


function createMaterialRichTextFragment(
  content
) {

  const html =
    getMaterialRichTextHtml(
      content
    );

  if (html === null) {
    return null;
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


function renderMaterialRichTextHtml(
  content
) {

  const html =
    getMaterialRichTextHtml(
      content
    );

  if (html === null) {
    return null;
  }

  const template =
    document.createElement(
      "template"
    );

  template.innerHTML =
    html;

  function renderNode(node) {

    if (
      node.nodeType ===
      Node.TEXT_NODE
    ) {
      return escapeMaterialHtmlText(
        node.nodeValue || ""
      ).replaceAll(
        "\n",
        "<br>"
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
            renderNode
          )
          .join("");
      }

      const children =
        Array.from(
          node.childNodes || []
        )
          .map(
            renderNode
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
          renderNode
        )
        .join("");

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
