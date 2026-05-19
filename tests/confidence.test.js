import test from "node:test";
import assert from "node:assert/strict";
import { loadGlobalApi } from "./test-helpers.js";

const { computeConfidence } = await loadGlobalApi("../lib/confidence.js", "confidence");

test("computeConfidence returns high for clean extraction", () => {
  const result = computeConfidence({
    messageCount: 4,
    unknownSenderCount: 0,
    timedOut: false,
    parseFailures: 0,
    foundChatShell: true,
    foundConversation: true
  });

  assert.equal(result.confidence, "high");
  assert.equal(result.warnings.length, 0);
});

test("computeConfidence emits timeout and partial warnings", () => {
  const result = computeConfidence({
    messageCount: 1,
    unknownSenderCount: 3,
    timedOut: true,
    parseFailures: 2,
    foundChatShell: true,
    foundConversation: true
  });

  assert.equal(result.confidence, "low");
  assert.deepEqual(
    [...result.warnings.map((warning) => warning.code)],
    ["LOAD_TIMEOUT", "EXTRACTION_PARTIAL"]
  );
});
