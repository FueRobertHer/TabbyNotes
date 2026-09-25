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

// Simulates another open copy (window or side panel) saving the given notes.
function saveFromOtherCopy(notes: ReturnType<typeof createNote>[]) {
  seed(notes);
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: WORKSPACE_KEY, newValue: window.localStorage.getItem(WORKSPACE_KEY) }),
    );
  });
}

const storedTitles = () =>
  JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).notes.map((note: { title: string }) => note.title);

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
      settings: { theme: "light", editorStyle: "live", tabLayout: "horizontal", confirmDelete: true, loadRemoteImages: false },
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

  it("picks up changes saved by another TabbyNotes window", async () => {
    const [first, second] = seed();
    render(<App />);

    const saved = seed([first!, { ...second!, title: "Renamed elsewhere" }]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: WORKSPACE_KEY,
          newValue: window.localStorage.getItem(WORKSPACE_KEY),
        }),
      );
    });

    expect(screen.getByRole("tab", { name: saved[1]!.title })).toBeInTheDocument();
  });

  it("keeps unsaved typing when another window saves at the same moment", async () => {
    const [first, second] = seed();
    const user = userEvent.setup();
    render(<App />);

    // Rename the open note here; the save is still debounced when the other window writes.
    const title = screen.getByRole("textbox", { name: "Note title" });
    await user.clear(title);
    await user.type(title, "Typed here");
    seed([first!, { ...second!, title: "Renamed there", updatedAt: Date.now() + 1 }]);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: WORKSPACE_KEY, newValue: window.localStorage.getItem(WORKSPACE_KEY) }),
      );
    });

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Typed here", "Renamed there"]);
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(WORKSPACE_KEY)!).notes.map((n: { title: string }) => n.title)).toEqual([
        "Typed here",
        "Renamed there",
      ]),
    );
  });

  it("stays on its own tab and doesn't write back another window's save", async () => {
    const [first, second] = seed();
    render(<App />);

    const theirs = JSON.stringify({
      version: 2,
      notes: [first, { ...second!, title: "Renamed there" }],
      activeNoteId: second!.id,
      settings: { theme: "light", editorStyle: "live", tabLayout: "horizontal", confirmDelete: false, loadRemoteImages: false },
    });
    window.localStorage.setItem(WORKSPACE_KEY, theirs);
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_KEY, newValue: theirs }));
    });

    expect(screen.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Renamed there" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(window.localStorage.getItem(WORKSPACE_KEY)).toBe(theirs);
  });

  it("keeps a tab restored with Undo when another copy saves before this one does", async () => {
    const [first, second] = seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Close Second" }));
    await waitFor(() => expect(storedTitles()).toEqual(["First"]));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    saveFromOtherCopy([{ ...first!, title: "First edited there", updatedAt: Date.now() }]);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["First edited there", "Second"]);
    await waitFor(() => expect(storedTitles()).toEqual(["First edited there", "Second"]));
    expect(second).toBeDefined();
  });

  it("keeps a tab closed here closed when another copy saves before this one does", async () => {
    const [first, second] = seed();
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Close Second" }));
    saveFromOtherCopy([first!, second!]);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["First"]);
    await waitFor(() => expect(storedTitles()).toEqual(["First"]));
  });

  it("drops a note the other copy deleted even while this copy has unsaved typing", async () => {
    const [first, second] = seed();
    const user = userEvent.setup();
    render(<App />);

    saveFromOtherCopy([first!, { ...second!, title: "Second edited there", updatedAt: Date.now() }]);
    const title = screen.getByRole("textbox", { name: "Note title" });
    await user.type(title, "!");
    saveFromOtherCopy([first!]);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["First!"]);
    await waitFor(() => expect(storedTitles()).toEqual(["First!"]));
  });

  it("merges another copy's save before writing, even if its storage event hasn't arrived", async () => {
    const [first, second] = seed();
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Note title" }), "!");
    // The other copy saves a new note, but this copy saves before hearing about it.
    seed([first!, second!, createNote({ title: "Made there" })]);
    await waitFor(() => expect(storedTitles()).toEqual(["First!", "Second", "Made there"]));
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["First!", "Second", "Made there"]);
  });

  it("writes the merged state when the popup closes right after another copy saves", async () => {
    const [first, second] = seed();
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole("textbox", { name: "Note title" }), "!");
    seed([first!, second!, createNote({ title: "Made there" })]);
    // Both events arrive before React would normally render the merge.
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: WORKSPACE_KEY, newValue: window.localStorage.getItem(WORKSPACE_KEY) }),
      );
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(storedTitles()).toEqual(["First!", "Second", "Made there"]);
  });
});
