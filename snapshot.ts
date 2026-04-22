import { BUILTIN_PRESENTATION_META, FALLBACK_BUILTIN_CATEGORY } from "./builtin-metadata";
import { formatKeybindingValue } from "./key-format";
import type { BuiltinSnapshot, BuiltinSnapshotBinding, BuiltinSnapshotContext, KeybindingRow } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isBuiltinSnapshotBinding(value: unknown): value is BuiltinSnapshotBinding {
  return isRecord(value) &&
    typeof value.id === "string" &&
    isStringArray(value.defaultKeys) &&
    typeof value.description === "string";
}

export function parseBuiltinSnapshot(value: unknown): BuiltinSnapshot {
  if (!isRecord(value)) {
    throw new Error("Snapshot must be an object");
  }

  const {
    schemaVersion,
    generatorVersion,
    piVersion,
    platform,
    generatedAt,
    bindings,
  } = value;

  if (
    typeof schemaVersion !== "number" ||
    typeof generatorVersion !== "number" ||
    typeof piVersion !== "string" ||
    typeof platform !== "string" ||
    typeof generatedAt !== "string" ||
    !Array.isArray(bindings)
  ) {
    throw new Error("Snapshot shape is invalid");
  }

  for (const binding of bindings) {
    if (!isBuiltinSnapshotBinding(binding)) {
      throw new Error("Snapshot binding is invalid");
    }
  }

  return {
    schemaVersion,
    generatorVersion,
    piVersion,
    platform: platform as NodeJS.Platform,
    generatedAt,
    bindings,
  };
}

export function isSnapshotStale(snapshot: BuiltinSnapshot, context: BuiltinSnapshotContext): boolean {
  return (
    snapshot.schemaVersion !== context.schemaVersion ||
    snapshot.generatorVersion !== context.generatorVersion ||
    snapshot.piVersion !== context.piVersion ||
    snapshot.platform !== context.platform
  );
}

function fallbackName(id: string, description: string): string {
  return description.trim() || id;
}

export function snapshotToRows(snapshot: BuiltinSnapshot): KeybindingRow[] {
  return snapshot.bindings
    .map((binding) => {
      const meta = BUILTIN_PRESENTATION_META[binding.id];
      const keyText = formatKeybindingValue(binding.defaultKeys) ?? "—";
      const name = meta?.name ?? fallbackName(binding.id, binding.description);
      const category = meta?.category ?? FALLBACK_BUILTIN_CATEGORY;

      return {
        category,
        name,
        keyText,
        description: binding.description,
        searchText: `${name} ${keyText} ${binding.description}`.toLowerCase(),
        source: "builtin" as const,
        keybindingId: binding.id,
        isCustomized: false,
        __order: meta?.order ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      if (a.__order !== b.__order) return a.__order - b.__order;
      return a.name.localeCompare(b.name);
    })
    .map(({ __order: _order, ...row }) => row);
}
