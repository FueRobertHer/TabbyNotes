import { beforeEach, describe, expect, it } from "vitest";

import { createNote, createWorkspace } from "../domain/workspace";
import {
  LEGACY_BACKUP_KEY,
  LEGACY_KEY,
  INVALID_WORKSPACE_BACKUP_KEY,
  loadWorkspace,
  notesToRestore,
  parseBackup,
  saveWorkspace,
  serializeBackup,
  STORAGE_QUOTA_CHARS,
  storageUsage,
  WORKSPACE_KEY,
} from "./workspace-storage";

describe("workspace storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a current workspace", () => {
    const workspace = createWorkspace();
    saveWorkspace(workspace);

    expect(loadWorkspace()).toEqual(workspace);
  });

  it("migrates v4 notes without altering their text", () => {
    const legacy = JSON.stringify({
      tabs: [
        { title: "One", text: "plain text is markdown" },
        { title: "Two", text: "# Already Markdown\n\n- item" },
      ],
      activeTab: 1,
      confirmDelete: false,
      height: 500,
      width: 250,
    });
    localStorage.setItem(LEGACY_KEY, legacy);

    const migrated = loadWorkspace();

    expect(migrated.notes.map((note) => note.title)).toEqual(["One", "Two"]);
    expect(migrated.notes[0]?.markdown).toBe("plain text is markdown");
    expect(migrated.notes[1]?.markdown).toBe("# Already Markdown\n\n- item");
    expect(migrated.activeNoteId).toBe(migrated.notes[1]?.id);
    expect(migrated.settings.confirmDelete).toBe(false);
    expect(localStorage.getItem(LEGACY_BACKUP_KEY)).toBe(legacy);
    expect(localStorage.getItem(WORKSPACE_KEY)).not.toBeNull();
  });

  it("does not duplicate migrated notes on subsequent loads", () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({ tabs: [{ title: "Only", text: "hello" }], activeTab: 0 }),
    );

    const first = loadWorkspace();
    const second = loadWorkspace();

    expect(second).toEqual(first);
    expect(second.notes).toHaveLength(1);
  });

  it("migrates v1 editor settings to live preview and horizontal tabs", () => {
    const current = createWorkspace();
    const previous = {
      ...current,
      version: 1,
      settings: {
        theme: "dark",
        editorMode: "split",
        confirmDelete: false,
      },
    };
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(previous));

    const migrated = loadWorkspace();

    expect(migrated.version).toBe(2);
    expect(migrated.notes).toEqual(current.notes);
    expect(migrated.settings).toEqual({
      theme: "dark",
      editorStyle: "live",
      tabLayout: "horizontal",
      confirmDelete: false,
    });
  });

  it("recovers from corrupt current and legacy values", () => {
    localStorage.setItem(WORKSPACE_KEY, "not-json");
    localStorage.setItem(LEGACY_KEY, "also-not-json");

    const workspace = loadWorkspace();

    expect(workspace.notes).toHaveLength(1);
    expect(workspace.activeNoteId).toBe(workspace.notes[0]?.id);
    expect(localStorage.getItem(INVALID_WORKSPACE_BACKUP_KEY)).toBe("not-json");
  });

  it("backs up an unsupported workspace version before recovering", () => {
    const unsupported = JSON.stringify({ ...createWorkspace(), version: 99 });
    localStorage.setItem(WORKSPACE_KEY, unsupported);

    const workspace = loadWorkspace();

    expect(workspace.version).toBe(2);
    expect(localStorage.getItem(INVALID_WORKSPACE_BACKUP_KEY)).toBe(unsupported);
  });

  it("round-trips notes through a backup file", () => {
    const workspace = {
      ...createWorkspace(),
      notes: [createNote({ title: "A", markdown: "# A" }), createNote({ title: "B" })],
    };

    expect(parseBackup(serializeBackup(workspace))).toEqual(workspace.notes);
    expect(parseBackup("# not a backup")).toBeNull();
    expect(parseBackup(JSON.stringify({ notes: "nope" }))).toBeNull();
  });

  it("skips unchanged notes and copies conflicting ones when restoring", () => {
    const unchanged = createNote({ title: "Same", markdown: "same" });
    const edited = createNote({ title: "Edited", markdown: "old" });
    const fresh = createNote({ title: "New" });

    const restored = notesToRestore(
      [unchanged, { ...edited, markdown: "new" }, fresh],
      [unchanged, edited],
    );

    expect(restored.map((note) => note.title)).toEqual(["Edited", "New"]);
    expect(restored[0]?.id).not.toBe(edited.id);
    expect(restored[1]).toBe(fresh);
  });

  it("estimates how much of the storage quota is used", () => {
    expect(storageUsage()).toBe(0);
    localStorage.setItem("k", "x".repeat(STORAGE_QUOTA_CHARS / 2 - 1));
    expect(storageUsage()).toBe(0.5);
  });
});
