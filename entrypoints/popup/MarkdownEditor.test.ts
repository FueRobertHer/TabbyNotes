import { syntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";

import {
  markdownFormattingKeymap,
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
});
