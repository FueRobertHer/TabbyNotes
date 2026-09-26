import { describe, expect, it } from "vitest";

import { createNote } from "../domain/workspace";
import { markdownFiles, markdownZipEntries, noteFromMarkdownFile, safeFilename } from "./markdown-files";

describe("Markdown files", () => {
  it.each([
    ["Recipes", "Recipes"],
    ["  a/b: c?  ", "a-b- c-"],
    ["Ends with dots...", "Ends with dots"],
    ["CON", "CON note"],
    ["", "Untitled note"],
  ])("makes %j a safe file name", (title, expected) => {
    expect(safeFilename(title)).toBe(expected);
  });

  it("names each note's file after its title, without repeating a name in any case", () => {
    const notes = [createNote({ title: "Todo" }), createNote({ title: "todo" }), createNote({ title: "Todo" }), createNote({ title: "Ideas" })];
    expect(markdownFiles(notes).map((file) => file.name)).toEqual(["Todo.md", "todo (2).md", "Todo (3).md", "Ideas.md"]);
  });

  it("titles an imported note after its file and dates it from the zip", () => {
    const modified = new Date(2026, 8, 1, 9, 0);
    const note = noteFromMarkdownFile("notes/Trip plan.md", "# Trip", modified);
    expect(note).toMatchObject({ title: "Trip plan", markdown: "# Trip", createdAt: modified.getTime(), updatedAt: modified.getTime() });
  });

  it("keeps only the Markdown files in a zip, skipping hidden files and macOS extras", () => {
    const entry = (name: string) => ({ name, data: new Uint8Array(), modified: new Date() });
    const kept = markdownZipEntries([
      entry("Todo.md"),
      entry("notes/Ideas.markdown"),
      entry("notes/.hidden.md"),
      entry("__MACOSX/notes/._Todo.md"),
      entry("photo.png"),
    ]);
    expect(kept.map((file) => file.name)).toEqual(["Todo.md", "notes/Ideas.markdown"]);
  });
});
