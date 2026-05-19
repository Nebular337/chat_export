const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:"]);

const params = new URLSearchParams(location.search);
const exportId = params.get("exportId");

const warningBanner = document.getElementById("warning-banner");
const metaCard = document.getElementById("meta-card");
const messageList = document.getElementById("message-list");
const emptyState = document.getElementById("empty-state");
const printButton = document.getElementById("print-button");
const closeButton = document.getElementById("close-button");

printButton.addEventListener("click", () => window.print());
closeButton.addEventListener("click", async () => {
  if (exportId) {
    try {
      await chrome.runtime.sendMessage({
        type: "copilot-exporter:dismiss-export",
        exportId
      });
    } catch (error) {
      console.warn("[copilot-exporter:preview] dismiss failed", error);
    }
  }

  window.close();
});

init().catch((error) => {
  console.error("[copilot-exporter:preview] init failed", error);
  showEmptyState("Preview data is unavailable. Run the export again.");
});

async function init() {
  if (!exportId) {
    showEmptyState("Missing export identifier.");
    return;
  }

  const response = await chrome.runtime.sendMessage({
    type: "copilot-exporter:consume-export",
    exportId
  });

  if (!response?.ok || !response.payload) {
    showEmptyState(response?.error?.message || "Preview data is unavailable. Run the export again.");
    return;
  }

  renderTranscript(response.payload);
}

function renderTranscript(payload) {
  renderWarnings(payload.meta?.captureWarnings || []);
  renderMeta(payload.meta || {});

  const messages = payload.conversation?.messages || [];
  if (!messages.length) {
    showEmptyState("No exportable messages were detected.");
    return;
  }

  messageList.replaceChildren();
  emptyState.hidden = true;

  for (const message of messages) {
    messageList.appendChild(renderMessage(message));
  }
}

function renderWarnings(warnings) {
  warningBanner.replaceChildren();
  warningBanner.hidden = warnings.length === 0;

  if (!warnings.length) {
    return;
  }

  const title = document.createElement("strong");
  title.textContent = "Warnings";
  warningBanner.appendChild(title);

  const list = document.createElement("ul");
  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = warning.message || "Unknown warning";
    list.appendChild(item);
  }

  warningBanner.appendChild(list);
}

function renderMeta(meta) {
  metaCard.replaceChildren();

  const grid = document.createElement("div");
  grid.className = "meta-grid";
  grid.appendChild(renderMetaItem("Source", createExternalLinkNode(meta.sourceUrl, meta.sourceUrl || "Unknown")));

  if (meta.title) {
    grid.appendChild(renderMetaItem("Conversation", createTextNode(meta.title)));
  }

  grid.appendChild(renderMetaItem("Exported", createTextNode(formatDate(meta.exportedAt))));
  grid.appendChild(renderMetaItem("Confidence", createTextNode(meta.captureConfidence || "unknown")));

  metaCard.appendChild(grid);
}

function renderMetaItem(label, valueNode) {
  const wrapper = document.createElement("div");
  const heading = document.createElement("strong");
  const value = document.createElement("p");

  heading.textContent = label;
  value.appendChild(valueNode);

  wrapper.appendChild(heading);
  wrapper.appendChild(value);
  return wrapper;
}

function renderMessage(message) {
  const article = document.createElement("article");
  article.className = `message-card ${senderClassName(message.sender)}`;

  const header = document.createElement("div");
  header.className = "message-header";

  const senderBadge = document.createElement("span");
  const senderClass = message.sender === "user"
    ? "user"
    : message.sender === "copilot"
      ? "copilot"
      : "system";
  const senderLabel = message.sender === "system/unknown" ? "System / Unknown" : capitalize(message.sender || "unknown");

  senderBadge.className = `sender-badge ${senderClass}`;
  senderBadge.textContent = senderLabel;

  const sequence = document.createElement("span");
  sequence.textContent = `#${message.sequence ?? "?"}`;

  header.appendChild(senderBadge);
  header.appendChild(sequence);
  article.appendChild(header);

  for (const block of message.blocks || []) {
    article.appendChild(renderBlock(block));
  }

  const links = (message.links || []).filter((link) => link.kind === "inline");
  if (links.length) {
    const list = document.createElement("ul");
    list.className = "link-list";
    for (const link of links) {
      const item = document.createElement("li");
      item.appendChild(createExternalLinkNode(link.href, link.text || link.href || "Link"));
      list.appendChild(item);
    }
    article.appendChild(list);
  }

  return article;
}

function renderBlock(block) {
  switch (block.type) {
    case "heading":
      return renderTextBlock("h2", block.text);
    case "paragraph":
    case "unknown_rich_block":
      return renderTextBlock("p", block.text);
    case "blockquote":
      return renderTextBlock("blockquote", block.text);
    case "bulleted_list":
    case "numbered_list":
      return renderListBlock(block);
    case "code_block":
      return renderCodeBlock(block);
    case "table":
      return renderTableBlock(block);
    case "citation_group":
      return renderCitationGroup(block);
    case "image":
      return renderImageBlock(block);
    case "file_reference":
      return renderFileReference(block);
    default:
      return renderTextBlock("p", block.text);
  }
}

function renderTextBlock(tagName, text) {
  const element = document.createElement(tagName);
  element.className = "block";
  element.textContent = text || "";
  return element;
}

function renderListBlock(block) {
  const list = document.createElement(block.type === "numbered_list" ? "ol" : "ul");
  list.className = "block";

  for (const itemText of block.items || []) {
    const item = document.createElement("li");
    item.textContent = itemText;
    list.appendChild(item);
  }

  return list;
}

function renderCodeBlock(block) {
  const pre = document.createElement("pre");
  pre.className = "block";
  pre.textContent = block.text || "";
  return pre;
}

function renderTableBlock(block) {
  const rows = Array.isArray(block.rows) ? block.rows.filter(Array.isArray) : [];
  if (!rows.length) {
    return renderTextBlock("p", "Table content omitted from export.");
  }

  const wrapper = document.createElement("div");
  wrapper.className = "block rich-table";

  const table = document.createElement("table");
  const body = document.createElement("tbody");

  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const td = document.createElement("td");
      td.textContent = cell || "";
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  table.appendChild(body);
  wrapper.appendChild(table);
  return wrapper;
}

function renderCitationGroup(block) {
  const list = document.createElement("ul");
  list.className = "citation-list";

  for (const item of block.items || []) {
    const entry = document.createElement("li");
    entry.appendChild(createExternalLinkNode(item.href, item.text || item.href || "Citation"));
    list.appendChild(entry);
  }

  return list;
}

function renderImageBlock(block) {
  const safeSrc = sanitizeExternalUrl(block.src);
  if (!safeSrc) {
    return renderTextBlock("p", block.alt || "Image omitted from export.");
  }

  const figure = document.createElement("figure");
  figure.className = "block";

  const image = document.createElement("img");
  image.src = safeSrc;
  image.alt = block.alt || "";
  image.className = "message-image";

  figure.appendChild(image);

  if (block.alt) {
    const caption = document.createElement("figcaption");
    caption.textContent = block.alt;
    figure.appendChild(caption);
  }

  return figure;
}

function renderFileReference(block) {
  const paragraph = document.createElement("p");
  paragraph.className = "block";
  paragraph.appendChild(createExternalLinkNode(block.href, block.name || block.href || "File reference"));
  return paragraph;
}

function showEmptyState(message) {
  emptyState.hidden = false;
  emptyState.querySelector("p").textContent = message;
  messageList.replaceChildren();
}

function formatDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function senderClassName(sender) {
  if (sender === "user") {
    return "user";
  }

  if (sender === "copilot") {
    return "copilot";
  }

  return "system";
}

function sanitizeExternalUrl(urlString) {
  if (!urlString) {
    return null;
  }

  try {
    const url = new URL(urlString, location.href);
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch (error) {
    return null;
  }
}

function createExternalLinkNode(urlString, label) {
  const safeHref = sanitizeExternalUrl(urlString);
  if (!safeHref) {
    return createTextNode(label || "Unavailable");
  }

  const anchor = document.createElement("a");
  anchor.href = safeHref;
  anchor.textContent = label || safeHref;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.referrerPolicy = "no-referrer";
  return anchor;
}

function createTextNode(value) {
  return document.createTextNode(value || "");
}
