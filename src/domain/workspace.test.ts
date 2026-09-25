import { describe, expect, it } from "vitest";

import {
  createNote,
  createWorkspace,
  leadingHeading,
  searchNotes,
  workspaceReducer,
} from "./workspace";

describe("workspaceReducer", () => {
  it("creates and activates a new note", () => {
    const workspace = createWorkspace();
    const note = createNote({ title: "Ideas", markdown: "# Ideas" });

    const next = workspaceReducer(workspace, { type: "note/add", note });

    expect(next.notes).toHaveLength(2);
    expect(next.activeNoteId).toBe(note.id);
  });

  it("keeps the active note when deleting a different tab", () => {
    const first = createNote({ title: "First" });
    const second = createNote({ title: "Second" });
    const third = createNote({ title: "Third" });
    const workspace = {
      ...createWorkspace(),
      notes: [first, second, third],
      activeNoteId: second.id,
    };

    const next = workspaceReducer(workspace, { type: "note/delete", id: third.id });

    expect(next.activeNoteId).toBe(second.id);
    expect(next.notes.map((note) => note.id)).toEqual([first.id, second.id]);
  });

  it("activates the neighboring note when deleting the active tab", () => {
    const first = createNote({ title: "First" });
    const second = createNote({ title: "Second" });
    const third = createNote({ title: "Third" });
    const workspace = {
      ...createWorkspace(),
      notes: [first, second, third],
      activeNoteId: second.id,
    };

    const next = workspaceReducer(workspace, { type: "note/delete", id: second.id });

    expect(next.activeNoteId).toBe(third.id);
  });

  it("always keeps at least one note", () => {
    const workspace = createWorkspace();
    const onlyNote = workspace.notes[0];
    expect(onlyNote).toBeDefined();

    const next = workspaceReducer(workspace, { type: "note/delete", id: onlyNote?.id ?? "" });

    expect(next.notes).toHaveLength(1);
    expect(next.activeNoteId).toBe(next.notes[0]?.id);
  });

  it("restores a deleted note at its old position and activates it", () => {
    const first = createNote({ title: "First" });
    const second = createNote({ title: "Second" });
    const third = createNote({ title: "Third" });
    const workspace = {
      ...createWorkspace(),
      notes: [first, second, third],
      activeNoteId: first.id,
    };

    const deleted = workspaceReducer(workspace, { type: "note/delete", id: second.id });
    const restored = workspaceReducer(deleted, { type: "note/restore", note: second, index: 1 });

    expect(restored.notes.map((note) => note.id)).toEqual([first.id, second.id, third.id]);
    expect(restored.activeNoteId).toBe(second.id);
    expect(workspaceReducer(restored, { type: "note/restore", note: second, index: 0 })).toBe(restored);
  });

  it("replaces the empty placeholder when restoring the only deleted note", () => {
    const workspace = createWorkspace();
    const onlyNote = workspace.notes[0];
    if (!onlyNote) throw new Error("expected a note");

    const deleted = workspaceReducer(workspace, { type: "note/delete", id: onlyNote.id });
    const restored = workspaceReducer(deleted, { type: "note/restore", note: onlyNote, index: 0 });

    expect(restored.notes).toEqual([onlyNote]);
  });

  it("titles a note from its leading heading until the user names it", () => {
    const note = createNote();
    let state = { ...createWorkspace(), notes: [note], activeNoteId: note.id };
    const edit = (markdown: string) =>
      (state = workspaceReducer(state, { type: "note/update", id: note.id, changes: { markdown } }));
    const title = () => state.notes[0]?.title;

    edit("# Shop");
    expect(title()).toBe("Shop");
    edit("# Shopping **list**\n\nmilk");
    expect(title()).toBe("Shopping list");
    edit("milk");
    expect(title()).toBe("Shopping list");

    state = workspaceReducer(state, { type: "note/update", id: note.id, changes: { title: "Errands" } });
    edit("# Something else");
    expect(title()).toBe("Errands");
  });

  it("reads only a heading on the first non-blank line", () => {
    expect(leadingHeading("\n\n## Plan ##\ntext")).toBe("Plan");
    expect(leadingHeading("intro\n# Later")).toBeNull();
    expect(leadingHeading("#hashtag")).toBeNull();
  });

  it("reorders notes by stable IDs", () => {
    const first = createNote({ title: "First" });
    const second = createNote({ title: "Second" });
    const third = createNote({ title: "Third" });
    const workspace = {
      ...createWorkspace(),
      notes: [first, second, third],
      activeNoteId: first.id,
    };

    const next = workspaceReducer(workspace, {
      type: "note/reorder",
      sourceId: third.id,
      targetId: first.id,
    });

    expect(next.notes.map((note) => note.title)).toEqual(["Third", "First", "Second"]);
    expect(next.activeNoteId).toBe(first.id);
  });

  it("drops a note after its target when the edge is 'after'", () => {
    const first = createNote({ title: "First" });
    const second = createNote({ title: "Second" });
    const third = createNote({ title: "Third" });
    const workspace = {
      ...createWorkspace(),
      notes: [first, second, third],
      activeNoteId: first.id,
    };

    const next = workspaceReducer(workspace, {
      type: "note/reorder",
      sourceId: first.id,
      targetId: second.id,
      edge: "after",
    });

    expect(next.notes.map((note) => note.title)).toEqual(["Second", "First", "Third"]);
  });

  it("drops a note before its target when the edge is 'before'", () => {
    const first = createNote({ title: "First" });
    const second = createNote({ title: "Second" });
    const third = createNote({ title: "Third" });
    const workspace = {
      ...createWorkspace(),
      notes: [first, second, third],
      activeNoteId: first.id,
    };

    const next = workspaceReducer(workspace, {
      type: "note/reorder",
      sourceId: third.id,
      targetId: second.id,
      edge: "before",
    });

    expect(next.notes.map((note) => note.title)).toEqual(["First", "Third", "Second"]);
  });

  it("updates editor and tab layout preferences together", () => {
    const workspace = createWorkspace();

    const next = workspaceReducer(workspace, {
      type: "settings/update",
      changes: { editorStyle: "source", tabLayout: "vertical" },
    });

    expect(next.settings.editorStyle).toBe("source");
    expect(next.settings.tabLayout).toBe("vertical");
  });

  it("replaces the whole workspace, e.g. when another window saved changes", () => {
    const state = createWorkspace();
    const incoming = createWorkspace();
    expect(workspaceReducer(state, { type: "workspace/replace", workspace: incoming })).toBe(incoming);
  });
});

describe("searchNotes", () => {
  const groceries = createNote({ title: "Groceries", markdown: "milk, eggs and bread", updatedAt: 1 });
  const trip = createNote({ title: "Trip plan", markdown: "Pack the tent and buy groceries on the way", updatedAt: 3 });
  const recipes = createNote({ title: "Recipes", markdown: "Bread: flour, water, salt", updatedAt: 2 });
  const notes = [groceries, trip, recipes];

  it("lists every note, most recently edited first, for an empty query", () => {
    expect(searchNotes(notes, "  ").map(({ note }) => note.title)).toEqual(["Trip plan", "Recipes", "Groceries"]);
  });

  it("ranks title matches above body matches and adds body snippets", () => {
    const results = searchNotes(notes, "groc");
    expect(results.map(({ note }) => note.title)).toEqual(["Groceries", "Trip plan"]);
    expect(results[0]?.snippet).toBeUndefined();
    expect(results[1]?.snippet).toContain("buy groceries");
  });

  it("requires every word to match the title or body", () => {
    expect(searchNotes(notes, "bread flour").map(({ note }) => note.title)).toEqual(["Recipes"]);
    expect(searchNotes(notes, "bread tent")).toEqual([]);
  });
});
