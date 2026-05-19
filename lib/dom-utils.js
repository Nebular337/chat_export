(function initDomUtils(global) {
  const DEBUG = false;

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeWhitespace(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function textFromNode(node) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return normalizeWhitespace(node.textContent);
    }

    return normalizeWhitespace(node.textContent || "");
  }

  function makeAbsoluteUrl(href, baseUrl) {
    if (!href) {
      return null;
    }

    try {
      return new URL(href, baseUrl || location.href).toString();
    } catch (error) {
      log("Failed to resolve URL", href, error);
      return null;
    }
  }

  function isVisibleElement(node) {
    if (!(node instanceof Element)) {
      return false;
    }

    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    const rect = node.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function dedupeStrings(items) {
    const seen = new Set();
    const deduped = [];

    for (const item of items) {
      const normalized = normalizeWhitespace(item);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      deduped.push(normalized);
    }

    return deduped;
  }

  function log(...args) {
    if (DEBUG) {
      console.log("[copilot-exporter:dom]", ...args);
    }
  }

  global.CopilotExporter = global.CopilotExporter || {};
  global.CopilotExporter.domUtils = {
    DEBUG,
    delay,
    normalizeWhitespace,
    textFromNode,
    makeAbsoluteUrl,
    isVisibleElement,
    dedupeStrings
  };
})(globalThis);
