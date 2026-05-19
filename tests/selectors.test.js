import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

test("selectors recognize supported URLs", async () => {
  const source = await fs.readFile(path.join(__dirname, "../lib/selectors.js"), "utf8");
  const context = {
    globalThis: {},
    console,
    URL
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const { isSupportedUrl } = context.globalThis.CopilotExporter.selectors;

  assert.equal(isSupportedUrl("https://m365.cloud.microsoft/chat"), true);
  assert.equal(isSupportedUrl("https://m365.cloud.microsoft/chat/123"), true);
  assert.equal(isSupportedUrl("https://copilot.microsoft.com/chat"), false);
  assert.equal(isSupportedUrl("https://example.com/chat"), false);
});

test("findAll excludes nested duplicate matches", async () => {
  const source = await fs.readFile(path.join(__dirname, "../lib/selectors.js"), "utf8");
  const outer = makeNode("outer");
  const inner = makeNode("inner");
  outer.contains = (candidate) => candidate === inner;
  inner.contains = () => false;

  const root = {
    querySelectorAll() {
      return [outer, inner];
    }
  };

  const context = {
    globalThis: {},
    console,
    URL
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const { findAll } = context.globalThis.CopilotExporter.selectors;
  const matches = findAll(root, [".message"]);

  assert.equal(matches.length, 1);
  assert.equal(matches[0], outer);
});

test("table selectors include role-based tables", async () => {
  const source = await fs.readFile(path.join(__dirname, "../lib/selectors.js"), "utf8");
  const context = {
    globalThis: {},
    console,
    URL
  };
  vm.createContext(context);
  vm.runInContext(source, context);

  const { SELECTORS } = context.globalThis.CopilotExporter.selectors;
  assert.equal(SELECTORS.table.includes('[role="table"]'), true);
  assert.equal(SELECTORS.table.includes('[role="grid"]'), true);
});

function makeNode(name) {
  return {
    name,
    contains() {
      return false;
    }
  };
}
