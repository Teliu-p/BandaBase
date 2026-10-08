/* Formato enriquecido exclusivo del compositor de Materiales. */

const MATERIAL_RICH_TEXT_PREFIX =
  "BANDABASE_RICH_TEXT_V1:";

const MATERIAL_RICH_TEXT_ALLOWED_SIZE_CLASSES =
  Object.freeze([
    "material-text-size-1",
    "material-text-size-2"
  ]);


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
    MATERIAL_RICH_TEXT_ALLOWED_SIZE_CLASSES.includes(
      element.classList.contains(
        "material-text-size-2"
      )
        ? "material-text-size-2"
        : element.classList.contains(
            "material-text-size-1"
          )
          ? "material-text-size-1"
          : ""
    )
  ) {
    return (
      element.classList.contains(
        "material-text-size-2"
      )
        ? "material-text-size-2"
        : "material-text-size-1"
    );
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
    /<(strong|span class="material-text-size-[12]")>/.test(
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
