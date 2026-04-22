import test from "node:test";
import assert from "node:assert/strict";
import type { BuiltinSnapshot } from "../types.ts";
import fallbackSnapshot from "../generated/builtin-keybindings.json" with { type: "json" };
import { BUILTIN_PRESENTATION_META, FALLBACK_BUILTIN_CATEGORY } from "../builtin-metadata.ts";
import { isSnapshotStale, parseBuiltinSnapshot, snapshotToRows } from "../snapshot.ts";

test("snapshot types support default key arrays", () => {
  const snapshot: BuiltinSnapshot = {
    schemaVersion: 1,
    generatorVersion: 1,
    piVersion: "0.68.0",
    platform: "win32",
    generatedAt: "2026-04-21T22:30:00.000Z",
    bindings: [
      {
        id: "app.exit",
        defaultKeys: ["ctrl+d"],
        description: "Exit when editor is empty",
      },
    ],
  };

  assert.equal(snapshot.bindings[0]?.id, "app.exit");
});

test("builtin metadata includes known app binding", () => {
  assert.deepEqual(BUILTIN_PRESENTATION_META["app.exit"], {
    category: "Application",
    name: "Exit",
    order: 30,
  });
});

test("fallback category is defined", () => {
  assert.equal(FALLBACK_BUILTIN_CATEGORY, "Other Built-ins");
});

test("parseBuiltinSnapshot accepts valid snapshot", () => {
  const parsed = parseBuiltinSnapshot({
    schemaVersion: 1,
    generatorVersion: 1,
    piVersion: "0.68.0",
    platform: "win32",
    generatedAt: "2026-04-21T22:30:00.000Z",
    bindings: [
      {
        id: "app.exit",
        defaultKeys: ["ctrl+d"],
        description: "Exit when editor is empty",
      },
    ],
  });

  assert.equal(parsed.piVersion, "0.68.0");
});

test("isSnapshotStale returns false for matching context", () => {
  const stale = isSnapshotStale(
    {
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.68.0",
      platform: "win32",
      generatedAt: "2026-04-21T22:30:00.000Z",
      bindings: [],
    },
    {
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.68.0",
      platform: "win32",
    },
  );

  assert.equal(stale, false);
});

test("isSnapshotStale returns true when pi version changes", () => {
  const stale = isSnapshotStale(
    {
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.67.0",
      platform: "win32",
      generatedAt: "2026-04-21T22:30:00.000Z",
      bindings: [],
    },
    {
      schemaVersion: 1,
      generatorVersion: 1,
      piVersion: "0.68.0",
      platform: "win32",
    },
  );

  assert.equal(stale, true);
});

test("snapshotToRows maps known ids using extension metadata", () => {
  const rows = snapshotToRows({
    schemaVersion: 1,
    generatorVersion: 1,
    piVersion: "0.68.0",
    platform: "win32",
    generatedAt: "2026-04-21T22:30:00.000Z",
    bindings: [
      {
        id: "app.exit",
        defaultKeys: ["ctrl+d"],
        description: "Exit when editor is empty",
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      category: "Application",
      name: "Exit",
      keyText: "Ctrl+D",
      description: "Exit when editor is empty",
      searchText: "exit ctrl+d exit when editor is empty",
      source: "builtin",
      keybindingId: "app.exit",
      isCustomized: false,
    },
  ]);
});

test("snapshotToRows falls back for unknown ids", () => {
  const rows = snapshotToRows({
    schemaVersion: 1,
    generatorVersion: 1,
    piVersion: "0.68.0",
    platform: "win32",
    generatedAt: "2026-04-21T22:30:00.000Z",
    bindings: [
      {
        id: "app.future.magic",
        defaultKeys: ["ctrl+shift+m"],
        description: "Future magic action",
      },
    ],
  });

  assert.equal(rows[0]?.category, "Other Built-ins");
  assert.equal(rows[0]?.keybindingId, "app.future.magic");
});

test("bundled fallback snapshot is parseable", () => {
  const parsed = parseBuiltinSnapshot(fallbackSnapshot);
  assert.ok(parsed.bindings.length > 0);
});
