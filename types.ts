export const CATEGORY_ORDER = [
  "Application",
  "Text Input",
  "Cursor",
  "Deletion",
  "Kill Ring & Clipboard",
  "Session",
  "Models & Thinking",
  "Display",
  "Message Queue",
  "Other Built-ins",
  "Extension Commands",
] as const;

export type KeybindingCategory = (typeof CATEGORY_ORDER)[number];

export interface KeybindingRow {
  category: KeybindingCategory;
  name: string;
  keyText: string;
  description: string;
  searchText: string;
  source: "builtin" | "extension-command";
  keybindingId?: string;
  isCustomized?: boolean;
}

export interface BuiltinSnapshotBinding {
  id: string;
  defaultKeys: string[];
  description: string;
}

export interface BuiltinSnapshot {
  schemaVersion: number;
  generatorVersion: number;
  piVersion: string;
  platform: NodeJS.Platform;
  generatedAt: string;
  bindings: BuiltinSnapshotBinding[];
}

export interface BuiltinPresentationMeta {
  category: KeybindingCategory;
  name: string;
  order: number;
}

export interface BuiltinSnapshotContext {
  piVersion: string;
  platform: NodeJS.Platform;
  schemaVersion: number;
  generatorVersion: number;
}

export interface CommandLike {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
}

export type FlatOverlayLine =
  | { kind: "header"; text: string }
  | { kind: "columns" }
  | { kind: "row"; row: KeybindingRow }
  | { kind: "empty"; text: string };
