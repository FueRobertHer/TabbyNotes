import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";

import { livePreview, loadRemoteImages, tableCells } from "./LivePreview";

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

  it("splits table rows on unescaped pipes", () => {
    expect(tableCells("| a | b \\| c |  |")).toEqual(["a", "b | c", ""]);
    expect(tableCells("a | b")).toEqual(["a", "b"]);
  });

  it("renders tables and images until the cursor enters them", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const doc = [
      "Intro",
      "",
      "| Item | Qty |",
      "| --- | ---: |",
      "| **Milk** | 2 |",
      "",
      "![A cat](https://example.com/cat.png)",
      "![Bad](javascript:alert(1))",
    ].join("\n");
    view = new EditorView({
      parent,
      doc,
      selection: { anchor: 0 },
      extensions: [markdown({ base: markdownLanguage }), livePreview],
    });

    const rows = parent.querySelectorAll(".cm-live-table-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toBe("ItemQty");
    expect(rows[1]?.querySelector("strong")?.textContent).toBe("Milk");
    expect(rows[1]?.querySelectorAll<HTMLElement>(".cm-live-table-cell")[1]?.style.textAlign).toBe("right");
    expect(parent.textContent).not.toContain("---");

    // Web images stay a link until their toggle is clicked, unless the setting allows them.
    expect(parent.querySelector(".cm-live-image img")).toBeNull();
    expect(parent.querySelector(".cm-live-image-label")?.textContent).toBe("A cat · example.com");
    parent.querySelector<HTMLButtonElement>("[aria-label='Show image from example.com']")?.click();
    const image = parent.querySelector<HTMLImageElement>(".cm-live-image img");
    expect(image?.src).toBe("https://example.com/cat.png");
    expect(image?.alt).toBe("A cat");
    expect(parent.querySelectorAll(".cm-live-image")).toHaveLength(1);

    // The same toggle turns it back into a link.
    parent.querySelector<HTMLButtonElement>("[aria-label='Hide image']")?.click();
    expect(parent.querySelector(".cm-live-image img")).toBeNull();
    expect(parent.querySelector(".cm-live-image-label")?.textContent).toBe("A cat · example.com");
    expect(parent.textContent).toContain("javascript:alert(1)");

    view.dispatch({ selection: { anchor: doc.indexOf("Milk") } });
    expect(parent.querySelector(".cm-live-table-row")).toBeNull();
    expect(parent.querySelectorAll(".cm-live-table-source")).toHaveLength(3);

    view.dispatch({ selection: { anchor: doc.indexOf("A cat") } });
    expect(parent.querySelector(".cm-live-image")).toBeNull();
    expect(parent.textContent).toContain("https://example.com/cat.png");
  });

  it("loads web images straight away when the setting allows it", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: "Intro\n\n![Dog](https://example.com/dog.png)",
      extensions: [markdown({ base: markdownLanguage }), livePreview, loadRemoteImages.of(true)],
    });

    expect(parent.querySelector<HTMLImageElement>(".cm-live-image img")?.src).toBe("https://example.com/dog.png");
  });

  it("hides an image that loaded automatically, and every copy of it", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: "Intro\n\n![Owl](https://example.com/owl.png)\n\n![Owl again](https://example.com/owl.png)",
      extensions: [markdown({ base: markdownLanguage }), livePreview, loadRemoteImages.of(true)],
    });

    expect(parent.querySelectorAll(".cm-live-image img")).toHaveLength(2);
    parent.querySelector<HTMLButtonElement>("[aria-label='Hide image']")?.click();
    expect(parent.querySelectorAll(".cm-live-image img")).toHaveLength(0);
    expect([...parent.querySelectorAll(".cm-live-image-label")].map((label) => label.textContent)).toEqual([
      "Owl · example.com",
      "Owl again · example.com",
    ]);
  });

  it.each([
    ["![multi\nline alt](https://example.com/a.png)", "alt text"],
    ["![a](\nhttps://example.com/a.png)", "URL"],
  ])("leaves an image written across lines as text (%#: %s)", (image) => {
    const parent = document.createElement("div");
    document.body.append(parent);
    const doc = `Intro\n\n${image}`;
    // CodeMirror throws if a plugin replaces a line break, including when the view is created.
    view = new EditorView({
      parent,
      doc,
      selection: { anchor: doc.length },
      extensions: [markdown({ base: markdownLanguage }), livePreview],
    });
    view.dispatch({ selection: { anchor: 0 } });

    expect(parent.querySelector(".cm-live-image")).toBeNull();
    expect(parent.textContent).toContain("example.com/a.png");
  });

  it("renders a table inside a blockquote without the quote marker as a column", () => {
    const parent = document.createElement("div");
    document.body.append(parent);
    view = new EditorView({
      parent,
      doc: "Intro\n\n> | a | b |\n> | --- | --- |\n> | 1 | 2 |",
      extensions: [markdown({ base: markdownLanguage }), livePreview],
    });

    const rows = [...parent.querySelectorAll(".cm-live-table-row")].map((row) =>
      [...row.querySelectorAll(".cm-live-table-cell")].map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parent.textContent).not.toContain(">");
  });
});
