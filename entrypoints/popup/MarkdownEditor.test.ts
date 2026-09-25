import { syntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { search } from "@codemirror/search";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import {
  markdownFormattingKeymap,
  pasteUrlAsLink,
  tabbyEditingKeymap,
  tabbyHistoryKeymap,
  tabbyMarkdown,
  toggleLinePrefixCommand,
} from "./MarkdownEditor";

describe("Markdown editor keyboard shortcuts", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    document.body.replaceChildren();
  });

  it.each([
    { key: "b", shiftKey: false, expected: "**word**" },
    { key: "i", shiftKey: false, expected: "_word_" },
    { key: "s", shiftKey: true, expected: "~~word~~" },
  ])("wraps selected text for $key", ({ key, shiftKey, expected }) => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: "word",
      selection: { anchor: 0, head: 4 },
      extensions: [markdownFormattingKeymap],
    });

    const usesCommand = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const pressShortcut = () => {
      const event = new KeyboardEvent("keydown", {
        key,
        shiftKey,
        metaKey: usesCommand,
        ctrlKey: !usesCommand,
        bubbles: true,
        cancelable: true,
      });
      view?.contentDOM.dispatchEvent(event);
      return event;
    };
    const event = pressShortcut();

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe(expected);

    pressShortcut();
    expect(view.state.doc.toString()).toBe("word");
  });

  it("toggles line decorations from the same toolbar command", () => {
    view = new EditorView({
      doc: "first\nsecond",
      selection: { anchor: 0, head: 12 },
    });
    toggleLinePrefixCommand("- ", "List item")(view);
    expect(view.state.doc.toString()).toBe("- first\n- second");

    toggleLinePrefixCommand("- ", "List item")(view);
    expect(view.state.doc.toString()).toBe("first\nsecond");
  });

  it("does not bind Command or Control U to selection undo", () => {
    expect(tabbyHistoryKeymap.some((binding) => binding.key === "Mod-u")).toBe(false);
  });

  it("accepts only backticks as fenced-code delimiters", () => {
    const backticks = EditorState.create({
      doc: "```\ncode\n```",
      extensions: [tabbyMarkdown],
    });
    const tildes = EditorState.create({
      doc: "~~~\nnot code\n~~~",
      extensions: [tabbyMarkdown],
    });

    expect(syntaxTree(backticks).toString()).toContain("FencedCode");
    expect(syntaxTree(tildes).toString()).not.toContain("FencedCode");
  });

  it.each([
    { markdownText: "- item", expected: "- item\n- " },
    { markdownText: "> quote", expected: "> quote\n> " },
  ])("continues Markdown markup when Enter is pressed", ({ markdownText, expected }) => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: markdownText,
      selection: { anchor: markdownText.length },
      extensions: [markdown({ base: markdownLanguage })],
    });

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe(expected);
  });

  it("indents and outdents list items with Tab and Shift+Tab", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: "- parent\n- child",
      selection: { anchor: "- parent\n- ch".length },
      extensions: [tabbyEditingKeymap],
    });
    const press = (shiftKey: boolean) => {
      const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
      view?.contentDOM.dispatchEvent(event);
      return event;
    };

    expect(press(false).defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("- parent\n  - child");

    press(true);
    expect(view.state.doc.toString()).toBe("- parent\n- child");
  });

  it("opens find and replace with Ctrl/Cmd+F", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({ parent, doc: "find me", extensions: [search(), tabbyEditingKeymap] });
    const usesCommand = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const event = new KeyboardEvent("keydown", {
      key: "f",
      metaKey: usesCommand,
      ctrlKey: !usesCommand,
      bubbles: true,
      cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(parent.querySelector(".cm-search")).not.toBeNull();
  });

  it.each([
    { pasted: "https://example.com/a", selection: [4, 9], expected: "See [docs!](https://example.com/a)" },
    { pasted: "https://example.com/a", selection: [9, 9], expected: null },
    { pasted: "not a url", selection: [4, 9], expected: null },
  ])("turns selected text into a link when pasting $pasted", ({ pasted, selection, expected }) => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: "See docs!",
      selection: { anchor: selection[0]!, head: selection[1]! },
      extensions: [pasteUrlAsLink],
    });
    const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, "clipboardData", { value: { getData: () => pasted } });
    view.contentDOM.dispatchEvent(event);

    // Otherwise CodeMirror's own paste handling applies, which never builds a link.
    if (expected) expect(view.state.doc.toString()).toBe(expected);
    else expect(view.state.doc.toString()).not.toContain("](");
  });
});
