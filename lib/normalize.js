function normalizeTranscript(rawTranscript, options = {}) {
  const messages = Array.isArray(rawTranscript?.messages) ? rawTranscript.messages : [];
  const normalizedMessages = messages
    .map((message, index) => normalizeMessage(message, index + 1, options))
    .filter(Boolean);

  return {
    meta: {
      sourceUrl: rawTranscript?.meta?.sourceUrl || options.sourceUrl || "",
      exportedAt: rawTranscript?.meta?.exportedAt || new Date().toISOString(),
      title: rawTranscript?.meta?.title || null,
      captureWarnings: normalizeWarnings(rawTranscript?.meta?.captureWarnings),
      captureConfidence: rawTranscript?.meta?.captureConfidence || "medium",
      diagnostic: rawTranscript?.meta?.diagnostic || {}
    },
    conversation: {
      messages: normalizedMessages
    }
  };
}

function normalizeMessage(message, sequence) {
  if (!message) {
    return null;
  }

  const blocks = normalizeBlocks(message.blocks || []);
  const links = dedupeLinks(message.links || []);
  const sender = normalizeSender(message.sender);
  const textFallback = (message.text || "").trim();

  if (!blocks.length && !textFallback && !links.length) {
    return null;
  }

  const finalBlocks = blocks.length
    ? blocks
    : [{ type: "paragraph", text: textFallback, html: null }];

  return {
    id: message.id || `msg_${String(sequence).padStart(3, "0")}`,
    sender,
    sequence,
    timestamp: message.timestamp || null,
    blocks: finalBlocks,
    links,
    rawMeta: message.rawMeta || {}
  };
}

function normalizeBlocks(blocks) {
  const normalized = [];
  const seenParagraphs = new Set();

  for (const block of blocks) {
    const next = normalizeBlock(block);
    if (!next) {
      continue;
    }

    if (next.type === "paragraph") {
      const key = next.text;
      if (seenParagraphs.has(key)) {
        continue;
      }
      seenParagraphs.add(key);
    }

    normalized.push(next);
  }

  return normalized;
}

function normalizeBlock(block) {
  if (!block || !block.type) {
    return null;
  }

  switch (block.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
      return normalizeTextBlock(block);
    case "bulleted_list":
    case "numbered_list":
      return normalizeListBlock(block);
    case "code_block":
      return {
        type: "code_block",
        text: normalizeInlineText(block.text),
        language: block.language || null,
        html: normalizeHtml(block.html)
      };
    case "table":
      return {
        type: "table",
        rows: Array.isArray(block.rows)
          ? block.rows.map((row) => row.map((cell) => normalizeInlineText(cell)))
          : [],
        html: normalizeHtml(block.html)
      };
    case "citation_group":
      return {
        type: "citation_group",
        items: Array.isArray(block.items)
          ? block.items
              .map((item) => ({
                text: normalizeInlineText(item.text),
                href: item.href || null
              }))
              .filter((item) => item.text || item.href)
          : []
      };
    case "image":
      return {
        type: "image",
        src: block.src || null,
        alt: normalizeInlineText(block.alt)
      };
    case "file_reference":
      return {
        type: "file_reference",
        name: normalizeInlineText(block.name),
        href: block.href || null
      };
    case "unknown_rich_block":
      return {
        type: "unknown_rich_block",
        text: normalizeInlineText(block.text)
      };
    default:
      return normalizeTextBlock({
        type: "unknown_rich_block",
        text: block.text || ""
      });
  }
}

function normalizeTextBlock(block) {
  const text = normalizeInlineText(block.text);
  if (!text) {
    return null;
  }

  return {
    type: block.type,
    text,
    html: normalizeHtml(block.html)
  };
}

function normalizeListBlock(block) {
  const items = Array.isArray(block.items)
    ? block.items.map((item) => normalizeInlineText(item)).filter(Boolean)
    : [];

  if (!items.length) {
    return null;
  }

  return {
    type: block.type,
    items,
    html: normalizeHtml(block.html)
  };
}

function normalizeInlineText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeHtml(value) {
  return null;
}

function normalizeSender(sender) {
  return ["user", "copilot", "system/unknown"].includes(sender)
    ? sender
    : "system/unknown";
}

function normalizeWarnings(warnings) {
  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings
    .filter((warning) => warning?.code && warning?.message)
    .map((warning) => ({
      code: warning.code,
      message: warning.message
    }));
}

function dedupeLinks(links) {
  const normalized = [];
  const seen = new Set();

  for (const link of links) {
    if (!link?.href) {
      continue;
    }

    const normalizedLink = {
      text: normalizeInlineText(link.text) || link.href,
      href: link.href,
      kind: link.kind || "inline",
      isVisibleTextLink: Boolean(link.isVisibleTextLink)
    };

    const key = `${normalizedLink.kind}|${normalizedLink.href}|${normalizedLink.text}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(normalizedLink);
  }

  return normalized;
}

if (typeof globalThis !== "undefined") {
  globalThis.CopilotExporter = globalThis.CopilotExporter || {};
  globalThis.CopilotExporter.normalize = {
    normalizeTranscript,
    normalizeMessage,
    normalizeBlocks,
    normalizeBlock
  };
}
