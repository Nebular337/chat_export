(function initSelectors(global) {
  const DEBUG = false;

  const SUPPORTED_HOSTS = [
    {
      hostname: "m365.cloud.microsoft",
      pathPatterns: [/^\/chat(?:\/|$)/]
    }
  ];

  const SELECTORS = {
    chatShell: [
      '[data-testid="chat-page"]',
      '[data-testid="conversation-view"]',
      '[role="main"]',
      "main",
      ".conversation-container"
    ],
    scrollContainer: [
      '[data-testid="conversation-scroll-container"]',
      '[data-testid="conversation-view"]',
      '[role="main"]',
      "main",
      ".conversation-container"
    ],
    message: [
      '[data-testid*="message"]',
      "[data-message-author-role]",
      '[role="article"]',
      "article",
      '[data-content="conversation-turn"]',
      ".message",
      ".conversation-turn"
    ],
    userIndicators: [
      '[data-message-author-role="user"]',
      '[aria-label*="You" i]',
      '[aria-label*="User" i]',
      '[data-author="user"]'
    ],
    copilotIndicators: [
      '[data-message-author-role="assistant"]',
      '[data-message-author-role="copilot"]',
      '[aria-label*="Copilot" i]',
      '[data-author="assistant"]'
    ],
    citation: [
      '[data-testid*="citation"] a[href]',
      "sup a[href]",
      ".citation a[href]"
    ],
    codeBlock: ["pre", "code"],
    table: ['table', '[role="table"]', '[role="grid"]'],
    heading: ["h1, h2, h3, h4, h5, h6"],
    blockquote: ["blockquote"],
    list: ["ul, ol"],
    link: ['a[href]'],
    fileReference: [
      "[download]",
      '[data-testid*="file"] a[href]',
      ".file-reference a[href]"
    ],
    image: ["img"]
  };

  function isSupportedUrl(urlString) {
    try {
      const url = new URL(urlString);
      return SUPPORTED_HOSTS.some((entry) => (
        entry.hostname === url.hostname &&
        entry.pathPatterns.some((pattern) => pattern.test(url.pathname))
      ));
    } catch (error) {
      log("Failed to parse URL", error);
      return false;
    }
  }

  function findFirst(root, selectorList) {
    for (const selector of selectorList) {
      const match = root.querySelector(selector);
      if (match) {
        return match;
      }
    }
    return null;
  }

  function findAll(root, selectorList) {
    const matches = [];
    const seen = new Set();

    for (const selector of selectorList) {
      const nodes = root.querySelectorAll(selector);
      for (const node of nodes) {
        if (!seen.has(node)) {
          seen.add(node);
          matches.push(node);
        }
      }
    }

    return matches.filter((node) => !matches.some((other) => other !== node && other.contains(node)));
  }

  function log(...args) {
    if (DEBUG) {
      console.log("[copilot-exporter:selectors]", ...args);
    }
  }

  global.CopilotExporter = global.CopilotExporter || {};
  global.CopilotExporter.selectors = {
    DEBUG,
    SUPPORTED_HOSTS,
    SELECTORS,
    isSupportedUrl,
    findFirst,
    findAll
  };
})(globalThis);
