import test from "node:test";
import assert from "node:assert/strict";
import { buildSnapshotFromDefinitions } from "../generator.ts";

test("buildSnapshotFromDefinitions normalizes string and array default keys", () => {
  const snapshot = buildSnapshotFromDefinitions(
    {
      "app.exit": { defaultKeys: "ctrl+d", description: "Exit when editor is empty" },
      "app.model.select": { defaultKeys: ["ctrl+l"], description: "Open model selector" },
    },
    {
      piVersion: "0.68.0",
      platform: "win32",
      schemaVersion: 1,
      generatorVersion: 1,
      generatedAt: "2026-04-21T22:30:00.000Z",
    },
  );

  assert.deepEqual(snapshot.bindings, [
    {
      id: "app.exit",
      defaultKeys: ["ctrl+d"],
      description: "Exit when editor is empty",
    },
    {
      id: "app.model.select",
      defaultKeys: ["ctrl+l"],
      description: "Open model selector",
    },
  ]);
});
