const DEBUG = false;
const EXPORT_CACHE_TTL_MS = 2 * 60 * 1000;
const exportCache = new Map();

chrome.action.onClicked.addListener(async (tab) => {
  await runExport(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "copilot-exporter:consume-export") {
    cleanupCache();
    const entry = exportCache.get(message.exportId);

    if (!entry) {
      sendResponse({
        ok: false,
        error: {
          code: "EXPORT_NOT_FOUND",
          message: "Preview data is no longer available. Run the export again."
        }
      });
      return false;
    }

    exportCache.delete(message.exportId);
    sendResponse({ ok: true, payload: entry.payload });
    return false;
  }

  if (message?.type === "copilot-exporter:dismiss-export") {
    exportCache.delete(message.exportId);
    sendResponse({ ok: true });
    return false;
  }

  return false;
});

async function runExport(tab) {
  if (!tab?.id || !tab.url) {
    return;
  }

  const unsupportedResult = buildUnsupportedPayload(tab.url);
  if (unsupportedResult) {
    await openPreviewWithPayload(unsupportedResult);
    return;
  }

  try {
    const payload = await requestExtraction(tab);
    const safePayload = payload ?? {
      meta: {
        sourceUrl: tab.url,
        exportedAt: new Date().toISOString(),
        title: tab.title || null,
        captureWarnings: [
          {
            code: "PREVIEW_INIT_FAILED",
            message: "Preview generation failed. Try again."
          }
        ],
        captureConfidence: "low",
        diagnostic: {}
      },
      conversation: { messages: [] }
    };

    await openPreviewWithPayload(safePayload);
  } catch (error) {
    log("tab message failed", error);
    await openPreviewWithPayload({
      meta: {
        sourceUrl: tab.url,
        exportedAt: new Date().toISOString(),
        title: tab.title || null,
        captureWarnings: [
          {
            code: "PREVIEW_INIT_FAILED",
            message: "Preview generation failed. Try again."
          }
        ],
        captureConfidence: "low",
        diagnostic: {}
      },
      conversation: { messages: [] }
    });
  }
}

async function requestExtraction(tab) {
  try {
    return await chrome.tabs.sendMessage(tab.id, {
      type: "copilot-exporter:run-extraction"
    });
  } catch (error) {
    if (!shouldRetryWithInjection(error, tab.url)) {
      throw error;
    }

    log("No receiver found, injecting content scripts into tab", tab.id);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        "lib/selectors.js",
        "lib/dom-utils.js",
        "lib/link-utils.js",
        "lib/normalize.js",
        "lib/confidence.js",
        "lib/table-utils.js",
        "lib/transcript-split.js",
        "content/extract.js"
      ]
    });

    return chrome.tabs.sendMessage(tab.id, {
      type: "copilot-exporter:run-extraction"
    });
  }
}

function buildUnsupportedPayload(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname === "m365.cloud.microsoft" && url.pathname.startsWith("/chat")) {
      return null;
    }

    if (url.hostname === "copilot.microsoft.com") {
      return {
        meta: {
          sourceUrl: urlString,
          exportedAt: new Date().toISOString(),
          title: null,
          captureWarnings: [
            {
              code: "UNSUPPORTED_PAGE",
              message: "Edge blocks extension scripting on copilot.microsoft.com. Use m365.cloud.microsoft/chat instead."
            }
          ],
          captureConfidence: "low",
          diagnostic: {}
        },
        conversation: { messages: [] }
      };
    }
  } catch (error) {
    log("URL parse failed", error);
  }

  return {
    meta: {
      sourceUrl: urlString,
      exportedAt: new Date().toISOString(),
      title: null,
      captureWarnings: [
        {
          code: "UNSUPPORTED_PAGE",
          message: "This page is not a supported Copilot Chat conversation."
        }
      ],
      captureConfidence: "low",
      diagnostic: {}
    },
    conversation: { messages: [] }
  };
}

async function openPreviewWithPayload(payload) {
  cleanupCache();

  const exportId = crypto.randomUUID();
  exportCache.set(exportId, {
    createdAt: Date.now(),
    payload
  });

  const previewUrl = chrome.runtime.getURL(`preview/preview.html?exportId=${encodeURIComponent(exportId)}`);
  await chrome.tabs.create({ url: previewUrl });
}

function cleanupCache() {
  const now = Date.now();
  for (const [exportId, entry] of exportCache.entries()) {
    if (now - entry.createdAt > EXPORT_CACHE_TTL_MS) {
      exportCache.delete(exportId);
    }
  }
}

function shouldRetryWithInjection(error, urlString) {
  const message = error?.message || String(error || "");
  return message.includes("Receiving end does not exist") && isM365ChatUrl(urlString);
}

function isM365ChatUrl(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname === "m365.cloud.microsoft" && url.pathname.startsWith("/chat");
  } catch (error) {
    return false;
  }
}

function log(...args) {
  if (DEBUG) {
    console.log("[copilot-exporter]", ...args);
  }
}
