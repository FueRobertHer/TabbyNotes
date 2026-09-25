import { type EditorState, Facet, type Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

const hiddenMarks = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "CodeInfo",
  "LinkMark",
  "QuoteMark",
  "StrikethroughMark",
]);

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  override toDOM(): HTMLElement {
    const bullet = document.createElement("span");
    bullet.className = "cm-live-bullet";
    bullet.textContent = "•";
    return bullet;
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly from: number,
    readonly to: number,
  ) {
    super();
  }

  override eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = this.checked;
    checkbox.className = "cm-live-checkbox";
    checkbox.setAttribute("aria-label", this.checked ? "Mark task incomplete" : "Mark task complete");
    checkbox.addEventListener("change", () => {
      view.dispatch({
        changes: {
          from: this.from,
          to: this.to,
          insert: checkbox.checked ? "[x]" : "[ ]",
        },
      });
      view.focus();
    });
    return checkbox;
  }
}

class HorizontalRuleWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }

  override toDOM(): HTMLElement {
    const rule = document.createElement("span");
    rule.className = "cm-live-horizontal-rule";
    return rule;
  }
}

// Safe subset of inline Markdown for table cells, built with textContent (never innerHTML).
const inlinePattern = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*]+\*|_[^_]+_)|(~~[^~]+~~)/g;

function renderInline(text: string, parent: HTMLElement): void {
  let last = 0;
  for (const match of text.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    if (index > last) parent.append(text.slice(last, index));
    const [token, code, strong, emphasis] = match;
    const element = document.createElement(
      code ? "code" : strong ? "strong" : emphasis ? "em" : "s",
    );
    const markerLength = code || emphasis ? 1 : 2;
    element.textContent = token.slice(markerLength, token.length - markerLength);
    parent.append(element);
    last = index + token.length;
  }
  if (last < text.length) parent.append(text.slice(last));
}

type ColumnAlign = "left" | "center" | "right";

/** Splits a table row into trimmed cells on unescaped pipes. */
export function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

class TableRowWidget extends WidgetType {
  constructor(
    readonly cells: string[],
    readonly columns: string,
    readonly aligns: ColumnAlign[],
    readonly header: boolean,
    readonly last: boolean,
  ) {
    super();
  }

  override eq(other: TableRowWidget): boolean {
    return (
      this.header === other.header &&
      this.last === other.last &&
      this.columns === other.columns &&
      this.aligns.join() === other.aligns.join() &&
      this.cells.join("\u0000") === other.cells.join("\u0000")
    );
  }

  override toDOM(): HTMLElement {
    const row = document.createElement("span");
    row.className = [
      "cm-live-table-row",
      this.header ? "cm-live-table-header" : "",
      this.last ? "cm-live-table-last" : "",
    ]
      .filter(Boolean)
      .join(" ");
    row.style.gridTemplateColumns = this.columns;
    this.aligns.forEach((align, index) => {
      const cell = document.createElement("span");
      cell.className = "cm-live-table-cell";
      cell.style.textAlign = align;
      renderInline(this.cells[index] ?? "", cell);
      row.append(cell);
    });
    return row;
  }

  // Let clicks through so they move the cursor into the table and reveal its source.
  override ignoreEvent(): boolean {
    return false;
  }
}

function safeImageUrl(value: string): string | null {
  if (/^data:image\/(?:png|gif|jpe?g|webp);/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Whether live preview fetches http(s) images without asking. Off by default for privacy. */
export const loadRemoteImages = Facet.define<boolean, boolean>({
  combine: (values) => values.some(Boolean),
});

// Remote images the user chose to load this session, so they stay loaded as the view redraws.
const approvedImages = new Set<string>();

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly autoLoad: boolean,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt && this.autoLoad === other.autoLoad;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-live-image";
    if (this.autoLoad || approvedImages.has(this.src)) this.showImage(wrapper, view);
    else this.showPlaceholder(wrapper, view);
    return wrapper;
  }

  // Remote images reveal the reader's IP address to their host, so ask before fetching.
  private showPlaceholder(wrapper: HTMLElement, view: EditorView): void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-live-image-load";
    let host = "";
    try {
      host = new URL(this.src).host;
    } catch {
      // safeImageUrl only lets valid URLs through.
    }
    button.textContent = `🖼 ${this.alt || "Image"} · Load from ${host}`;
    button.title = this.src;
    button.addEventListener("click", () => {
      approvedImages.add(this.src);
      wrapper.replaceChildren();
      this.showImage(wrapper, view);
      view.requestMeasure();
    });
    wrapper.append(button);
  }

  private showImage(wrapper: HTMLElement, view: EditorView): void {
    const image = document.createElement("img");
    image.src = this.src;
    image.alt = this.alt;
    image.title = this.alt;
    image.referrerPolicy = "no-referrer";
    // The line's height changes once the image arrives, so ask CodeMirror to re-measure.
    image.addEventListener("load", () => view.requestMeasure());
    image.addEventListener("error", () => {
      wrapper.replaceChildren(this.alt ? `🖼 ${this.alt}` : "🖼 Image failed to load");
      wrapper.classList.add("cm-live-image-broken");
      view.requestMeasure();
    });
    wrapper.append(image);
  }

  // The load button handles its own clicks; anything else moves the cursor to the image.
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest(".cm-live-image-load") !== null;
  }
}

function selectionTouches(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((range) => range.from <= to && range.to >= from);
}

/** A row's cell texts, split on the row's own pipe nodes (so a quote's ">" isn't a cell). */
function rowCells(state: EditorState, row: SyntaxNode): string[] {
  const pipes = row.getChildren("TableDelimiter");
  const bounds: [number, number][] = [];
  let start = row.from;
  for (const pipe of pipes) {
    bounds.push([start, pipe.from]);
    start = pipe.to;
  }
  bounds.push([start, row.to]);
  // Leading and trailing pipes leave empty edges that aren't cells.
  if (pipes[0]?.from === row.from) bounds.shift();
  if (pipes.at(-1)?.to === row.to) bounds.pop();
  return bounds.map(([from, to]) => state.sliceDoc(from, to).trim().replace(/\\\|/g, "|"));
}

function decorateTable(view: EditorView, ranges: Range<Decoration>[], table: SyntaxNode): void {
  const { state } = view;
  const header = table.getChild("TableHeader");
  // The |---| line is a direct child of the table; pipes inside rows are the rows' children.
  const delimiter = table.getChild("TableDelimiter");
  if (!header || !delimiter) return;
  const bodyRows = table.getChildren("TableRow");

  const headerCells = rowCells(state, header);
  const aligns: ColumnAlign[] = tableCells(state.sliceDoc(delimiter.from, delimiter.to))
    .slice(0, headerCells.length)
    .map((spec) =>
      spec.startsWith(":") && spec.endsWith(":") ? "center" : spec.endsWith(":") ? "right" : "left",
    );
  while (aligns.length < headerCells.length) aligns.push("left");

  const rows = [headerCells, ...bodyRows.map((row) => rowCells(state, row))];
  // Every row is its own widget, so share column proportions to keep them aligned.
  const columns = headerCells
    .map((_, index) => {
      const longest = Math.max(...rows.map((cells) => (cells[index] ?? "").length));
      return `${Math.min(40, Math.max(3, longest))}fr`;
    })
    .join(" ");

  const addRow = (row: SyntaxNode, cells: string[], isHeader: boolean, isLast: boolean) => {
    const line = state.doc.lineAt(row.from);
    // Swallow the space after a quote's ">" too, or the full-width row wraps below it.
    let from = row.from;
    while (from > line.from && /\s/.test(state.sliceDoc(from - 1, from))) from -= 1;
    ranges.push(Decoration.line({ class: "cm-live-table-line" }).range(line.from));
    ranges.push(
      Decoration.replace({
        widget: new TableRowWidget(cells, columns, aligns, isHeader, isLast),
      }).range(from, row.to),
    );
  };

  // Inside a blockquote, the ">" markers of the table's later lines belong to the table.
  for (const marker of table.getChildren("QuoteMark")) {
    ranges.push(Decoration.replace({}).range(marker.from, marker.to));
  }

  addRow(header, headerCells, true, bodyRows.length === 0);
  ranges.push(
    Decoration.line({ class: "cm-live-table-delimiter-line" }).range(state.doc.lineAt(delimiter.from).from),
  );
  ranges.push(Decoration.replace({}).range(delimiter.from, delimiter.to));
  bodyRows.forEach((row, index) =>
    addRow(row, rows[index + 1] ?? [], false, index === bodyRows.length - 1),
  );
}

function lineIsActive(view: EditorView, position: number): boolean {
  const line = view.state.doc.lineAt(position);
  return view.state.selection.ranges.some(
    (selection) => selection.from <= line.to && selection.to >= line.from,
  );
}

function addLineDecorations(
  view: EditorView,
  ranges: Range<Decoration>[],
  from: number,
  to: number,
  className: string,
): void {
  const firstLine = view.state.doc.lineAt(from);
  const lastLine = view.state.doc.lineAt(Math.max(from, to - 1));
  let line = firstLine;

  while (true) {
    const edgeClasses = [
      line.number === firstLine.number ? `${className}-first` : "",
      line.number === lastLine.number ? `${className}-last` : "",
    ]
      .filter(Boolean)
      .join(" ");
    ranges.push(
      Decoration.line({ class: `${className} ${edgeClasses}`.trim() }).range(line.from),
    );
    if (line.number === lastLine.number) break;
    line = view.state.doc.line(line.number + 1);
  }
}

function safeExternalUrl(value: string): string | null {
  const candidate = value.startsWith("www.") ? `https://${value}` : value;
  try {
    const url = new URL(candidate);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function markdownLinkAt(state: EditorState, position: number): string | null {
  const tree = syntaxTree(state);
  for (const side of [1, -1] as const) {
    let node = tree.resolveInner(position, side);
    while (node) {
      if (node.name === "URL") {
        return safeExternalUrl(state.sliceDoc(node.from, node.to));
      }
      if (node.name === "Link" || node.name === "Autolink") {
        const url = node.getChild("URL");
        return url ? safeExternalUrl(state.sliceDoc(url.from, url.to)) : null;
      }
      const parent = node.parent;
      if (!parent) break;
      node = parent;
    }
  }
  return null;
}

function buildDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const visited = new Set<string>();
  const tree = syntaxTree(view.state);

  for (const visibleRange of view.visibleRanges) {
    tree.iterate({
      from: visibleRange.from,
      to: visibleRange.to,
      enter(node) {
        const key = `${node.name}:${node.from}:${node.to}`;
        if (visited.has(key)) return;
        visited.add(key);

        const heading = /^(?:ATX|Setext)Heading([1-6])$/.exec(node.name);
        if (heading) {
          ranges.push(
            Decoration.line({ class: `cm-live-heading cm-live-heading-${heading[1]}` }).range(
              node.from,
            ),
          );
          return;
        }

        if (node.name === "Table") {
          if (selectionTouches(view, node.from, node.to)) {
            addLineDecorations(view, ranges, node.from, node.to, "cm-live-table-source");
            return;
          }
          decorateTable(view, ranges, node.node);
          return false;
        }

        // A plugin may not replace a line break, so images written across lines stay as text.
        const { doc } = view.state;
        if (
          node.name === "Image" &&
          doc.lineAt(node.from).number === doc.lineAt(node.to).number &&
          !selectionTouches(view, node.from, node.to)
        ) {
          const url = node.node.getChild("URL");
          const src = url ? safeImageUrl(view.state.sliceDoc(url.from, url.to)) : null;
          const altEnd = node.node.getChildren("LinkMark")[1]?.from ?? node.from;
          if (src) {
            const alt = view.state.sliceDoc(node.from + 2, altEnd);
            const autoLoad = !src.startsWith("http") || view.state.facet(loadRemoteImages);
            ranges.push(
              Decoration.replace({ widget: new ImageWidget(src, alt, autoLoad) }).range(node.from, node.to),
            );
            return false;
          }
        }

        if (node.name === "ListItem") {
          addLineDecorations(view, ranges, node.from, node.to, "cm-live-list-line");
          return;
        }

        if (node.name === "ListMark") {
          const marker = view.state.sliceDoc(node.from, node.to);
          if (/^[-+*]$/.test(marker) && !lineIsActive(view, node.from)) {
            ranges.push(
              Decoration.replace({ widget: new BulletWidget() }).range(node.from, node.to),
            );
          } else {
            ranges.push(
              Decoration.mark({ class: "cm-live-list-marker" }).range(node.from, node.to),
            );
          }
          return;
        }

        if (node.name === "Emphasis") {
          ranges.push(Decoration.mark({ class: "cm-live-emphasis" }).range(node.from, node.to));
          return;
        }

        if (node.name === "StrongEmphasis") {
          ranges.push(Decoration.mark({ class: "cm-live-strong" }).range(node.from, node.to));
          return;
        }

        if (node.name === "Strikethrough") {
          ranges.push(Decoration.mark({ class: "cm-live-strikethrough" }).range(node.from, node.to));
          return;
        }

        if (node.name === "InlineCode") {
          ranges.push(Decoration.mark({ class: "cm-live-inline-code" }).range(node.from, node.to));
          return;
        }

        if (node.name === "Link" || node.name === "Autolink") {
          ranges.push(Decoration.mark({ class: "cm-live-link" }).range(node.from, node.to));
          return;
        }

        if (
          node.name === "URL" &&
          node.node.parent?.name !== "Link" &&
          node.node.parent?.name !== "Autolink"
        ) {
          ranges.push(Decoration.mark({ class: "cm-live-link" }).range(node.from, node.to));
          return;
        }

        if (node.name === "Blockquote") {
          addLineDecorations(view, ranges, node.from, node.to, "cm-live-blockquote-line");
          ranges.push(Decoration.mark({ class: "cm-live-blockquote" }).range(node.from, node.to));
          return;
        }

        if (node.name === "FencedCode" || node.name === "CodeBlock") {
          addLineDecorations(view, ranges, node.from, node.to, "cm-live-code-line");
          ranges.push(Decoration.mark({ class: "cm-live-code-block" }).range(node.from, node.to));
          return;
        }

        if (node.name === "TaskMarker") {
          const marker = view.state.sliceDoc(node.from, node.to);
          if (/x/i.test(marker)) {
            const taskEnd = node.node.parent?.to ?? node.to;
            if (node.to < taskEnd) {
              ranges.push(
                Decoration.mark({ class: "cm-live-task-complete" }).range(node.to, taskEnd),
              );
            }
          }
          if (!lineIsActive(view, node.from)) {
            ranges.push(
              Decoration.replace({
                widget: new TaskCheckboxWidget(/x/i.test(marker), node.from, node.to),
              }).range(node.from, node.to),
            );
          }
          return;
        }

        if (node.name === "HorizontalRule" && !lineIsActive(view, node.from)) {
          ranges.push(
            Decoration.replace({ widget: new HorizontalRuleWidget() }).range(node.from, node.to),
          );
          return;
        }

        const isLinkUrl =
          node.name === "URL" && node.node.parent?.name === "Link";
        if ((hiddenMarks.has(node.name) || isLinkUrl) && !lineIsActive(view, node.from)) {
          ranges.push(Decoration.replace({}).range(node.from, node.to));
        }
      },
    });
  }

  return Decoration.set(ranges, true);
}

const livePreviewDecorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      // Long notes are parsed in the background, so also redraw when the tree grows.
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state) ||
        update.startState.facet(loadRemoteImages) !== update.state.facet(loadRemoteImages)
      ) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

const livePreviewLinks = EditorView.domEventHandlers({
  click(event, view) {
    if ((!event.metaKey && !event.ctrlKey) || event.button !== 0) return false;
    if (!(event.target instanceof HTMLElement)) return false;
    const linkElement = event.target.closest<HTMLElement>(".cm-live-link");
    if (!linkElement || !view.dom.contains(linkElement)) return false;

    let position: number;
    try {
      position = view.posAtDOM(linkElement, 0);
    } catch {
      return false;
    }
    const href = markdownLinkAt(view.state, position);
    if (!href) return false;

    event.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
    return true;
  },
});

export const livePreview = [livePreviewDecorations, livePreviewLinks];
