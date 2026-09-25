import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { Compartment, type Extension } from "@codemirror/state";
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
import { tags } from "@lezer/highlight";
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

// Tab and Shift+Tab indent and outdent (e.g. to nest list items). Pressing Escape
// first lets Tab move focus out of the editor, as CodeMirror does by default.
export const tabbyEditingKeymap = keymap.of([
  ...defaultKeymap,
  ...tabbyHistoryKeymap,
  ...searchKeymap,
  indentWithTab,
]);

export const tabbyMarkdown = markdown({
  base: markdownLanguage,
  extensions: backtickFencedCode,
  // Each language's parser is fetched from its own chunk the first time a note uses it.
  codeLanguages: languages,
});

// CodeMirror's defaultHighlightStyle hardcodes light-theme colors (e.g. dark blue
// URLs and code fence info strings) that are unreadable on the dark theme. These
// rules use the app's CSS variables so they follow the active theme.
export const tabbyHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.link, color: "var(--accent-strong)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--accent-strong)" },
  { tag: [tags.labelName, tags.processingInstruction, tags.contentSeparator, tags.meta], color: "var(--muted)" },
  { tag: tags.quote, color: "var(--muted)" },
  { tag: tags.invalid, color: "#d85b4b" },
  // Code inside fenced blocks, e.g. ```ts.
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.controlKeyword], color: "var(--syntax-keyword)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.character], color: "var(--syntax-string)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--syntax-number)" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.macroName], color: "var(--syntax-function)" },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.tagName], color: "var(--syntax-type)" },
  { tag: [tags.propertyName, tags.attributeName], color: "var(--syntax-property)" },
]);

const SANS_FONT_STACK =
  'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const MONO_FONT_STACK = '"DM Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

// Extensions that depend on the live-preview toggle. Kept in a Compartment so the
// toggle can be reconfigured in place instead of forcing a full editor remount,
// which would otherwise discard the undo history.
function previewExtensions(livePreviewEnabled: boolean): Extension {
  return [
    livePreviewEnabled ? livePreview : [],
    EditorView.theme({
      ".cm-scroller": {
        fontFamily: livePreviewEnabled ? SANS_FONT_STACK : MONO_FONT_STACK,
      },
    }),
  ];
}

export interface MarkdownEditorHandle {
  focus: () => void;
  wrapSelection: (before: string, after: string, placeholder: string) => void;
  prefixLine: (prefix: string, placeholder: string) => void;
  insert: (text: string) => void;
  openSearch: () => void;
}

interface MarkdownEditorProps {
  /**
   * Seeds the editor when it mounts. Later changes are reconciled into the view
   * only when they differ from the current document, so the editor stays the
   * source of truth for local typing while still reflecting external updates.
   */
  initialValue: string;
  onChange: (value: string) => void;
  label: string;
  livePreviewEnabled: boolean;
}

const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ initialValue, onChange, label, livePreviewEnabled }, ref) {
    const hostRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const onChangeRef = useRef(onChange);
    const initialValueRef = useRef(initialValue);
    const previewCompartment = useRef(new Compartment()).current;
    // Read at (re)mount only; the effect below keeps the compartment in sync afterward.
    const livePreviewEnabledRef = useRef(livePreviewEnabled);
    livePreviewEnabledRef.current = livePreviewEnabled;

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
          search({ top: true }),
          syntaxHighlighting(tabbyHighlightStyle),
          markdownFormattingKeymap,
          tabbyEditingKeymap,
          tabbyMarkdown,
          previewCompartment.of(previewExtensions(livePreviewEnabledRef.current)),
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
    }, [label, previewCompartment]);

    // Toggle live/source in place so the undo history survives the switch.
    useEffect(() => {
      viewRef.current?.dispatch({
        effects: previewCompartment.reconfigure(previewExtensions(livePreviewEnabled)),
      });
    }, [livePreviewEnabled, previewCompartment]);

    // Reflect external document changes without clobbering local edits. When the
    // change originated from this editor, the doc already matches and we skip it.
    useEffect(() => {
      const view = viewRef.current;
      if (!view) return;
      const current = view.state.doc.toString();
      if (initialValue !== current) {
        view.dispatch({ changes: { from: 0, to: current.length, insert: initialValue } });
      }
    }, [initialValue]);

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
      openSearch() {
        const view = viewRef.current;
        if (view) openSearchPanel(view);
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
