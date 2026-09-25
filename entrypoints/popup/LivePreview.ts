import { type EditorSelection, type EditorState, Facet, type Range, StateEffect } from "@codemirror/state";
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

// Asks live preview to rebuild its decorations when something outside the document changed.
const redrawPreview = StateEffect.define<null>();

// Images the user showed or hid this session, by URL, so the choice survives redraws.
const imageChoices = new Map<string, boolean>();

// CodeMirror re-measures line heights only when the content's height changes, and a short note
// is stretched to fill the editor, so a newly loaded image can leave clicks beside it landing on
// the wrong line. Each load bumps this and redraws: widgets built before it count as changed
// (keeping their DOM), which makes CodeMirror measure again.
let imageLoads = 0;

function imageSizeChanged(view: EditorView): void {
  imageLoads += 1;
  if (view.dom.isConnected) view.dispatch({ effects: redrawPreview.of(null) });
}

// Lucide's "image" and "image-off" icons (ISC license), built without React inside the editor.
type IconNode = [tag: string, attributes: Record<string, string>][];
const showImageIcon: IconNode = [
  ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", ry: "2" }],
  ["circle", { cx: "9", cy: "9", r: "2" }],
  ["path", { d: "m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" }],
];
const hideImageIcon: IconNode = [
  ["line", { x1: "2", x2: "22", y1: "2", y2: "22" }],
  ["path", { d: "M10.41 10.41a2 2 0 1 1-2.83-2.83" }],
  ["line", { x1: "13.5", x2: "6", y1: "13.5", y2: "21" }],
  ["line", { x1: "18", x2: "21", y1: "12", y2: "15" }],
  ["path", { d: "M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59" }],
  ["path", { d: "M21 15V5a2 2 0 0 0-2-2H9" }],
];

function iconElement(nodes: IconNode): SVGSVGElement {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  const attributes = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  };
  for (const [name, value] of Object.entries(attributes)) svg.setAttribute(name, value);
  for (const [tag, childAttributes] of nodes) {
    const child = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(childAttributes)) child.setAttribute(name, value);
    svg.append(child);
  }
  return svg;
}

class ImageWidget extends WidgetType {
  readonly loads = imageLoads;

  constructor(
    readonly src: string,
    readonly alt: string,
    readonly shown: boolean,
    // Shown above its Markdown source while the cursor is there, rather than in place of it.
    readonly editing: boolean,
  ) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return this.sameImage(other) && this.editing === other.editing && this.loads === other.loads;
  }

  private sameImage(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt && this.shown === other.shown;
  }

  // Keep the existing picture when only its layout or measurement changed, so it doesn't flicker.
  override updateDOM(dom: HTMLElement, _view: EditorView, from: ImageWidget): boolean {
    if (!this.sameImage(from)) return false;
    dom.classList.toggle("cm-live-image-editing", this.editing);
    return true;
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = `cm-live-image ${this.shown ? "cm-live-image-shown" : "cm-live-image-hidden"}`;
    if (this.editing) wrapper.classList.add("cm-live-image-editing");
    if (this.shown) this.showImage(wrapper, view);
    else this.showLink(wrapper, view);
    return wrapper;
  }

  private get source(): string {
    if (this.src.startsWith("data:")) return "embedded";
    try {
      return new URL(this.src).host;
    } catch {
      return ""; // safeImageUrl only lets valid URLs through.
    }
  }

  private toggleButton(view: EditorView): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-live-image-toggle";
    const label = this.shown ? "Hide image" : `Show image from ${this.source}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.append(iconElement(this.shown ? hideImageIcon : showImageIcon));
    button.addEventListener("click", () => {
      imageChoices.set(this.src, !this.shown);
      view.dispatch({ effects: redrawPreview.of(null) });
    });
    return button;
  }

  // Remote images reveal the reader's IP address to their host, so they can stay as a link.
  private showLink(wrapper: HTMLElement, view: EditorView): void {
    const link = document.createElement("span");
    link.className = "cm-live-image-link";
    link.title = this.src;
    const label = document.createElement("span");
    label.className = "cm-live-image-label";
    label.textContent = `${this.alt || "Image"} · ${this.source}`;
    link.append(this.toggleButton(view), label);
    wrapper.append(link);
  }

  private showImage(wrapper: HTMLElement, view: EditorView): void {
    const image = document.createElement("img");
    image.src = this.src;
    image.alt = this.alt;
    image.title = this.alt;
    image.referrerPolicy = "no-referrer";
    // The line's height changes once the image arrives.
    image.addEventListener("load", () => imageSizeChanged(view));
    image.addEventListener("error", () => {
      image.replaceWith(this.alt ? `🖼 ${this.alt}` : "🖼 Image failed to load");
      wrapper.classList.add("cm-live-image-broken");
      imageSizeChanged(view);
    });
    wrapper.append(this.toggleButton(view), image);
  }

  // The toggle handles its own clicks; anything else moves the cursor to the image.
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest(".cm-live-image-toggle") !== null;
  }
}

// The selection when the mouse went down, while it's held. Images and tables show their source
// when the selection reaches them, which moves the text below; waiting until the button is
// released keeps the text under the pointer still while clicking and drag-selecting.
const pointerSelections = new WeakMap<EditorView, EditorSelection>();

function selectionTouches(view: EditorView, from: number, to: number): boolean {
  const selection = pointerSelections.get(view) ?? view.state.selection;
  return selection.ranges.some((range) => range.from <= to && range.to >= from);
}

const pointerSelection = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (event.button !== 0 || pointerSelections.has(view)) return false;
    pointerSelections.set(view, view.state.selection);
    // A drag of selected text ends without a mouseup, so listen for the drag ending too.
    const release = () => {
      for (const type of ["mouseup", "dragend", "blur"]) window.removeEventListener(type, release, true);
      pointerSelections.delete(view);
      if (view.dom.isConnected) view.dispatch({ effects: redrawPreview.of(null) });
    };
    for (const type of ["mouseup", "dragend", "blur"]) window.addEventListener(type, release, true);
    return false;
  },
});

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
        if (node.name === "Image" && doc.lineAt(node.from).number === doc.lineAt(node.to).number) {
          const url = node.node.getChild("URL");
          const src = url ? safeImageUrl(view.state.sliceDoc(url.from, url.to)) : null;
          const altEnd = node.node.getChildren("LinkMark")[1]?.from ?? node.from;
          if (src) {
            const alt = view.state.sliceDoc(node.from + 2, altEnd);
            const shown = imageChoices.get(src) ?? (!src.startsWith("http") || view.state.facet(loadRemoteImages));
            if (!selectionTouches(view, node.from, node.to)) {
              ranges.push(
                Decoration.replace({ widget: new ImageWidget(src, alt, shown, false) }).range(node.from, node.to),
              );
              return false;
            }
            // While the cursor is on its Markdown, a loaded image stays put above the source
            // rather than collapsing, so the text around it doesn't jump under the pointer.
            if (shown) {
              ranges.push(
                Decoration.widget({ widget: new ImageWidget(src, alt, shown, true), side: -1 }).range(node.from),
              );
            }
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
      const heldSelection = pointerSelections.get(update.view);
      if (heldSelection && update.docChanged) pointerSelections.set(update.view, heldSelection.map(update.changes));
      // Long notes are parsed in the background, so also redraw when the tree grows.
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state) ||
        update.startState.facet(loadRemoteImages) !== update.state.facet(loadRemoteImages) ||
        update.transactions.some((transaction) => transaction.effects.some((effect) => effect.is(redrawPreview)))
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

export const livePreview = [livePreviewDecorations, livePreviewLinks, pointerSelection];
