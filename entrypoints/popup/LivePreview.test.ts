import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { livePreview } from "./LivePreview";

describe("livePreview", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    document.body.replaceChildren();
  });

  it("formats Markdown in place and keeps task widgets editable", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: [
        "# Heading",
        "",
        "This is **bold** and [a link](https://example.com).",
        "This is ~~outdated~~.",
        "",
        "- Bullet",
        "",
        "> Quote",
        "",
        "```ts",
        "const answer = 42;",
        "```",
        "",
        "- [ ] Open task",
        "- [x] Finished task",
      ].join("\n"),
      extensions: [markdown({ base: markdownLanguage }), livePreview],
    });

    expect(parent.querySelector(".cm-live-heading-1")).not.toBeNull();
    expect(parent.querySelector(".cm-live-strong")).not.toBeNull();
    expect(parent.querySelector(".cm-live-strikethrough")).not.toBeNull();
    expect(parent.querySelector(".cm-live-bullet")).not.toBeNull();
    expect(parent.querySelector(".cm-live-blockquote-line")).not.toBeNull();
    expect(parent.querySelectorAll(".cm-live-code-line")).toHaveLength(3);
    expect(parent.querySelector(".cm-live-task-complete")?.textContent).toContain("Finished task");
    expect(parent.textContent).not.toContain("https://example.com");
    expect(parent.textContent).not.toContain("~~");
    expect(parent.textContent).not.toContain("```");

    view.dispatch({ selection: { anchor: view.state.doc.toString().indexOf("bold") } });
    expect(parent.textContent).toContain("https://example.com");

    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    parent.querySelector<HTMLElement>(".cm-live-link")?.dispatchEvent(
      new MouseEvent("click", { button: 0, ctrlKey: true, bubbles: true, cancelable: true }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://example.com/",
      "_blank",
      "noopener,noreferrer",
    );

    const checkboxes = parent.querySelectorAll<HTMLInputElement>(".cm-live-checkbox");
    expect(checkboxes).toHaveLength(2);
    checkboxes[0]?.click();

    expect(view.state.doc.toString()).toContain("- [x] Open task");
    expect(parent.querySelectorAll(".cm-live-task-complete")).toHaveLength(2);
  });
});
