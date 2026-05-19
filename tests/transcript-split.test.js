import test from "node:test";
import assert from "node:assert/strict";
import { loadGlobalApi } from "./test-helpers.js";

const { splitCombinedTranscriptText } = await loadGlobalApi("../lib/transcript-split.js", "transcriptSplit");

test("splitCombinedTranscriptText splits concatenated M365 wrapper text into user and copilot sections", () => {
  const result = splitCombinedTranscriptText(
    "TodayYou said: who is the UK prime minister?Copilot said: CopilotThe current UK Prime Minister is Keir Starmer, who has been in office since July 2024."
  );

  assert.equal(result.markerCount, 2);
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0].sender, "user");
  assert.deepEqual([...result.sections[0].lines], ["who is the UK prime minister?"]);
  assert.equal(result.sections[1].sender, "copilot");
  assert.match(result.sections[1].lines[0], /Keir Starmer/);
});

test("splitCombinedTranscriptText handles multiple question answer pairs in one combined transcript", () => {
  const result = splitCombinedTranscriptText(
    "TodayYou said: who is the UK prime minister?Copilot said: CopilotThe current UK Prime Minister is Keir Starmer.You said: who is his wife?Copilot said: CopilotKeir Starmer's wife is Victoria Starmer."
  );

  assert.equal(result.markerCount, 4);
  assert.equal(result.sections.length, 4);
  assert.deepEqual(
    [...result.sections.map((section) => section.sender)],
    ["user", "copilot", "user", "copilot"]
  );
  assert.deepEqual([...result.sections[0].lines], ["who is the UK prime minister?"]);
  assert.deepEqual([...result.sections[2].lines], ["who is his wife?"]);
  assert.match(result.sections[3].lines[0], /Victoria Starmer/);
});
