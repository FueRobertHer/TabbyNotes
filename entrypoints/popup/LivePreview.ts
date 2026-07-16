import type { EditorState, Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
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
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
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
