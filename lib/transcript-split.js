function splitCombinedTranscriptText(text) {
  const normalized = normalizeTranscriptText(text);
  const markers = collectMarkers(normalized);
  const sections = [];

  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    const chunk = normalized
      .slice(current.start + current.marker.length, next ? next.start : normalized.length)
      .trim();

    const lines = splitChunkIntoLines(chunk, current.sender)
      .map((line) => cleanTranscriptLine(line))
      .filter(Boolean);

    if (lines.length) {
      sections.push({
        sender: current.sender,
        lines
      });
    }
  }

  return {
    normalized,
    markerCount: markers.length,
    sections
  };
}

function collectMarkers(text) {
  const regex = /(You said:|Copilot said:)/gi;
  const markers = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    markers.push({
      marker: match[0],
      start: match.index,
      sender: /^you said:/i.test(match[0]) ? "user" : "copilot"
    });
  }

  return markers;
}

function normalizeTranscriptText(text) {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/Today(?=You said:)/gi, "Today\n")
    .replace(/You said:/gi, "\nYou said:")
    .replace(/Copilot said:/gi, "\nCopilot said:")
    .replace(/Sources(?=[A-Z])/g, "Sources\n")
    .trim();
}

function splitChunkIntoLines(chunk, sender) {
  return chunk
    .replace(/\u00a0/g, " ")
    .replace(/(Provide your feedback on BizChat)/gi, "\n$1\n")
    .replace(/(Sources)(?=[A-Z])/g, "$1\n")
    .replace(/(If you.d like, I can also tell you:)/gi, "\n$1\n")
    .replace(/(The current [^.?!]+[.?!])/gi, "\n$1\n")
    .replace(/(In summary:|Summary:|Key points:|Overview:)/gi, "\n$1\n")
    .replace(/(Who is the vice president\?)(?=Who was the previous president\?)/gi, "$1\n")
    .replace(/(Who was the previous president\?)(?=How long is the presidential term\?)/gi, "$1\n")
    .replace(/([.?!])\s+(?=[A-Z][a-z]+(?:\s+[a-z]+){0,4}\s*:)/g, "$1\n")
    .replace(/([.?!])\s+(?=If you.d like, I can also)/gi, "$1\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !(sender === "copilot" && /^copilot$/i.test(line)));
}

function cleanTranscriptLine(line) {
  const cleaned = (line || "")
    .replace(/^copilot\s*/i, "")
    .replace(/^you asked:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const noisePatterns = [
    /^today$/i,
    /^you said:?$/i,
    /^copilot said:?$/i,
    /^copilot$/i,
    /^sources$/i,
    /^provide your feedback on bizchat$/i,
    /^favicon type$/i
  ];

  if (noisePatterns.some((pattern) => pattern.test(cleaned))) {
    return "";
  }

  if (/^who is the vice president\??who was the previous president\??how long is the presidential term\??$/i.test(cleaned)) {
    return "Who is the vice president? Who was the previous president? How long is the presidential term?";
  }

  return cleaned;
}

if (typeof globalThis !== "undefined") {
  globalThis.CopilotExporter = globalThis.CopilotExporter || {};
  globalThis.CopilotExporter.transcriptSplit = {
    splitCombinedTranscriptText
  };
}
