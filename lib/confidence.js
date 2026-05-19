function computeConfidence({
  messageCount = 0,
  unknownSenderCount = 0,
  timedOut = false,
  parseFailures = 0,
  foundChatShell = false,
  foundConversation = false
} = {}) {
  let score = 1;
  const warnings = [];

  if (!foundChatShell) {
    score -= 0.5;
    warnings.push({
      code: "UNSUPPORTED_PAGE",
      message: "This page is not a supported Copilot Chat conversation."
    });
  }

  if (foundChatShell && !foundConversation) {
    score -= 0.45;
    warnings.push({
      code: "NO_OPEN_CHAT",
      message: "Open a conversation first, then try again."
    });
  }

  if (timedOut) {
    score -= 0.25;
    warnings.push({
      code: "LOAD_TIMEOUT",
      message: "The conversation may be incomplete."
    });
  }

  if (parseFailures > 0) {
    score -= Math.min(parseFailures * 0.1, 0.25);
    warnings.push({
      code: "EXTRACTION_PARTIAL",
      message: "Some content may be simplified or missing."
    });
  }

  if (messageCount === 0 && foundConversation) {
    score -= 0.3;
    warnings.push({
      code: "EXTRACTION_PARTIAL",
      message: "No exportable messages were detected."
    });
  }

  if (unknownSenderCount > 0) {
    score -= Math.min(unknownSenderCount * 0.05, 0.2);
  }

  const confidence = score >= 0.75 ? "high" : score >= 0.45 ? "medium" : "low";

  return {
    confidence,
    warnings: dedupeWarnings(warnings)
  };
}

function dedupeWarnings(warnings) {
  const seen = new Set();
  return warnings.filter((warning) => {
    const key = `${warning.code}|${warning.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

if (typeof globalThis !== "undefined") {
  globalThis.CopilotExporter = globalThis.CopilotExporter || {};
  globalThis.CopilotExporter.confidence = {
    computeConfidence
  };
}
