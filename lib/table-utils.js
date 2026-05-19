function consumeMarkdownTable(blocks) {
  const output = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const table = tryParseMarkdownTable(blocks, index);
    if (table) {
      output.push({
        type: "table",
        rows: table.rows,
        html: null
      });
      index = table.endIndex;
      continue;
    }

    output.push(blocks[index]);
  }

  return output;
}

function tryParseMarkdownTable(blocks, startIndex) {
  const header = blocks[startIndex];
  const separator = blocks[startIndex + 1];
  if (!isParagraphBlock(header) || !isParagraphBlock(separator)) {
    return null;
  }

  const headerCells = splitMarkdownRow(header.text);
  if (headerCells.length < 2 || !isMarkdownSeparator(separator.text, headerCells.length)) {
    return null;
  }

  const rows = [headerCells];
  let index = startIndex + 2;

  while (index < blocks.length) {
    const candidate = blocks[index];
    if (!isParagraphBlock(candidate)) {
      break;
    }

    const cells = splitMarkdownRow(candidate.text);
    if (cells.length !== headerCells.length) {
      break;
    }

    rows.push(cells);
    index += 1;
  }

  if (rows.length < 2) {
    return null;
  }

  return {
    rows,
    endIndex: index - 1
  };
}

function isParagraphBlock(block) {
  return block?.type === "paragraph" && typeof block.text === "string";
}

function splitMarkdownRow(text) {
  if (!text || !text.includes("|")) {
    return [];
  }

  const trimmed = text.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = trimmed.split("|").map((cell) => cell.trim());
  return cells.filter((cell) => cell.length > 0);
}

function isMarkdownSeparator(text, expectedColumns) {
  const cells = splitMarkdownRow(text);
  if (cells.length !== expectedColumns) {
    return false;
  }

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

if (typeof globalThis !== "undefined") {
  globalThis.CopilotExporter = globalThis.CopilotExporter || {};
  globalThis.CopilotExporter.tableUtils = {
    consumeMarkdownTable
  };
}
