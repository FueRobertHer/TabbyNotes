import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import {
  type Command,
  drawSelection,
  EditorView,
  highlightSpecialChars,
  keymap,
} from "@codemirror/view";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { backtickFencedCode } from "./BacktickFencedCode";
import { livePreview } from "./LivePreview";

function toggleSelectionCommand(before: string, after: string, placeholder: string): Command {
  return (view) => {
    const { from, to } = view.state.selection.main;
    const hasOuterMarkers =
      from >= before.length &&
      view.state.sliceDoc(from - before.length, from) === before &&
      view.state.sliceDoc(to, to + after.length) === after;
    const selectionIncludesMarkers =
      to - from >= before.length + after.length &&
      view.state.sliceDoc(from, from + before.length) === before &&
      view.state.sliceDoc(to - after.length, to) === after;

    if (hasOuterMarkers) {
      view.dispatch({
        changes: [
          { from: from - before.length, to: from },
          { from: to, to: to + after.length },
        ],
        selection: {
          anchor: from - before.length,
          head: to - before.length,
        },
      });
      return true;
    }

    if (selectionIncludesMarkers) {
      view.dispatch({
        changes: [
          { from, to: from + before.length },
          { from: to - after.length, to },
        ],
        selection: {
          anchor: from,
          head: to - before.length - after.length,
        },
      });
      return true;
    }

    const selected = view.state.sliceDoc(from, to) || placeholder;
    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: {
        anchor: from + before.length,
        head: from + before.length + selected.length,
      },
    });
    return true;
  };
}

export function toggleLinePrefixCommand(prefix: string, placeholder: string): Command {
  return (view) => {
    const { from, to } = view.state.selection.main;
    const firstLine = view.state.doc.lineAt(from);
    const lastLine = view.state.doc.lineAt(to);
    const selected = view.state.sliceDoc(firstLine.from, lastLine.to) || placeholder;
    const lines = selected.split("\n");
    const removePrefix = lines.every((line) => line.startsWith(prefix));
    const insert = lines
      .map((line) =>
        removePrefix ? line.slice(prefix.length) : `${prefix}${line || placeholder}`,
      )
      .join("\n");
    view.dispatch({
      changes: { from: firstLine.from, to: lastLine.to, insert },
      selection:
        from === to
          ? { anchor: firstLine.from + (removePrefix ? 0 : prefix.length) }
          : { anchor: firstLine.from, head: firstLine.from + insert.length },
    });
    return true;
  };
}

export const markdownFormattingKeymap = keymap.of([
  { key: "Mod-b", run: toggleSelectionCommand("**", "**", "bold text") },
  { key: "Mod-i", run: toggleSelectionCommand("_", "_", "italic text") },
  { key: "Mod-Shift-s", run: toggleSelectionCommand("~~", "~~", "strikethrough text") },
]);

export const tabbyHistoryKeymap = historyKeymap.filter(
  (binding) => binding.key !== "Mod-u",
);

export const tabbyMarkdown = markdown({
  base: markdownLanguage,
  extensions: backtickFencedCode,
});

export interface MarkdownEditorHandle {
  focus: () => void;
  wrapSelection: (before: string, after: string, placeholder: string) => void;
  prefixLine: (prefix: string, placeholder: string) => void;
  insert: (text: string) => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  livePreviewEnabled: boolean;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, label, livePreviewEnabled }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const initialValueRef = useRef(value);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host) return;

      const view = new EditorView({
        doc: initialValueRef.current,
        parent: host,
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          markdownFormattingKeymap,
          keymap.of([...defaultKeymap, ...tabbyHistoryKeymap]),
          tabbyMarkdown,
          ...(livePreviewEnabled ? [livePreview] : []),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": label,
            spellcheck: "true",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.theme({
            "&": { height: "100%", backgroundColor: "transparent" },
            ".cm-scroller": {
              fontFamily:
                livePreviewEnabled
                  ? 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
                  : '"DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
              lineHeight: "1.72",
              overflow: "auto",
            },
            ".cm-content": { padding: "24px 30px 48px" },
            ".cm-line": { padding: "0" },
            ".cm-gutters": {
              backgroundColor: "transparent",
              border: "none",
              color: "var(--muted)",
              paddingLeft: "8px",
            },
            ".cm-activeLine, .cm-activeLineGutter": {
              backgroundColor: "var(--active-line)",
            },
            ".cm-cursor": { borderLeftColor: "var(--accent-strong)" },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
              backgroundColor: "var(--selection) !important",
            },
            ".cm-content ::selection": {
              backgroundColor: "var(--selection) !important",
              color: "var(--selection-ink) !important",
            },
            ".cm-focused": { outline: "none" },
          }),
        ],
      });

      viewRef.current = view;
      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, [label, livePreviewEnabled]);

    useImperativeHandle(ref, () => ({
      focus() {
        viewRef.current?.focus();
      },
      wrapSelection(before, after, placeholder) {
        const view = viewRef.current;
        if (!view) return;
        toggleSelectionCommand(before, after, placeholder)(view);
        view.focus();
      },
      prefixLine(prefix, placeholder) {
        const view = viewRef.current;
        if (!view) return;
        toggleLinePrefixCommand(prefix, placeholder)(view);
        view.focus();
      },
      insert(text) {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        view.focus();
      },
    }));

    return <div ref={hostRef} className="h-full min-h-0" />;
  },
);

export default MarkdownEditor;
