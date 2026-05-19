const LINK_KIND = {
  INLINE: "inline",
  CITATION: "citation",
  FILE: "file",
  IMAGE: "image"
};
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

function normalizeHref(href, baseUrl) {
  if (!href) {
    return null;
  }

  try {
    const url = new URL(href, baseUrl);
    return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch (error) {
    return null;
  }
}

function linkFromAnchor(anchor, { kind = LINK_KIND.INLINE, baseUrl } = {}) {
  if (!anchor) {
    return null;
  }

  const href = normalizeHref(anchor.getAttribute("href"), baseUrl);
  if (!href) {
    return null;
  }

  return {
    text: (anchor.textContent || "").replace(/\s+/g, " ").trim() || href,
    href,
    kind,
    isVisibleTextLink: Boolean((anchor.textContent || "").trim())
  };
}

function extractLinks(root, { selector = 'a[href]', kind = LINK_KIND.INLINE, baseUrl } = {}) {
  if (!root?.querySelectorAll) {
    return [];
  }

  const links = [];
  const seen = new Set();

  for (const anchor of root.querySelectorAll(selector)) {
    const link = linkFromAnchor(anchor, { kind, baseUrl });
    if (!link) {
      continue;
    }

    const key = `${link.kind}|${link.href}|${link.text}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    links.push(link);
  }

  return links;
}

function extractGroupedCitations(root, { selector = "[data-grouped-citations]", baseUrl } = {}) {
  if (!root?.querySelectorAll) {
    return [];
  }

  const citations = [];
  const seen = new Set();

  for (const element of root.querySelectorAll(selector)) {
    const raw = element.getAttribute("data-grouped-citations");
    if (!raw) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      continue;
    }

    if (!Array.isArray(parsed)) {
      continue;
    }

    for (const item of parsed) {
      const href = normalizeHref(item?.url, baseUrl);
      if (!href) {
        continue;
      }

      const citation = {
        text: String(item?.name || element.textContent || href).replace(/\s+/g, " ").trim(),
        href,
        kind: LINK_KIND.CITATION,
        isVisibleTextLink: Boolean(String(item?.name || element.textContent || "").trim())
      };

      const key = `${citation.kind}|${citation.href}|${citation.text}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      citations.push(citation);
    }
  }

  return citations;
}

if (typeof globalThis !== "undefined") {
  globalThis.CopilotExporter = globalThis.CopilotExporter || {};
  globalThis.CopilotExporter.linkUtils = {
    LINK_KIND,
    normalizeHref,
    linkFromAnchor,
    extractLinks,
    extractGroupedCitations
  };
}
