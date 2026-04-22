import test from "node:test";
import assert from "node:assert/strict";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { getFirstMatchParts, highlightFirstMatch } from "../highlight.ts";

const theme: Pick<Theme, "bold" | "fg"> = {
  bold(value: string) {
    return `<b>${value}</b>`;
  },
  fg(_tone: string, value: string) {
    return `<accent>${value}</accent>`;
  },
};

test("getFirstMatchParts returns null for empty query", () => {
  assert.equal(getFirstMatchParts("Ctrl+K", "   "), null);
});

test("getFirstMatchParts returns the first case-insensitive match while preserving source casing", () => {
  assert.deepEqual(getFirstMatchParts("Open Model Selector", "model"), {
    before: "Open ",
    match: "Model",
    after: " Selector",
  });
});

test("getFirstMatchParts returns null when there is no match", () => {
  assert.equal(getFirstMatchParts("Ctrl+K", "alt"), null);
});

test("highlightFirstMatch highlights only the first match", () => {
  assert.equal(
    highlightFirstMatch("Model model", "model", theme),
    "<accent><b>Model</b></accent> model",
  );
});

test("highlightFirstMatch returns the original text when there is no match", () => {
  assert.equal(highlightFirstMatch("Ctrl+K", "alt", theme), "Ctrl+K");
});
