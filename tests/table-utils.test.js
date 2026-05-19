import test from "node:test";
import assert from "node:assert/strict";
import { loadGlobalApi } from "./test-helpers.js";

const { consumeMarkdownTable } = await loadGlobalApi("../lib/table-utils.js", "tableUtils");

test("consumeMarkdownTable converts markdown-style paragraph rows into a table block", () => {
  const blocks = [
    { type: "paragraph", text: "| Name | Role |" },
    { type: "paragraph", text: "| --- | --- |" },
    { type: "paragraph", text: "| Keir Starmer | Prime Minister |" },
    { type: "paragraph", text: "Following paragraph" }
  ];

  const result = consumeMarkdownTable(blocks);
  assert.equal(result.length, 2);
  assert.equal(result[0].type, "table");
  assert.deepEqual([...result[0].rows[0]], ["Name", "Role"]);
  assert.deepEqual([...result[0].rows[1]], ["Keir Starmer", "Prime Minister"]);
  assert.equal(result[1].text, "Following paragraph");
});
