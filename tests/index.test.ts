import test from "node:test";
import assert from "node:assert/strict";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import keybindingsOverlayExtension, {
  applyKeybindingOverrides,
  formatKeybindingValue,
  formatKeyToken,
  loadBuiltinRows,
  normalizeExtensionCommandRows,
} from "../index.ts";
import type { CommandLike, KeybindingRow } from "../types.ts";

function makeBuiltinRow(overrides: Partial<KeybindingRow> = {}): KeybindingRow {
  return {
    category: "Application",
    name: "Exit",
    keyText: "Ctrl+D",
    description: "Exit when editor is empty",
    searchText: "exit ctrl+d exit when editor is empty",
    source: "builtin",
    keybindingId: "app.exit",
    isCustomized: false,
    ...overrides,
  };
}

test("formatKeybindingValue formats a simple binding", () => {
  assert.equal(formatKeybindingValue("ctrl+k"), "Ctrl+K");
});

test("formatKeybindingValue trims whitespace and normalizes aliases", () => {
  assert.equal(formatKeybindingValue(" ctrl + escape "), "Ctrl+Esc");
});

test("formatKeybindingValue joins multiple bindings", () => {
  assert.equal(formatKeybindingValue(["ctrl+k", "alt+k"]), "Ctrl+K / Alt+K");
});

test("formatKeybindingValue ignores blank array entries", () => {
  assert.equal(formatKeybindingValue(["ctrl+k", "  "]), "Ctrl+K");
});

test("formatKeybindingValue returns null for malformed bindings", () => {
  assert.equal(formatKeybindingValue("ctrl++k"), null);
});

test("applyKeybindingOverrides updates matching builtin rows", () => {
  const rows = [makeBuiltinRow()];
  const result = applyKeybindingOverrides(rows, { "app.exit": "Ctrl+Q" });

  assert.deepEqual(result, [
    makeBuiltinRow({
      keyText: "Ctrl+Q",
      searchText: "exit ctrl+q exit when editor is empty",
      isCustomized: true,
    }),
  ]);
});

test("applyKeybindingOverrides leaves non-matching and extension rows unchanged", () => {
  const rows: KeybindingRow[] = [
    makeBuiltinRow(),
    makeBuiltinRow({ keybindingId: "app.clear", name: "Clear editor" }),
    {
      category: "Extension Commands",
      name: "/deploy",
      keyText: "—",
      description: "Deploy app",
      searchText: "/deploy — deploy app",
      source: "extension-command",
    },
  ];

  const result = applyKeybindingOverrides(rows, { "app.exit": "Ctrl+Q" });

  assert.equal(result[0]?.keyText, "Ctrl+Q");
  assert.equal(result[1]?.keyText, "Ctrl+D");
  assert.equal(result[2]?.keyText, "—");
});

test("normalizeExtensionCommandRows keeps only extension commands and sorts them", () => {
  const commands: CommandLike[] = [
    { name: "zeta", description: "  Last command  ", source: "extension" },
    { name: "alpha", source: "extension" },
    { name: "prompty", description: "Prompt", source: "prompt" },
    { name: "skillful", description: "Skill", source: "skill" },
  ];

  const result = normalizeExtensionCommandRows(commands);

  assert.deepEqual(result, [
    {
      category: "Extension Commands",
      name: "/alpha",
      keyText: "—",
      description: "Extension command",
      searchText: "/alpha — extension command",
      source: "extension-command",
    },
    {
      category: "Extension Commands",
      name: "/zeta",
      keyText: "—",
      description: "Last command",
      searchText: "/zeta — last command",
      source: "extension-command",
    },
  ]);
});

test("formatKeyToken normalizes aliases and unknown tokens", () => {
  assert.equal(formatKeyToken("ctrl"), "Ctrl");
  assert.equal(formatKeyToken("escape"), "Esc");
  assert.equal(formatKeyToken("k"), "K");
  assert.equal(formatKeyToken("meta"), "Meta");
});

test("loadBuiltinRows refreshes a stale snapshot and applies overrides", async () => {
  let writtenSnapshot: unknown = null;

  const rows = await loadBuiltinRows({
    cachePath: "/tmp/builtin-keybindings.cache.json",
    piVersion: "0.68.0",
    platform: "win32",
    fallbackSnapshot: {
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.1.0-seed",
      platform: "win32",
      generatedAt: "2026-04-21T22:30:00.000Z",
      bindings: [],
    },
    readCachedSnapshot: async () => ({
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.67.0",
      platform: "win32",
      generatedAt: "2026-04-21T22:30:00.000Z",
      bindings: [],
    }),
    writeCachedSnapshot: async (_cachePath, snapshot) => {
      writtenSnapshot = snapshot;
    },
    generateSnapshot: async () => ({
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.68.0",
      platform: "win32",
      generatedAt: "2026-04-22T00:00:00.000Z",
      bindings: [
        {
          id: "app.exit",
          defaultKeys: ["ctrl+d"],
          description: "Exit when editor is empty",
        },
      ],
    }),
    readOverrides: async () => ({ "app.exit": "Ctrl+Q" }),
  });

  assert.equal(rows[0]?.keyText, "Ctrl+Q");
  assert.equal(rows[0]?.isCustomized, true);
  assert.deepEqual(writtenSnapshot, {
    schemaVersion: 1,
    generatorVersion: 1,
    piVersion: "0.68.0",
    platform: "win32",
    generatedAt: "2026-04-22T00:00:00.000Z",
    bindings: [
      {
        id: "app.exit",
        defaultKeys: ["ctrl+d"],
        description: "Exit when editor is empty",
      },
    ],
  });
});

test("extension registers the /shortcuts command", () => {
  const commands: Array<{ name: string; description?: string }> = [];
  const shortcuts: Array<{ description?: string }> = [];

  const extensionApi: Pick<ExtensionAPI, "registerCommand" | "registerShortcut" | "getCommands"> = {
    registerCommand(name: string, options: { description?: string }) {
      commands.push({ name, description: options.description });
    },
    registerShortcut(_key: unknown, options: { description?: string }) {
      shortcuts.push({ description: options.description });
    },
    getCommands() {
      return [];
    },
  };

  keybindingsOverlayExtension(extensionApi);

  assert.deepEqual(commands, [
    {
      name: "shortcuts",
      description: "Show searchable keybindings & commands overlay",
    },
  ]);
  assert.equal(shortcuts.length, 1);
});
