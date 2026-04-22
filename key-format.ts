const KEY_TOKEN_ALIASES: Record<string, string> = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  escape: "Esc",
  esc: "Esc",
  enter: "Enter",
  return: "Enter",
  pageup: "PgUp",
  pagedown: "PgDn",
  backspace: "Backspace",
  delete: "Delete",
  home: "Home",
  end: "End",
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  tab: "Tab",
  space: "Space",
};

export function formatKeyToken(token: string): string {
  const normalized = token.trim();
  return KEY_TOKEN_ALIASES[normalized.toLowerCase()] ??
    (normalized.length === 1 ? normalized.toUpperCase() : normalized[0]!.toUpperCase() + normalized.slice(1));
}

export function formatKeybindingValue(value: string | string[]): string | null {
  const values = Array.isArray(value) ? value : [value];
  const formatted = values
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => {
      const tokens = item.split("+").map((token) => token.trim());
      if (tokens.some((token) => token.length === 0)) return null;
      return tokens.map(formatKeyToken).join("+");
    })
    .filter((item): item is string => item !== null);

  if (formatted.length === 0) return null;
  return formatted.join(" / ");
}
