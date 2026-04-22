import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import {
  CURSOR_MARKER,
  Key,
  matchesKey,
  truncateToWidth,
  type Focusable,
  visibleWidth,
} from "@mariozechner/pi-tui";
import { getFirstMatchParts, highlightFirstMatch } from "./highlight";
import { CATEGORY_ORDER, type FlatOverlayLine, type KeybindingRow } from "./types";

export interface OpenKeybindingsOverlayArgs {
  rows: KeybindingRow[];
}

export function filterRows(rows: KeybindingRow[], query: string): KeybindingRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => row.searchText.includes(normalized));
}

export function flattenRows(rows: KeybindingRow[]): FlatOverlayLine[] {
  if (rows.length === 0) {
    return [{ kind: "empty", text: "No keybindings match your filter." }];
  }

  const rowsByCategory = new Map<KeybindingRow["category"], KeybindingRow[]>();
  for (const row of rows) {
    const categoryRows = rowsByCategory.get(row.category);
    if (categoryRows) {
      categoryRows.push(row);
    } else {
      rowsByCategory.set(row.category, [row]);
    }
  }

  const lines: FlatOverlayLine[] = [];
  for (const category of CATEGORY_ORDER) {
    const categoryRows = rowsByCategory.get(category);
    if (!categoryRows) continue;

    lines.push({ kind: "header", text: category });
    lines.push({ kind: "columns" });
    for (const row of categoryRows) {
      lines.push({ kind: "row", row });
    }
  }

  return lines;
}

class KeybindingsOverlayComponent implements Focusable {
  focused = false;
  private query = "";
  private scrollOffset = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];
  private lastViewportHeight = 18;

  constructor(
    private theme: Theme,
    private rows: KeybindingRow[],
    private done: () => void,
  ) {}

  private fitToWidth(text: string, width: number, ellipsis = ""): string {
    if (width <= 0) return "";
    const truncated = truncateToWidth(text, width, ellipsis, true);
    return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
  }

  private getFilteredLines(): FlatOverlayLine[] {
    return flattenRows(filterRows(this.rows, this.query));
  }

  private clampScroll(viewportHeight: number): void {
    const total = this.getFilteredLines().length;
    const maxOffset = Math.max(0, total - viewportHeight);
    this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxOffset));
  }

  private replaceQuery(query: string): void {
    this.query = query;
    this.scrollOffset = 0;
    this.invalidate();
  }

  private moveScroll(delta: number): void {
    this.scrollOffset = Math.max(0, this.scrollOffset + delta);
    this.invalidate();
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.done();
      return;
    }

    if (matchesKey(data, Key.ctrl("u"))) {
      this.replaceQuery("");
      return;
    }

    if (matchesKey(data, Key.backspace)) {
      if (this.query.length > 0) {
        this.replaceQuery(this.query.slice(0, -1));
      }
      return;
    }

    if (matchesKey(data, Key.up)) {
      this.moveScroll(-1);
      return;
    }

    if (matchesKey(data, Key.down)) {
      this.moveScroll(1);
      return;
    }

    if (matchesKey(data, Key.pageUp)) {
      this.moveScroll(-this.lastViewportHeight);
      return;
    }

    if (matchesKey(data, Key.pageDown)) {
      this.moveScroll(this.lastViewportHeight);
      return;
    }

    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.replaceQuery(this.query + data);
    }
  }

  render(width: number): string[] {
    if (this.cachedWidth === width && this.cachedLines) return this.cachedLines;

    const lines = this.renderFresh(width);
    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  private renderFresh(width: number): string[] {
    const overlayWidth = Math.max(2, Math.min(width, 110));
    const innerWidth = overlayWidth - 2;
    const resultsHeight = 18;
    const helpText = "↑ / ↓ • PgUp / PgDn • Ctrl+U clear filter • Esc close";

    this.lastViewportHeight = resultsHeight;
    this.clampScroll(resultsHeight);

    const border = (text: string) => this.theme.fg("border", text);
    const frameRow = (text: string) => border("│") + this.fitToWidth(text, innerWidth) + border("│");
    const pushFrameRow = (output: string[], text = "") => output.push(frameRow(text));

    const visibleLines = this.getFilteredLines().slice(this.scrollOffset, this.scrollOffset + resultsHeight);
    const marker = this.focused ? CURSOR_MARKER : "";
    const output: string[] = [
      border(`╭${"─".repeat(innerWidth)}╮`),
      frameRow(` ${this.theme.fg("accent", this.theme.bold("Shortcuts & Commands"))}`),
      frameRow(""),
      frameRow(` Filter: ${this.query}${marker}\x1b[7m \x1b[27m`),
      frameRow(""),
    ];

    for (const line of visibleLines) {
      pushFrameRow(output, this.renderOverlayLine(line, innerWidth));
    }

    while (output.length < 5 + resultsHeight) {
      pushFrameRow(output);
    }

    output.push(border(`├${"─".repeat(innerWidth)}┤`));
    output.push(frameRow(` ${this.theme.fg("dim", helpText)}`));
    output.push(border(`╰${"─".repeat(innerWidth)}╯`));
    return output;
  }

  private renderOverlayLine(line: FlatOverlayLine, innerWidth: number): string {
    switch (line.kind) {
      case "header":
        return ` ${this.theme.fg("accent", this.theme.bold(line.text))}`;
      case "columns":
        return this.renderColumns(innerWidth);
      case "row":
        return this.renderTableRow(line.row, innerWidth);
      case "empty":
        return ` ${this.theme.fg("warning", line.text)}`;
    }
  }

  private renderColumns(innerWidth: number): string {
    const [nameW, keyW, descW] = this.getColumnWidths(innerWidth);
    const name = this.fitToWidth(this.theme.fg("dim", "Name"), nameW);
    const key = this.fitToWidth(this.theme.fg("dim", "Key"), keyW);
    const desc = this.fitToWidth(this.theme.fg("dim", "Description"), descW);
    return `${name} ${key} ${desc}`;
  }

  private styleHighlightedCell(text: string, baseTone?: "accent" | "muted"): string {
    const parts = getFirstMatchParts(text, this.query);
    const applyTone = (value: string) => (baseTone ? this.theme.fg(baseTone, value) : value);

    if (!parts) {
      return applyTone(text);
    }

    return `${applyTone(parts.before)}${highlightFirstMatch(parts.match, this.query, this.theme)}${applyTone(parts.after)}`;
  }

  private renderHighlightedCell(
    text: string,
    width: number,
    baseTone?: "accent" | "muted",
    ellipsis = "…",
  ): string {
    return this.fitToWidth(this.styleHighlightedCell(text, baseTone), width, ellipsis);
  }

  private renderTableRow(row: KeybindingRow, innerWidth: number): string {
    const [nameW, keyW, descW] = this.getColumnWidths(innerWidth);
    const nameText = highlightFirstMatch(row.name, this.query, this.theme);
    const marker = row.isCustomized ? ` ${this.theme.fg("accent", "●")}` : "";
    const keyText = `${this.styleHighlightedCell(row.keyText, "accent")}${marker}`;
    const descriptionText = this.renderHighlightedCell(row.description, descW, "muted");

    const name = this.fitToWidth(nameText, nameW, "…");
    const key = this.fitToWidth(keyText, keyW, "…");
    return `${name} ${key} ${descriptionText}`;
  }

  private getColumnWidths(innerWidth: number): [number, number, number] {
    const available = Math.max(30, innerWidth - 2);
    const keyW = Math.min(22, Math.max(12, Math.floor(available * 0.22)));
    const nameW = Math.min(28, Math.max(18, Math.floor(available * 0.33)));
    const descW = Math.max(10, available - nameW - keyW - 2);
    return [nameW, keyW, descW];
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  dispose(): void {}
}

export async function openKeybindingsOverlay(
  ctx: ExtensionContext,
  args: OpenKeybindingsOverlayArgs,
): Promise<void> {
  await ctx.ui.custom<void>((_tui, theme, _kb, done) => new KeybindingsOverlayComponent(theme, args.rows, done), {
    overlay: true,
    overlayOptions: {
      anchor: "center",
      width: "80%",
      minWidth: 72,
      maxHeight: 28,
      margin: 1,
    },
  });
}
