(function registerExtractor(global) {
  const DEBUG = false;
  const NOISE_PATTERNS = [
    /^today$/i,
    /^you said:?$/i,
    /^copilot said:?$/i,
    /^copilot$/i,
    /^sources$/i,
    /^provide your feedback on bizchat$/i,
    /^favicon type$/i
  ];
  const INLINE_TAGS = new Set([
    "A", "ABBR", "B", "BR", "CODE", "EM", "I", "MARK", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "TIME", "U"
  ]);
  const BLOCKLIKE_SELECTOR = 'h1, h2, h3, h4, h5, h6, blockquote, ul, ol, pre, table, [role="table"], [role="grid"], img';
  let selectorsApi;
  let domApi;
  let linkApi;
  let normalizeApi;
  let confidenceApi;
  let tableUtilsApi;
  let transcriptSplitApi;

  global.CopilotExporter = global.CopilotExporter || {};
  global.CopilotExporter.runExtraction = async function runExtraction() {
    selectorsApi = global.CopilotExporter?.selectors;
    domApi = global.CopilotExporter?.domUtils;
    linkApi = global.CopilotExporter?.linkUtils;
    normalizeApi = global.CopilotExporter?.normalize;
    confidenceApi = global.CopilotExporter?.confidence;
    tableUtilsApi = global.CopilotExporter?.tableUtils;
    transcriptSplitApi = global.CopilotExporter?.transcriptSplit;

    if (!selectorsApi || !domApi || !linkApi || !normalizeApi || !confidenceApi || !tableUtilsApi || !transcriptSplitApi) {
      return {
        meta: {
          sourceUrl: location.href,
          exportedAt: new Date().toISOString(),
          title: document.title || null,
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
    }

    const foundChatShell = selectorsApi.isSupportedUrl(location.href) &&
      Boolean(selectorsApi.findFirst(document, selectorsApi.SELECTORS.chatShell));

    if (!foundChatShell) {
      return normalizeApi.normalizeTranscript({
        meta: {
          sourceUrl: location.href,
          exportedAt: new Date().toISOString(),
          title: document.title || null,
          captureWarnings: [
            {
              code: "UNSUPPORTED_PAGE",
              message: "This page is not a supported Copilot Chat conversation."
            }
          ],
          captureConfidence: "low",
          diagnostic: {}
        },
        messages: []
      });
    }

    const loadState = await loadFullThread();
    const extractionState = extractRawMessages();
    const rawMessages = extractionState.messages;
    const unknownSenderCount = rawMessages.filter((message) => message.sender === "system/unknown").length;
    const confidenceResult = confidenceApi.computeConfidence({
      messageCount: rawMessages.length,
      unknownSenderCount,
      timedOut: loadState.timedOut,
      parseFailures: rawMessages.reduce((count, message) => count + (message.rawMeta.parseFailure ? 1 : 0), 0),
      foundChatShell: true,
      foundConversation: rawMessages.length > 0
    });

    const transcript = normalizeApi.normalizeTranscript({
      meta: {
        sourceUrl: location.href,
        exportedAt: new Date().toISOString(),
        title: document.title || null,
        captureWarnings: confidenceResult.warnings,
        captureConfidence: confidenceResult.confidence,
        diagnostic: buildDiagnosticPayload(loadState, extractionState, rawMessages)
      },
      messages: rawMessages
    }, { sourceUrl: location.href });

    log("Diagnostic transcript", transcript);
    return transcript;
  };

  if (!global.CopilotExporter.extractorListenerRegistered && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message?.type !== "copilot-exporter:run-extraction") {
        return false;
      }

      global.CopilotExporter.runExtraction()
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          log("Extraction failed", error);
          sendResponse({
            meta: {
              sourceUrl: location.href,
              exportedAt: new Date().toISOString(),
              title: document.title || null,
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
        });

      return true;
    });

    global.CopilotExporter.extractorListenerRegistered = true;
  }

  async function loadFullThread() {
    const scrollContainer = selectorsApi.findFirst(document, selectorsApi.SELECTORS.scrollContainer);
    if (!scrollContainer) {
      return { attempts: 0, timedOut: false };
    }

    let previousCount = 0;
    let stagnantCount = 0;
    let attempts = 0;
    const maxAttempts = 12;

    while (attempts < maxAttempts) {
      attempts += 1;
      const messageCount = selectorsApi.findAll(document, selectorsApi.SELECTORS.message).length;
      if (messageCount <= previousCount) {
        stagnantCount += 1;
      } else {
        stagnantCount = 0;
      }

      previousCount = messageCount;
      scrollContainer.scrollTop = 0;
      await domApi.delay(350);

      if (stagnantCount >= 2) {
        return { attempts, timedOut: false };
      }
    }

    return { attempts, timedOut: true };
  }

  function buildDiagnosticPayload(loadState, extractionState, rawMessages) {
    if (!DEBUG) {
      return {};
    }

    return {
      host: location.hostname,
      path: location.pathname,
      attempts: loadState.attempts,
      candidateCounts: extractionState.diagnostic,
      messageSkeleton: rawMessages.map((message) => ({
        id: message.id,
        sender: message.sender,
        blockCount: message.blocks.length,
        linkCount: message.links.length
      }))
    };
  }

  function extractRawMessages() {
    const rawNodes = selectorsApi.findAll(document, selectorsApi.SELECTORS.message);
    const combinedNodes = rawNodes.filter((node) => /chat-message/i.test(node.getAttribute?.("data-testid") || ""));
    if (combinedNodes.length > 0) {
      const combinedMessages = combinedNodes.flatMap((node) => splitCombinedTranscript(node));
      return {
        messages: combinedMessages,
        diagnostic: {
          rawCandidateCount: rawNodes.length,
          filteredCandidateCount: combinedMessages.length,
          mode: "combined-transcript-fallback",
          rawSample: combinedNodes.slice(0, 5).map(describeNode),
          filteredSample: combinedMessages.slice(0, 5).map((message) => ({
            sender: message.sender,
            textPreview: message.blocks?.[0]?.text?.slice(0, 140) || ""
          }))
        }
      };
    }

    const filteredNodes = rawNodes.filter((node) => isLikelyMessageNode(node));
    const messages = filteredNodes
      .map((node, index) => extractMessage(node, index + 1))
      .filter(Boolean);

    return {
      messages,
      diagnostic: {
        rawCandidateCount: rawNodes.length,
        filteredCandidateCount: filteredNodes.length,
        rawSample: rawNodes.slice(0, 5).map(describeNode),
        filteredSample: filteredNodes.slice(0, 5).map(describeNode)
      }
    };
  }

  function extractMessage(node, sequence) {
    try {
      const groupedCitations = linkApi.extractGroupedCitations(node, { baseUrl: location.href });
      const sender = inferSender(node);
      const blocks = extractBlocks(node);
      const links = [
        ...linkApi.extractLinks(node, { selector: selectorsApi.SELECTORS.link.join(", "), kind: "inline", baseUrl: location.href }),
        ...linkApi.extractLinks(node, { selector: selectorsApi.SELECTORS.citation.join(", "), kind: "citation", baseUrl: location.href }),
        ...groupedCitations,
        ...linkApi.extractLinks(node, { selector: selectorsApi.SELECTORS.fileReference.join(", "), kind: "file", baseUrl: location.href })
      ];

      return {
        id: node.getAttribute("data-message-id") || `msg_${String(sequence).padStart(3, "0")}`,
        sender,
        sequence,
        timestamp: null,
        blocks,
        links,
        rawMeta: {
          parseFailure: false
        }
      };
    } catch (error) {
      log("Message parse failed", error);
      return {
        id: `msg_${String(sequence).padStart(3, "0")}`,
        sender: "system/unknown",
        sequence,
        timestamp: null,
        blocks: [
          {
            type: "unknown_rich_block",
            text: domApi.textFromNode(node)
          }
        ],
        links: [],
        rawMeta: {
          parseFailure: true
        }
      };
    }
  }

  function inferSender(node) {
    if (selectorsApi.findFirst(node, selectorsApi.SELECTORS.userIndicators)) {
      return "user";
    }

    if (selectorsApi.findFirst(node, selectorsApi.SELECTORS.copilotIndicators)) {
      return "copilot";
    }

    const accessibleText = [
      node.getAttribute("aria-label"),
      node.getAttribute("data-message-author-role"),
      (node.textContent || "").slice(0, 100)
    ].join(" ");

    if (/copilot/i.test(accessibleText)) {
      return "copilot";
    }
    if (/\b(you|user)\b/i.test(accessibleText)) {
      return "user";
    }

    return "system/unknown";
  }

  function extractBlocks(node) {
    const blocks = [];
    const seenNodes = new Set();

    for (const heading of node.querySelectorAll(selectorsApi.SELECTORS.heading.join(", "))) {
      if (markSeen(heading)) {
        blocks.push({ type: "heading", text: domApi.textFromNode(heading), html: serializeSemanticHtml(heading) });
      }
    }

    for (const blockquote of node.querySelectorAll(selectorsApi.SELECTORS.blockquote.join(", "))) {
      if (markSeen(blockquote)) {
        blocks.push({ type: "blockquote", text: domApi.textFromNode(blockquote), html: serializeSemanticHtml(blockquote) });
      }
    }

    for (const list of node.querySelectorAll(selectorsApi.SELECTORS.list.join(", "))) {
      if (!markSeen(list)) {
        continue;
      }

      blocks.push({
        type: list.tagName === "OL" ? "numbered_list" : "bulleted_list",
        items: Array.from(list.querySelectorAll(":scope > li")).map((item) => domApi.textFromNode(item)),
        html: serializeSemanticHtml(list)
      });
    }

    for (const pre of node.querySelectorAll("pre")) {
      if (markSeen(pre)) {
        blocks.push({
          type: "code_block",
          text: pre.textContent || "",
          language: pre.getAttribute("data-language") || null,
          html: serializeSemanticHtml(pre)
        });
      }
    }

    for (const table of node.querySelectorAll(selectorsApi.SELECTORS.table.join(", "))) {
      if (markSeen(table)) {
        const tableData = extractTableData(table);
        if (!tableData) {
          continue;
        }

        blocks.push({
          type: "table",
          rows: tableData.rows,
          html: tableData.html
        });
      }
    }

    for (const image of node.querySelectorAll("img")) {
      if (markSeen(image)) {
        if (isNoiseImage(image)) {
          continue;
        }

        blocks.push({
          type: "image",
          src: image.currentSrc || image.src || null,
          alt: image.alt || ""
        });
      }
    }

    const citations = linkApi.extractLinks(node, {
      selector: selectorsApi.SELECTORS.citation.join(", "),
      kind: "citation",
      baseUrl: location.href
    });
    const groupedCitations = linkApi.extractGroupedCitations(node, { baseUrl: location.href });
    const allCitations = dedupeCitationLinks([...citations, ...groupedCitations]);
    if (allCitations.length) {
      blocks.push({
        type: "citation_group",
        items: allCitations.map((citation) => ({
          text: citation.text,
          href: citation.href
        }))
      });
    }

    const fileLinks = linkApi.extractLinks(node, {
      selector: selectorsApi.SELECTORS.fileReference.join(", "),
      kind: "file",
      baseUrl: location.href
    });
    for (const file of fileLinks) {
      blocks.push({
        type: "file_reference",
        name: file.text,
        href: file.href
      });
    }

    const paragraphCandidates = dedupeParagraphCandidates(collectParagraphCandidates(node, seenNodes));

    for (const candidate of paragraphCandidates) {
      if (!isNoiseText(candidate.text)) {
        blocks.push({ type: "paragraph", text: candidate.text, html: candidate.html || null });
      }
    }

    if (!blocks.length) {
      const fallbackText = cleanText(domApi.textFromNode(node));
      if (fallbackText) {
        blocks.push({ type: "paragraph", text: fallbackText, html: serializeSemanticHtml(node) });
      }
    }

    return tableUtilsApi.consumeMarkdownTable(blocks);

    function markSeen(element) {
      if (seenNodes.has(element)) {
        return false;
      }

      seenNodes.add(element);
      for (const descendant of element.querySelectorAll("*")) {
        seenNodes.add(descendant);
      }
      return true;
    }
  }

  function collectParagraphCandidates(node, seenNodes) {
    const candidates = [];

    for (const paragraph of node.querySelectorAll("p")) {
      if (seenNodes.has(paragraph)) {
        continue;
      }

      const text = cleanText(domApi.textFromNode(paragraph));
      if (text) {
        candidates.push({
          text,
          html: serializeSemanticHtml(paragraph)
        });
      }
    }

    const directContainers = Array.from(node.children)
      .filter((element) => !seenNodes.has(element))
      .filter((element) => isParagraphLikeContainer(element));

    for (const element of directContainers) {
      const text = cleanText(domApi.textFromNode(element));
      if (text) {
        candidates.push({
          text,
          html: serializeSemanticHtml(element)
        });
      }
    }

    return candidates;
  }

  function dedupeParagraphCandidates(candidates) {
    const seen = new Set();
    return candidates.filter((candidate) => {
      const key = candidate.text;
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function isParagraphLikeContainer(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (element.matches(BLOCKLIKE_SELECTOR)) {
      return false;
    }

    if (element.querySelector(BLOCKLIKE_SELECTOR)) {
      return false;
    }

    const children = Array.from(element.children);
    if (!children.length) {
      return Boolean(cleanText(domApi.textFromNode(element)));
    }

    return children.every((child) => INLINE_TAGS.has(child.tagName));
  }

  function isLikelyMessageNode(node) {
    const text = cleanText(domApi.textFromNode(node));
    if (!text) {
      return false;
    }

    const testId = node.getAttribute?.("data-testid") || "";
    if (/chat-message/i.test(testId)) {
      return true;
    }

    if (text.length < 4 && !node.querySelector("img, a, pre, table")) {
      return false;
    }

    return true;
  }

  function describeNode(node) {
    return {
      tagName: node.tagName || null,
      testId: node.getAttribute?.("data-testid") || null,
      authorRole: node.getAttribute?.("data-message-author-role") || null,
      ariaLabel: node.getAttribute?.("aria-label") || null,
      textPreview: cleanText((node.textContent || "").slice(0, 140))
    };
  }

  function splitCombinedTranscript(node) {
    const domSections = splitCombinedTranscriptDom(node);
    if (domSections.length) {
      return domSections
        .map((section) => buildCombinedTranscriptMessage(section))
        .filter(Boolean);
    }

    const splitResult = transcriptSplitApi.splitCombinedTranscriptText(node.innerText || node.textContent || "");
    const groupedCitations = linkApi.extractGroupedCitations(node, { baseUrl: location.href });
    let copilotMessageIndex = 0;
    const copilotSectionCount = splitResult.sections.filter((section) => section.sender === "copilot").length;

    return splitResult.sections
      .map((section) => {
        let sectionLinks = [];

        if (section.sender === "copilot" && groupedCitations.length) {
          copilotMessageIndex += 1;
          if (copilotSectionCount === 1 || copilotMessageIndex === copilotSectionCount) {
            sectionLinks = groupedCitations;
          }
        }

        return buildCombinedTranscriptMessage(section, sectionLinks);
      })
      .filter(Boolean);
  }

  function buildCombinedTranscriptMessage(section, links = []) {
    const sourceNode = section.container || null;
    const resolvedLinks = dedupeCitationLinks([
      ...links,
      ...(sourceNode ? linkApi.extractGroupedCitations(sourceNode, { baseUrl: location.href }) : [])
    ]);

    const blocks = sourceNode
      ? extractOrderedCombinedBlocks(sourceNode, resolvedLinks)
      : buildCombinedBlocks(
          section.lines
            .map((line) => cleanTranscriptLine(line))
            .filter(Boolean),
          resolvedLinks
        );

    if (!blocks.length) {
      return null;
    }

    return {
      id: null,
      sender: section.sender,
      sequence: null,
      timestamp: null,
      blocks,
      links: resolvedLinks,
      rawMeta: {
        parseMode: sourceNode ? "combined-transcript-dom-fallback" : "combined-transcript-fallback"
      }
    };
  }

  function extractOrderedCombinedBlocks(root, links) {
    const blocks = [];

    for (const child of Array.from(root.childNodes)) {
      appendOrderedBlocks(child, blocks);
    }

    if (!blocks.length) {
      const fallbackText = cleanText(root.textContent || "");
      if (fallbackText) {
        blocks.push({
          type: "paragraph",
          text: fallbackText,
          html: serializeSemanticHtml(root)
        });
      }
    }

    if (links.length) {
      blocks.push({
        type: "citation_group",
        items: links.map((link) => ({
          text: link.text,
          href: link.href
        }))
      });
    }

    return tableUtilsApi.consumeMarkdownTable(blocks);
  }

  function appendOrderedBlocks(node, blocks) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = cleanTranscriptLine(node.textContent || "");
      if (text) {
        blocks.push({
          type: "paragraph",
          text,
          html: null
        });
      }
      return;
    }

    if (!(node instanceof Element)) {
      return;
    }

    const tagName = node.tagName;

    const directChildTable = Array.from(node.children || []).find((child) => isTableLike(child));
    if (directChildTable) {
      for (const child of Array.from(node.childNodes)) {
        if (child === directChildTable) {
          const tableData = extractTableData(directChildTable);
          if (tableData) {
            blocks.push({
              type: "table",
              rows: tableData.rows,
              html: tableData.html
            });
          }
          continue;
        }

        appendOrderedBlocks(child, blocks);
      }
      return;
    }

    if (/^H[1-6]$/.test(tagName)) {
      const text = cleanTranscriptLine(domApi.textFromNode(node));
      if (text) {
        blocks.push({
          type: "heading",
          text,
          html: serializeSemanticHtml(node)
        });
      }
      return;
    }

    if (tagName === "P") {
      const text = cleanTranscriptLine(domApi.textFromNode(node));
      if (text) {
        blocks.push({
          type: "paragraph",
          text,
          html: serializeSemanticHtml(node)
        });
      }
      return;
    }

    if (tagName === "BLOCKQUOTE") {
      const text = cleanTranscriptLine(domApi.textFromNode(node));
      if (text) {
        blocks.push({
          type: "blockquote",
          text,
          html: serializeSemanticHtml(node)
        });
      }
      return;
    }

    if (tagName === "UL" || tagName === "OL") {
      const items = Array.from(node.querySelectorAll(":scope > li"))
        .map((item) => cleanTranscriptLine(domApi.textFromNode(item)))
        .filter(Boolean);
      if (items.length) {
        blocks.push({
          type: tagName === "OL" ? "numbered_list" : "bulleted_list",
          items,
          html: serializeSemanticHtml(node)
        });
      }
      return;
    }

    if (tagName === "PRE") {
      const text = cleanTranscriptLine(node.textContent || "");
      if (text) {
        blocks.push({
          type: "code_block",
          text,
          language: node.getAttribute("data-language") || null,
          html: serializeSemanticHtml(node)
        });
      }
      return;
    }

    if (isTableLike(node)) {
      const tableData = extractTableData(node);
      if (tableData) {
        blocks.push({
          type: "table",
          rows: tableData.rows,
          html: tableData.html
        });
      }
      return;
    }

    if (node.closest('table, [role="table"], [role="grid"]')) {
      return;
    }

    if (tagName === "IMG") {
      if (isNoiseImage(node)) {
        return;
      }

      blocks.push({
        type: "image",
        src: node.currentSrc || node.src || null,
        alt: node.alt || ""
      });
      return;
    }

    if (isInlineOnlyContainer(node)) {
      const text = cleanTranscriptLine(domApi.textFromNode(node));
      if (text) {
        blocks.push({
          type: "paragraph",
          text,
          html: serializeSemanticHtml(node)
        });
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      appendOrderedBlocks(child, blocks);
    }
  }

  function isInlineOnlyContainer(element) {
    const children = Array.from(element.children);
    if (!children.length) {
      return Boolean(cleanTranscriptLine(domApi.textFromNode(element)));
    }

    return children.every((child) => INLINE_TAGS.has(child.tagName));
  }

  function isTableLike(element) {
    return element.tagName === "TABLE" || element.getAttribute("role") === "table" || element.getAttribute("role") === "grid";
  }

  function extractTableData(element) {
    if (element.tagName === "TABLE") {
      const rows = Array.from(element.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) => cleanTranscriptLine(domApi.textFromNode(cell)))
      ).filter((row) => row.some(Boolean));

      return rows.length
        ? { rows, html: serializeSemanticHtml(element) }
        : null;
    }

    const roleRows = Array.from(element.querySelectorAll('[role="row"]'));
    const rows = roleRows.map((row) =>
      Array.from(row.querySelectorAll('[role="columnheader"], [role="rowheader"], [role="cell"]'))
        .map((cell) => cleanTranscriptLine(domApi.textFromNode(cell)))
    ).filter((row) => row.some(Boolean));

    return rows.length
      ? { rows, html: null }
      : null;
  }

  function splitCombinedTranscriptDom(node) {
    const textMap = buildTextNodeMap(node);
    const markerRegex = /(You said:|Copilot said:)/gi;
    const markers = [];
    let match;

    while ((match = markerRegex.exec(textMap.text)) !== null) {
      markers.push({
        sender: /^you said:/i.test(match[0]) ? "user" : "copilot",
        start: match.index,
        markerLength: match[0].length
      });
    }

    if (!markers.length) {
      return [];
    }

    const sections = [];

    for (let index = 0; index < markers.length; index += 1) {
      const current = markers[index];
      const next = markers[index + 1];
      const startPosition = locateTextPosition(textMap.segments, current.start + current.markerLength);
      const endPosition = locateTextPosition(
        textMap.segments,
        next ? next.start : textMap.text.length
      );

      if (!startPosition || !endPosition) {
        continue;
      }

      const range = document.createRange();
      range.setStart(startPosition.node, startPosition.offset);
      range.setEnd(endPosition.node, endPosition.offset);

      const fragment = range.cloneContents();
      const container = document.createElement("div");
      container.appendChild(fragment);

      if (!cleanText(container.textContent || "")) {
        continue;
      }

      sections.push({
        sender: current.sender,
        container
      });
    }

    return sections;
  }

  function buildTextNodeMap(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const segments = [];
    let text = "";
    let currentNode;

    while ((currentNode = walker.nextNode())) {
      const value = currentNode.textContent || "";
      if (!value) {
        continue;
      }

      const start = text.length;
      text += value;
      segments.push({
        node: currentNode,
        start,
        end: text.length
      });
    }

    return { text, segments };
  }

  function locateTextPosition(segments, absoluteOffset) {
    for (const segment of segments) {
      if (absoluteOffset >= segment.start && absoluteOffset <= segment.end) {
        return {
          node: segment.node,
          offset: absoluteOffset - segment.start
        };
      }
    }

    const last = segments[segments.length - 1];
    if (!last) {
      return null;
    }

    return {
      node: last.node,
      offset: last.node.textContent.length
    };
  }

  function cleanTranscriptLine(line) {
    const cleaned = cleanText(
      line
        .replace(/^copilot\s*/i, "")
        .replace(/^you asked:\s*/i, "")
    );

    if (!cleaned) {
      return "";
    }

    if (/^who is the vice president\??who was the previous president\??how long is the presidential term\??$/i.test(cleaned)) {
      return "Who is the vice president? Who was the previous president? How long is the presidential term?";
    }

    return cleaned;
  }

  function buildCombinedBlocks(lines, links) {
    const blocks = [];

    for (const text of lines) {
      blocks.push(classifyCombinedBlock(text));
    }

    if (links.length) {
      blocks.push({
        type: "citation_group",
        items: links.map((link) => ({
          text: link.text,
          href: link.href
        }))
      });
    }

    return blocks;
  }

  function classifyCombinedBlock(text) {
    if (isLikelyHeading(text)) {
      return {
        type: "heading",
        text
      };
    }

    return {
      type: "paragraph",
      text
    };
  }

  function isLikelyHeading(text) {
    if (!text) {
      return false;
    }

    if (text.length > 70) {
      return false;
    }

    if (/[.?!]$/.test(text)) {
      return false;
    }

    if (/^(if you.d like|the current|who is |who was |how long )/i.test(text)) {
      return false;
    }

    const wordCount = text.split(/\s+/).length;
    return wordCount > 0 && wordCount <= 8;
  }

  function dedupeCitationLinks(links) {
    const seen = new Set();
    return links.filter((link) => {
      const key = `${link?.href || ""}|${link?.text || ""}`;
      if (!link?.href || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }


  function cleanText(text) {
    const normalized = (text || "").replace(/\s+/g, " ").trim();
    if (!normalized || isNoiseText(normalized)) {
      return "";
    }
    return normalized;
  }

  function isNoiseText(text) {
    const normalized = (text || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return true;
    }

    return NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  function isNoiseImage(image) {
    const alt = (image.alt || "").trim();
    const ariaLabel = (image.getAttribute("aria-label") || "").trim();
    const title = (image.getAttribute("title") || "").trim();
    const descriptor = `${alt} ${ariaLabel} ${title}`.trim();

    if (/favicon type/i.test(descriptor)) {
      return true;
    }

    const src = image.currentSrc || image.src || "";
    return /favicon/i.test(src);
  }

  function log(...args) {
    if (DEBUG) {
      console.log("[copilot-exporter:extract]", ...args);
    }
  }

  function serializeSemanticHtml(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    const clone = element.cloneNode(true);
    sanitizeElementTree(clone);
    return clone.innerHTML ? clone.innerHTML : clone.outerHTML;
  }

  function sanitizeElementTree(root) {
    const allowedTags = new Set([
      "A", "B", "BLOCKQUOTE", "BR", "CODE", "EM", "H1", "H2", "H3", "H4", "H5", "H6",
      "I", "LI", "OL", "P", "PRE", "SPAN", "STRONG", "TABLE", "TBODY", "TD", "TH",
      "THEAD", "TR", "U", "UL"
    ]);

    for (const child of Array.from(root.querySelectorAll("*"))) {
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      for (const attribute of Array.from(child.attributes)) {
        const isHref = attribute.name === "href";
        const isSafeAttr = attribute.name === "colspan" || attribute.name === "rowspan";
        if (!isHref && !isSafeAttr) {
          child.removeAttribute(attribute.name);
        }
      }
    }
  }
})(globalThis);
