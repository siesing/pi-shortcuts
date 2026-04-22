import test from "node:test";
import assert from "node:assert/strict";
import { filterRows, flattenRows } from "../overlay.ts";
import type { KeybindingRow } from "../types.ts";

const cursorRow: KeybindingRow = {
  category: "Cursor",
  name: "Move cursor up",
  keyText: "Up",
  description: "Move cursor up",
  searchText: "move cursor up up move cursor up",
  source: "builtin",
  keybindingId: "tui.editor.cursorUp",
  isCustomized: false,
};

const sessionRow: KeybindingRow = {
  category: "Session",
  name: "Rename session",
  keyText: "Ctrl+R",
  description: "Rename session",
  searchText: "rename session ctrl+r rename session",
  source: "builtin",
  keybindingId: "app.session.rename",
  isCustomized: false,
};

test("filterRows returns all rows for empty or whitespace query", () => {
  const rows = [cursorRow, sessionRow];
  assert.deepEqual(filterRows(rows, ""), rows);
  assert.deepEqual(filterRows(rows, "   "), rows);
});

test("filterRows matches case-insensitively using searchText", () => {
  const result = filterRows([cursorRow, sessionRow], "SESSION");
  assert.deepEqual(result, [sessionRow]);
});

test("flattenRows returns the empty-state line when there are no rows", () => {
  assert.deepEqual(flattenRows([]), [
    { kind: "empty", text: "No keybindings match your filter." },
  ]);
});

test("flattenRows emits headers in category order and preserves row order within a category", () => {
  const secondCursorRow: KeybindingRow = {
    category: "Cursor",
    name: "Move cursor down",
    keyText: "Down",
    description: "Move cursor down",
    searchText: "move cursor down down move cursor down",
    source: "builtin",
    keybindingId: "tui.editor.cursorDown",
    isCustomized: false,
  };

  const result = flattenRows([sessionRow, cursorRow, secondCursorRow]);

  assert.deepEqual(result, [
    { kind: "header", text: "Cursor" },
    { kind: "columns" },
    { kind: "row", row: cursorRow },
    { kind: "row", row: secondCursorRow },
    { kind: "header", text: "Session" },
    { kind: "columns" },
    { kind: "row", row: sessionRow },
  ]);
});
