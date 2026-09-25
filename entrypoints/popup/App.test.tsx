import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createNote } from "../../src/domain/workspace";
import { serializeBackup, WORKSPACE_KEY } from "../../src/lib/workspace-storage";
import App from "./App";

function seed(notes = [createNote({ title: "First" }), createNote({ title: "Second" })]) {
  window.localStorage.setItem(
    WORKSPACE_KEY,
    JSON.stringify({
      version: 2,
      notes,
      activeNoteId: notes[0]?.id,
      settings: { theme: "light", editorStyle: "live", tabLayout: "horizontal", confirmDelete: false },
    }),
  );
  return notes;
}

describe("App", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("undoes closing a tab from the toast", async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Close Second" }));
    expect(screen.queryByRole("tab", { name: "Second" })).toBeNull();

    await user.click(await screen.findByRole("button", { name: "Undo" }));
    expect(screen.getByRole("tab", { name: "Second" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("reopens the most recently closed tab with Ctrl+Shift+T", async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Close First" }));
    await user.click(screen.getByRole("button", { name: "Close Second" }));
    await user.keyboard("{Control>}{Shift>}t{/Shift}{/Control}");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Second" })).toBeInTheDocument());
    await act(async () => {
      await user.keyboard("{Control>}{Shift>}t{/Shift}{/Control}");
    });
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["First", "Second"]);
  });

  it("restores a JSON backup alongside Markdown imports", async () => {
    const [first] = seed();
    const user = userEvent.setup();
    const { container } = render(<App />);

    const backupNotes = [first!, createNote({ title: "From backup" })];
    const backup = serializeBackup({
      version: 2,
      notes: backupNotes,
      activeNoteId: first!.id,
      settings: { theme: "light", editorStyle: "live", tabLayout: "horizontal", confirmDelete: true },
    });
    const input = container.querySelector<HTMLInputElement>("input[type='file']")!;
    await user.upload(input, [
      new File([backup], "backup.json", { type: "application/json" }),
      new File(["# Hi"], "hello.md", { type: "text/markdown" }),
    ]);

    await screen.findByText("Imported 2 notes");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "First",
      "Second",
      "From backup",
      "hello",
    ]);
  });

  it("jumps to a note from the Ctrl+P switcher", async () => {
    seed([
      createNote({ title: "First" }),
      createNote({ title: "Recipes", markdown: "Bread needs flour" }),
    ]);
    const user = userEvent.setup();
    render(<App />);

    await user.keyboard("{Control>}p{/Control}");
    await user.type(screen.getByRole("combobox", { name: "Search notes" }), "flour");
    expect(screen.getByRole("option", { name: /Recipes/ })).toHaveTextContent("Bread needs flour");
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("dialog", { name: "Go to note" })).toBeNull();
    expect(screen.getByRole("tab", { name: "Recipes" })).toHaveAttribute("aria-selected", "true");
  });

  it("renames a tab after double-clicking it", async () => {
    seed();
    const user = userEvent.setup();
    render(<App />);

    await user.dblClick(screen.getByRole("tab", { name: "Second" }));
    const title = screen.getByRole("textbox", { name: "Note title" });
    await waitFor(() => expect(title).toHaveFocus());
    await user.keyboard("Renamed{Enter}");

    expect(screen.getByRole("tab", { name: "Renamed" })).toHaveAttribute("aria-selected", "true");
  });
});
