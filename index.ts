import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { VERSION as PI_VERSION, type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import fallbackSnapshot from "./generated/builtin-keybindings.json" with { type: "json" };
import { readJsonFile, writeJsonFileAtomic } from "./cache";
import {
  generateBuiltinSnapshot,
  SNAPSHOT_GENERATOR_VERSION,
  SNAPSHOT_SCHEMA_VERSION,
} from "./generator";
import { formatKeybindingValue, formatKeyToken } from "./key-format";
import { openKeybindingsOverlay } from "./overlay";
import {
  isSnapshotStale,
  parseBuiltinSnapshot,
  snapshotToRows,
} from "./snapshot";
import type {
  BuiltinSnapshot,
  BuiltinSnapshotContext,
  CommandLike,
  KeybindingRow,
} from "./types";

type KeybindingOverrideMap = Record<string, string>;

interface LoadBuiltinRowsOptions {
  cachePath?: string;
  piVersion?: string;
  platform?: NodeJS.Platform;
  fallbackSnapshot?: unknown;
  readCachedSnapshot?: (cachePath: string) => Promise<unknown | null>;
  writeCachedSnapshot?: (cachePath: string, snapshot: BuiltinSnapshot) => Promise<void>;
  generateSnapshot?: () => Promise<BuiltinSnapshot>;
  readOverrides?: () => Promise<KeybindingOverrideMap>;
}

export { formatKeybindingValue, formatKeyToken } from "./key-format";

async function readKeybindingOverrides(): Promise<KeybindingOverrideMap> {
  const filePath = path.join(os.homedir(), ".pi", "agent", "keybindings.json");

  try {
    const text = await readFile(filePath, "utf8");
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const overrides: KeybindingOverrideMap = {};
    for (const [id, rawValue] of Object.entries(parsed)) {
      if (typeof rawValue === "string" || Array.isArray(rawValue)) {
        const formatted = formatKeybindingValue(rawValue as string | string[]);
        if (formatted) overrides[id] = formatted;
      }
    }

    return overrides;
  } catch {
    return {};
  }
}

export function normalizeExtensionCommandRows(commands: CommandLike[]): KeybindingRow[] {
  return commands
    .filter((command) => command.source === "extension")
    .map((command) => {
      const name = `/${command.name}`;
      const description = command.description?.trim() || "Extension command";
      const keyText = "—";
      return {
        category: "Extension Commands" as const,
        name,
        keyText,
        description,
        searchText: `${name} ${keyText} ${description}`.toLowerCase(),
        source: "extension-command" as const,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function applyKeybindingOverrides(rows: KeybindingRow[], overrides: KeybindingOverrideMap): KeybindingRow[] {
  return rows.map((row) => {
    if (row.source !== "builtin" || !row.keybindingId) return row;

    const override = overrides[row.keybindingId];
    if (!override) return row;

    return {
      ...row,
      keyText: override,
      searchText: `${row.name} ${override} ${row.description}`.toLowerCase(),
      isCustomized: true,
    };
  });
}

function getCachePath(): string {
  return path.join(process.cwd(), ".pi-shortcuts-cache", "builtin-keybindings.cache.json");
}

async function loadBestBuiltinSnapshot(options: LoadBuiltinRowsOptions = {}): Promise<BuiltinSnapshot> {
  const context: BuiltinSnapshotContext = {
    piVersion: options.piVersion ?? PI_VERSION,
    platform: options.platform ?? process.platform,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatorVersion: SNAPSHOT_GENERATOR_VERSION,
  };

  const fallback = parseBuiltinSnapshot(options.fallbackSnapshot ?? fallbackSnapshot);
  const cachePath = options.cachePath ?? getCachePath();
  const readCachedSnapshot = options.readCachedSnapshot ?? readJsonFile;
  const writeCachedSnapshot = options.writeCachedSnapshot ?? writeJsonFileAtomic;
  const generateSnapshot = options.generateSnapshot ?? generateBuiltinSnapshot;

  let cached: BuiltinSnapshot | null = null;
  const cachedRaw = await readCachedSnapshot(cachePath);
  if (cachedRaw) {
    try {
      cached = parseBuiltinSnapshot(cachedRaw);
    } catch {
      cached = null;
    }
  }

  if (cached && !isSnapshotStale(cached, context)) {
    return cached;
  }

  try {
    const generated = parseBuiltinSnapshot(await generateSnapshot());
    await writeCachedSnapshot(cachePath, generated);
    return generated;
  } catch {
    return cached ?? fallback;
  }
}

export async function loadBuiltinRows(options: LoadBuiltinRowsOptions = {}): Promise<KeybindingRow[]> {
  const snapshot = await loadBestBuiltinSnapshot(options);
  const overrides = await (options.readOverrides ?? readKeybindingOverrides)();
  return applyKeybindingOverrides(snapshotToRows(snapshot), overrides);
}

async function buildRows(pi: ExtensionAPI): Promise<KeybindingRow[]> {
  const builtinRows = await loadBuiltinRows();
  const extensionRows = normalizeExtensionCommandRows(pi.getCommands() as CommandLike[]);
  return [...builtinRows, ...extensionRows];
}

async function showOverlay(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  await openKeybindingsOverlay(ctx, { rows: await buildRows(pi) });
}

export default function keybindingsOverlayExtension(pi: ExtensionAPI) {
  pi.registerCommand("shortcuts", {
    description: "Show searchable keybindings overlay",
    handler: async (_args, ctx) => {
      await showOverlay(pi, ctx);
    },
  });

  pi.registerShortcut(Key.ctrlAlt("k"), {
    description: "Show searchable keybindings overlay",
    handler: async (ctx) => {
      await showOverlay(pi, ctx);
    },
  });
}
