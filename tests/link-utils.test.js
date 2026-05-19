import test from "node:test";
import assert from "node:assert/strict";
import { loadGlobalApi } from "./test-helpers.js";

const { extractGroupedCitations, extractLinks, normalizeHref } = await loadGlobalApi("../lib/link-utils.js", "linkUtils");

test("normalizeHref resolves relative URLs", () => {
  assert.equal(
    normalizeHref("/docs/page", "https://example.com/chat"),
    "https://example.com/docs/page"
  );
});

test("normalizeHref rejects unsafe URL schemes", () => {
  assert.equal(normalizeHref("javascript:alert(1)", "https://example.com/chat"), null);
  assert.equal(normalizeHref("data:text/html,test", "https://example.com/chat"), null);
});

test("extractLinks dedupes anchors by kind href and text", () => {
  const root = {
    querySelectorAll() {
      return [
        makeAnchor("https://example.com/a", "Example"),
        makeAnchor("https://example.com/a", "Example"),
        makeAnchor("/relative", "Relative")
      ];
    }
  };

  const links = extractLinks(root, { baseUrl: "https://example.com/base" });
  assert.equal(links.length, 2);
  assert.equal(links[1].href, "https://example.com/relative");
});

test("extractGroupedCitations parses data-grouped-citations anchors without href", () => {
  const root = {
    querySelectorAll() {
      return [{
        getAttribute(name) {
          if (name === "data-grouped-citations") {
            return '[{"index":"8","url":"https://tradingeconomics.com/united-states/unemployment-total-percent-of-total-labor-force-wb-data.html","name":"tradingeconomics.com"}]';
          }
          return null;
        },
        textContent: "tradingeconomics"
      }];
    }
  };

  const citations = extractGroupedCitations(root, { baseUrl: "https://m365.cloud.microsoft/chat" });
  assert.equal(citations.length, 1);
  assert.equal(citations[0].kind, "citation");
  assert.equal(citations[0].text, "tradingeconomics.com");
  assert.match(citations[0].href, /tradingeconomics\.com/);
});

function makeAnchor(href, text) {
  return {
    getAttribute(name) {
      return name === "href" ? href : null;
    },
    textContent: text
  };
}
