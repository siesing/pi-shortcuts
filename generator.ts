import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { VERSION as PI_VERSION } from "@mariozechner/pi-coding-agent";
import type { BuiltinSnapshot } from "./types";

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_GENERATOR_VERSION = 1;

interface KeybindingDefinitionLike {
  defaultKeys: string | string[];
  description?: string;
}

interface BuildSnapshotOptions {
  piVersion: string;
  platform: NodeJS.Platform;
  schemaVersion: number;
  generatorVersion: number;
  generatedAt: string;
}

export function buildSnapshotFromDefinitions(
  definitions: Record<string, KeybindingDefinitionLike>,
  options: BuildSnapshotOptions,
): BuiltinSnapshot {
  return {
    schemaVersion: options.schemaVersion,
    generatorVersion: options.generatorVersion,
    piVersion: options.piVersion,
    platform: options.platform,
    generatedAt: options.generatedAt,
    bindings: Object.entries(definitions).map(([id, definition]) => ({
      id,
      defaultKeys: Array.isArray(definition.defaultKeys) ? [...definition.defaultKeys] : [definition.defaultKeys],
      description: definition.description ?? "",
    })),
  };
}

export async function loadInstalledPiKeybindingsModule(): Promise<{
  KEYBINDINGS: Record<string, KeybindingDefinitionLike>;
}> {
  const piEntryUrl = await import.meta.resolve("@mariozechner/pi-coding-agent");
  const piEntryPath = fileURLToPath(piEntryUrl);
  const keybindingsPath = path.resolve(path.dirname(piEntryPath), "core", "keybindings.js");

  return import(pathToFileURL(keybindingsPath).href) as Promise<{
    KEYBINDINGS: Record<string, KeybindingDefinitionLike>;
  }>;
}

export async function generateBuiltinSnapshot(): Promise<BuiltinSnapshot> {
  const { KEYBINDINGS } = await loadInstalledPiKeybindingsModule();

  return buildSnapshotFromDefinitions(KEYBINDINGS, {
    piVersion: PI_VERSION,
    platform: process.platform,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatorVersion: SNAPSHOT_GENERATOR_VERSION,
    generatedAt: new Date().toISOString(),
  });
}
