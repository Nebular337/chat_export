import test from "node:test";
import assert from "node:assert/strict";
import fixture from "./fixtures/conversation-sample.json" with { type: "json" };
import { loadGlobalApi } from "./test-helpers.js";

const { normalizeTranscript } = await loadGlobalApi("../lib/normalize.js", "normalize");

test("normalizeTranscript dedupes repeated paragraph blocks and links", () => {
  const normalized = normalizeTranscript(fixture);

  assert.equal(normalized.conversation.messages.length, 2);
  assert.equal(normalized.conversation.messages[1].blocks.length, 3);
  assert.equal(normalized.conversation.messages[1].blocks[2].type, "bulleted_list");
  assert.deepEqual([...normalized.conversation.messages[1].blocks[2].items], ["Timeline", "Risks"]);
  assert.equal(normalized.conversation.messages[1].links.length, 1);
});

test("normalizeTranscript assigns fallback ids and sender classification", () => {
  const normalized = normalizeTranscript({
    meta: {},
    messages: [
      {
        sender: "mystery",
        text: "Hello world",
        blocks: [],
        links: []
      }
    ]
  });

  assert.equal(normalized.conversation.messages[0].id, "msg_001");
  assert.equal(normalized.conversation.messages[0].sender, "system/unknown");
});

test("normalizeTranscript strips extracted html markup from blocks", () => {
  const normalized = normalizeTranscript({
    meta: {},
    messages: [
      {
        sender: "copilot",
        blocks: [
          {
            type: "paragraph",
            text: "Safe text",
            html: "<img src=x onerror=alert(1)>"
          }
        ],
        links: []
      }
    ]
  });

  assert.equal(normalized.conversation.messages[0].blocks[0].html, null);
});
