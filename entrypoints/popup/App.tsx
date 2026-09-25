import {
  Bold,
  Check,
  Code2,
  DatabaseBackup,
  Download,
  FileDown,
  FileSearch,
  FileText,
  Heading2,
  Import,
  Italic,
  Link,
  List,
  ListChecks,
  Maximize2,
  Minus,
  Moon,
  PanelRight,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Settings,
  SquareCode,
  Sparkles,
  Strikethrough,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  createNote,
  DEFAULT_NOTE_TITLE,
  workspaceReducer,
  type Note,
} from "../../src/domain/workspace";
import {
  loadWorkspace,
  notesToRestore,
  parseBackup,
  saveWorkspace,
  serializeBackup,
  storageUsage,
  WORKSPACE_KEY,
} from "../../src/lib/workspace-storage";

import { countWords, formatEdited } from "../../src/lib/format";
import Dialog from "./Dialog";
import {
  canOpenSidePanel,
  currentWindowId,
  openSidePanel,
  openStandaloneWindow,
  viewMode,
} from "./extension-views";
import type { MarkdownEditorHandle } from "./MarkdownEditor";
import QuickSwitcher from "./QuickSwitcher";

const MarkdownEditor = lazy(() => import("./MarkdownEditor"));

type SaveStatus = "saved" | "error";

interface ClosedNote {
  note: Note;
  index: number;
}

// How many closed tabs Ctrl/⌘ Shift T can bring back, newest first.
const CLOSED_NOTES_LIMIT = 20;
const UNDO_TOAST_MS = 6000;
// Show storage use in the footer from this fraction of the quota, and warn from the next.
const STORAGE_SHOW_AT = 0.5;
const STORAGE_WARN_AT = 0.85;

const keyboardShortcuts = [
  ["Open TabbyNotes", "Alt Shift N"],
  ["New note", "Ctrl/⌘ N"],
  ["Go to note", "Ctrl/⌘ P"],
  ["Find and replace", "Ctrl/⌘ F"],
  ["Reopen closed tab", "Ctrl/⌘ Shift T"],
  ["Next / previous tab", "Ctrl Tab / Ctrl Shift Tab"],
  ["Indent / outdent", "Tab / Shift Tab"],
] as const;

const formattingActions = [
  { label: "Bold", shortcut: "Ctrl/⌘ B", icon: Bold, run: (editor: MarkdownEditorHandle) => editor.wrapSelection("**", "**", "bold text") },
  { label: "Italic", shortcut: "Ctrl/⌘ I", icon: Italic, run: (editor: MarkdownEditorHandle) => editor.wrapSelection("_", "_", "italic text") },
  { label: "Strikethrough", shortcut: "Ctrl/⌘ Shift S", icon: Strikethrough, run: (editor: MarkdownEditorHandle) => editor.wrapSelection("~~", "~~", "strikethrough text") },
  { label: "Heading", icon: Heading2, run: (editor: MarkdownEditorHandle) => editor.prefixLine("## ", "Heading") },
  { label: "Link", icon: Link, run: (editor: MarkdownEditorHandle) => editor.wrapSelection("[", "](https://)", "link text") },
  { label: "Bulleted list", icon: List, run: (editor: MarkdownEditorHandle) => editor.prefixLine("- ", "List item") },
  { label: "Task list", icon: ListChecks, run: (editor: MarkdownEditorHandle) => editor.prefixLine("- [ ] ", "Task") },
  { label: "Quote", icon: Quote, run: (editor: MarkdownEditorHandle) => editor.prefixLine("> ", "Quote") },
  { label: "Inline code", icon: Code2, run: (editor: MarkdownEditorHandle) => editor.wrapSelection("`", "`", "code") },
  { label: "Code block", icon: SquareCode, run: (editor: MarkdownEditorHandle) => editor.wrapSelection("```\n", "\n```", "code") },
  { label: "Horizontal rule", icon: Minus, run: (editor: MarkdownEditorHandle) => editor.insert("\n\n---\n\n") },
] as const;

function safeFilename(title: string): string {
  const safe = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return safe || DEFAULT_NOTE_TITLE;
}

function downloadFile(filename: string, content: string, type = "text/markdown"): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}


export default function App() {
  const [workspace, dispatch] = useReducer(workspaceReducer, null, () => loadWorkspace());
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [storageUsed, setStorageUsed] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: "before" | "after" } | null>(null);
  const [tabOverflow, setTabOverflow] = useState({ start: false, end: false });
  const [undoToastNote, setUndoToastNote] = useState<Note | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Re-render periodically so "Edited 5 min ago" stays current.
  const [now, setNow] = useState(() => Date.now());
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const tabListRef = useRef<HTMLDivElement>(null);
  // Only read inside event handlers, so a ref avoids re-rendering on every close.
  const closedNotesRef = useRef<ClosedNote[]>([]);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  const activeNote = useMemo(
    () => workspace.notes.find((note) => note.id === workspace.activeNoteId) ?? workspace.notes[0],
    [workspace.activeNoteId, workspace.notes],
  );

  const persist = useCallback(() => {
    try {
      saveWorkspace(workspaceRef.current);
      setSaveStatus("saved");
      setStorageUsed(storageUsage());
    } catch {
      setSaveStatus("error");
    }
  }, []);

  // Debounce writes so a burst of keystrokes serializes the workspace once, not per character.
  useEffect(() => {
    const timeout = window.setTimeout(persist, 400);
    return () => window.clearTimeout(timeout);
  }, [workspace, persist]);

  // The debounce is cleared on unmount, so flush any pending change before the popup closes.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [persist]);

  // The popup and a standalone window can be open at once. Pick up changes the other
  // one saved so neither overwrites the other with a stale copy.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== WORKSPACE_KEY || event.newValue === null) return;
      dispatch({ type: "workspace/replace", workspace: loadWorkspace() });
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const view = viewMode();
  const windowIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (view !== "popup") return;
    currentWindowId().then((id) => {
      windowIdRef.current = id;
    }, () => {});
  }, [view]);

  const openInWindow = useCallback(async () => {
    persist();
    await openStandaloneWindow();
    window.close();
  }, [persist]);

  const openInSidePanel = useCallback(() => {
    persist();
    openSidePanel(windowIdRef.current).then(
      () => window.close(),
      () => setNotice("Couldn’t open the side panel. Try again from the browser’s side panel menu."),
    );
  }, [persist]);

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.settings.theme;
  }, [workspace.settings.theme]);

  const addNote = useCallback(() => dispatch({ type: "note/add" }), []);

  const deleteNote = useCallback((note: Note) => {
    const index = workspaceRef.current.notes.findIndex((candidate) => candidate.id === note.id);
    if (index < 0) return;
    dispatch({ type: "note/delete", id: note.id });
    closedNotesRef.current = [{ note, index }, ...closedNotesRef.current].slice(0, CLOSED_NOTES_LIMIT);
    setUndoToastNote(note);
  }, []);

  const reopenClosedNote = useCallback(() => {
    const [latest, ...rest] = closedNotesRef.current;
    closedNotesRef.current = rest;
    if (latest) dispatch({ type: "note/restore", note: latest.note, index: latest.index });
    setUndoToastNote(null);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), UNDO_TOAST_MS);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!undoToastNote) return;
    const timeout = window.setTimeout(() => setUndoToastNote(null), UNDO_TOAST_MS);
    return () => window.clearTimeout(timeout);
  }, [undoToastNote]);

  const anyDialogOpen = settingsOpen || switcherOpen || pendingDelete !== null || pendingReset;

  // The editor remounts when the active note changes, so focus it after that render.
  const focusEditorSoon = () => window.requestAnimationFrame(() => editorRef.current?.focus());

  useEffect(() => {
    // A dialog owns the keyboard while open; don't create/switch notes behind it.
    if (anyDialogOpen) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        addNote();
      }
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setSwitcherOpen(true);
      }
      // Inside the editor CodeMirror handles this itself; from elsewhere, open its search.
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "f" && !event.defaultPrevented) {
        event.preventDefault();
        editorRef.current?.openSearch();
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        reopenClosedNote();
      }
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        const currentIndex = workspace.notes.findIndex((note) => note.id === workspace.activeNoteId);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + workspace.notes.length) % workspace.notes.length;
        const nextNote = workspace.notes[nextIndex];
        if (nextNote) dispatch({ type: "note/activate", id: nextNote.id });
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [addNote, anyDialogOpen, reopenClosedNote, workspace.activeNoteId, workspace.notes]);

  useEffect(() => {
    const activeTab = tabListRef.current?.querySelector<HTMLElement>("[aria-selected='true']");
    activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [workspace.activeNoteId]);

  // Track whether the tab strip is scrolled away from either edge, to fade
  // (rather than hard-clip) the tabs that run off the visible area.
  const updateTabOverflow = useCallback(() => {
    const el = tabListRef.current;
    if (!el) return;
    const vertical = workspace.settings.tabLayout === "vertical";
    const pos = vertical ? el.scrollTop : el.scrollLeft;
    const clientSize = vertical ? el.clientHeight : el.clientWidth;
    const scrollSize = vertical ? el.scrollHeight : el.scrollWidth;
    setTabOverflow({ start: pos > 1, end: pos < scrollSize - clientSize - 1 });
  }, [workspace.settings.tabLayout]);

  useEffect(() => {
    updateTabOverflow();
  }, [updateTabOverflow, workspace.notes.length, workspace.activeNoteId]);

  const tabStripMask = useMemo(() => {
    if (!tabOverflow.start && !tabOverflow.end) return undefined;
    const axis = workspace.settings.tabLayout === "vertical" ? "to bottom" : "to right";
    const fade = "24px";
    const stops = [
      tabOverflow.start ? "transparent 0" : "#000 0",
      ...(tabOverflow.start ? [`#000 ${fade}`] : []),
      ...(tabOverflow.end ? [`#000 calc(100% - ${fade})`] : []),
      tabOverflow.end ? "transparent 100%" : "#000 100%",
    ];
    return `linear-gradient(${axis}, ${stops.join(", ")})`;
  }, [tabOverflow, workspace.settings.tabLayout]);

  const wordCount = useMemo(() => countWords(activeNote?.markdown ?? ""), [activeNote?.markdown]);

  if (!activeNote) return null;

  const requestDelete = (note: Note) => {
    if (workspace.settings.confirmDelete) setPendingDelete(note);
    else deleteNote(note);
  };

  const exportAll = () => {
    const combined = workspace.notes
      .map((note) => `# ${note.title}\n\n${note.markdown.trim()}\n`)
      .join("\n---\n\n");
    downloadFile("TabbyNotes.md", combined);
  };

  const backUpAll = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`TabbyNotes-backup-${date}.json`, serializeBackup(workspace), "application/json");
  };

  // Accepts Markdown files (one note each) and TabbyNotes .json backups (every note inside).
  const importNotes = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    const imported: Note[] = [];
    const skipped: string[] = [];
    for (const file of files) {
      const text = await file.text();
      if (/\.json$/i.test(file.name)) {
        const backup = parseBackup(text);
        if (backup) imported.push(...notesToRestore(backup, [...workspaceRef.current.notes, ...imported]));
        else skipped.push(file.name);
      } else {
        imported.push(
          createNote({ title: file.name.replace(/\.(?:md|markdown|txt)$/i, "") || "Imported note", markdown: text }),
        );
      }
    }
    for (const note of imported) dispatch({ type: "note/add", note });
    setSettingsOpen(false);
    const added = `Imported ${imported.length} ${imported.length === 1 ? "note" : "notes"}`;
    setNotice(skipped.length > 0 ? `${added}. Not a TabbyNotes backup: ${skipped.join(", ")}` : added);
  };

  const activateTabAt = (index: number) => {
    const target = workspace.notes[index];
    if (!target) return;
    dispatch({ type: "note/activate", id: target.id });
    const tabButtons = tabListRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");
    tabButtons?.[index]?.focus();
  };

  return (
    <main className={`app-shell tabs-${workspace.settings.tabLayout}`}>
      <header className="app-header">
        <div className="logo-wrap">
          <img src="/kitty.png" alt="TabbyNotes" className="shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <p aria-live="polite" className={`save-status ${saveStatus === "error" ? "save-status-error" : ""}`}>
            {saveStatus === "saved" ? <Check size={11} /> : <span className="h-2 w-2 rounded-full bg-red-500" />}
            {saveStatus === "saved" ? "Saved" : "Save failed"}
          </p>
          <button className="icon-button" onClick={() => setSwitcherOpen(true)} aria-label="Go to note" title="Go to note (Ctrl/⌘ P)">
            <FileSearch size={16} />
          </button>
          {view === "popup" && canOpenSidePanel() && (
            <button className="icon-button" onClick={openInSidePanel} aria-label="Open in the side panel" title="Open in the side panel">
              <PanelRight size={16} />
            </button>
          )}
          {view === "popup" && (
            <button className="icon-button" onClick={openInWindow} aria-label="Open in a resizable window" title="Open in a resizable window">
              <Maximize2 size={16} />
            </button>
          )}
          <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="tab-strip-shell">
        <div
          ref={tabListRef}
          className="tab-strip"
          role="tablist"
          aria-label="Open notes"
          aria-orientation={workspace.settings.tabLayout}
          style={tabStripMask ? { maskImage: tabStripMask, WebkitMaskImage: tabStripMask } : undefined}
          onScroll={updateTabOverflow}
          onWheel={(event) => {
            // The scrollbar is hidden; let a vertical wheel scroll the horizontal strip.
            if (workspace.settings.tabLayout === "horizontal" && event.deltaY !== 0) {
              event.currentTarget.scrollLeft += event.deltaY;
            }
          }}
        >
          {workspace.notes.map((note, noteIndex) => {
            const isActive = note.id === activeNote.id;
            const isDragging = note.id === draggedNoteId;
            const dropEdge = dropTarget?.id === note.id ? dropTarget.edge : null;
            return (
              <div
                key={note.id}
                className={`note-tab ${isActive ? "note-tab-active" : ""} ${isDragging ? "note-tab-dragging" : ""} ${dropEdge ? `note-tab-drop note-tab-drop-${dropEdge}` : ""}`}
                draggable
                onMouseDown={(event) => {
                  // Suppress the middle-click autoscroll so it can close the tab instead.
                  if (event.button === 1) event.preventDefault();
                }}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault();
                    requestDelete(note);
                  }
                }}
                onDragStart={(event) => {
                  setDraggedNoteId(note.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggedNoteId(null);
                  setDropTarget(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (!draggedNoteId || draggedNoteId === note.id) {
                    setDropTarget(null);
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  const isVertical = workspace.settings.tabLayout === "vertical";
                  const midpoint = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
                  const pointer = isVertical ? event.clientY : event.clientX;
                  const edge = pointer < midpoint ? "before" : "after";
                  setDropTarget((current) =>
                    current?.id === note.id && current.edge === edge ? current : { id: note.id, edge },
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedNoteId && dropTarget) {
                    dispatch({
                      type: "note/reorder",
                      sourceId: draggedNoteId,
                      targetId: dropTarget.id,
                      edge: dropTarget.edge,
                    });
                  }
                  setDraggedNoteId(null);
                  setDropTarget(null);
                }}
              >
                <button
                  id={`note-tab-${note.id}`}
                  className="note-tab-label"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="note-editor"
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => dispatch({ type: "note/activate", id: note.id })}
                  onDoubleClick={() => {
                    // Rename in place: jump to the title field with its text selected.
                    window.requestAnimationFrame(() => {
                      const titleInput = document.getElementById("active-note-title");
                      if (!(titleInput instanceof HTMLInputElement)) return;
                      titleInput.focus();
                      titleInput.select();
                    });
                  }}
                  onKeyDown={(event) => {
                    const previousIndex = (noteIndex - 1 + workspace.notes.length) % workspace.notes.length;
                    const nextIndex = (noteIndex + 1) % workspace.notes.length;
                    const previousKey = workspace.settings.tabLayout === "vertical" ? "ArrowUp" : "ArrowLeft";
                    const nextKey = workspace.settings.tabLayout === "vertical" ? "ArrowDown" : "ArrowRight";

                    if (event.altKey && event.shiftKey && (event.key === previousKey || event.key === nextKey)) {
                      event.preventDefault();
                      const movingBack = event.key === previousKey;
                      const target = workspace.notes[movingBack ? previousIndex : nextIndex];
                      if (target) {
                        dispatch({
                          type: "note/reorder",
                          sourceId: note.id,
                          targetId: target.id,
                          edge: movingBack ? "before" : "after",
                        });
                      }
                      return;
                    }

                    if (event.key === previousKey) {
                      event.preventDefault();
                      activateTabAt(previousIndex);
                    } else if (event.key === nextKey) {
                      event.preventDefault();
                      activateTabAt(nextIndex);
                    } else if (event.key === "Home") {
                      event.preventDefault();
                      activateTabAt(0);
                    } else if (event.key === "End") {
                      event.preventDefault();
                      activateTabAt(workspace.notes.length - 1);
                    }
                  }}
                  title={`${note.title} (double-click to rename)`}
                >
                  <FileText className="tab-file-icon" size={13} />
                  <span>{note.title}</span>
                </button>
                <button className="tab-close" tabIndex={isActive ? 0 : -1} onClick={() => requestDelete(note)} aria-label={`Close ${note.title}`}>
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        <button className="tab-add" onClick={addNote} aria-label="Create a new note">
          <Plus size={15} />
        </button>
      </div>

      <section
        id="note-editor"
        className="editor-card"
        role="tabpanel"
        aria-labelledby={`note-tab-${activeNote.id}`}
      >
        <div className="editor-heading">
          <input
            id="active-note-title"
            className="title-input"
            value={activeNote.title}
            onChange={(event) =>
              dispatch({ type: "note/update", id: activeNote.id, changes: { title: event.target.value } })
            }
            onBlur={(event) => {
              if (!event.target.value.trim()) {
                dispatch({ type: "note/update", id: activeNote.id, changes: { title: DEFAULT_NOTE_TITLE } });
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                editorRef.current?.focus();
              }
            }}
            aria-label="Note title"
          />
        </div>

        <div className="formatting-bar" aria-label="Markdown formatting">
          {formattingActions.map(({ label, icon: Icon, run, ...action }) => (
            <button key={label} className="format-button" onClick={() => editorRef.current && run(editorRef.current)} title={"shortcut" in action ? `${label} (${action.shortcut})` : label} aria-label={label}>
              <Icon size={15} />
            </button>
          ))}
          <button className="format-button ml-auto" onClick={() => editorRef.current?.openSearch()} title="Find and replace (Ctrl/⌘ F)" aria-label="Find and replace">
            <Search size={15} />
          </button>
          <span className="hidden items-center gap-1.5 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase sm:flex">
            {workspace.settings.editorStyle === "live" ? <Sparkles size={12} /> : <Code2 size={12} />}
            {workspace.settings.editorStyle === "live" ? "Live preview" : "Markdown source"}
          </span>
        </div>

        <div className="editor-grid">
          <div className="editor-pane">
            <Suspense fallback={<div className="grid h-full place-items-center text-xs text-[var(--muted)]">Opening editor…</div>}>
              <MarkdownEditor
                key={activeNote.id}
                ref={editorRef}
                initialValue={activeNote.markdown}
                label="Markdown note editor"
                livePreviewEnabled={workspace.settings.editorStyle === "live"}
                onChange={(markdown) =>
                  dispatch({ type: "note/update", id: activeNote.id, changes: { markdown } })
                }
              />
            </Suspense>
          </div>
        </div>
      </section>

      <footer className="app-footer">
        <span title={`${activeNote.markdown.length.toLocaleString()} characters`}>
          {wordCount.toLocaleString()} {wordCount === 1 ? "word" : "words"}
        </span>
        <span title={new Date(activeNote.updatedAt).toLocaleString()}>
          Edited {formatEdited(activeNote.updatedAt, Math.max(now, activeNote.updatedAt))}
        </span>
        <span>{workspace.notes.length} {workspace.notes.length === 1 ? "tab" : "tabs"}</span>
        {storageUsed >= STORAGE_SHOW_AT && (
          <span
            className={storageUsed >= STORAGE_WARN_AT ? "storage-warning" : ""}
            title="Browsers limit how much an extension can keep. Back up and delete old notes to free space."
          >
            Storage {Math.min(100, Math.round(storageUsed * 100))}% full
          </span>
        )}
        <span className="footer-hint ml-auto">Ctrl+Tab to switch</span>
      </footer>

      <div className="toast-stack">
        {undoToastNote && (
          <div className="toast" role="status">
            <span className="toast-text">Deleted “{undoToastNote.title}”</span>
            <button className="toast-action" onClick={reopenClosedNote}>
              <RotateCcw size={13} />Undo
            </button>
            <button className="toast-dismiss" onClick={() => setUndoToastNote(null)} aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <span className="toast-text">{notice}</span>
            <button className="toast-dismiss" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X size={12} />
            </button>
          </div>
        )}
        {saveStatus === "error" && (
          <div className="toast toast-error" role="alert">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
            <span>Couldn’t save to this browser. Export your notes so you don’t lose them.</span>
            <button className="toast-action" onClick={exportAll}>
              <Download size={13} />Export all
            </button>
          </div>
        )}
      </div>

      <input ref={importRef} className="hidden" type="file" accept=".md,.markdown,.txt,.json,text/markdown,text/plain,application/json" multiple onChange={importNotes} />

      {settingsOpen && (
        <Dialog title="Workspace settings" onClose={() => setSettingsOpen(false)}>
          <div className="space-y-6 p-5">
            <SettingGroup title="Appearance" description="Choose how your writing space feels.">
              <div className="segmented-control">
                {(["system", "light", "dark"] as const).map((theme) => (
                  <button key={theme} className={workspace.settings.theme === theme ? "segment-active" : ""} onClick={() => dispatch({ type: "settings/update", changes: { theme } })}>
                    {theme === "light" ? <Sun size={14} /> : theme === "dark" ? <Moon size={14} /> : <Sparkles size={14} />}
                    {theme[0]?.toUpperCase()}{theme.slice(1)}
                  </button>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup title="Editor" description="Live preview formats Markdown while keeping it directly editable.">
              <div className="segmented-control">
                {(["live", "source"] as const).map((editorStyle) => (
                  <button key={editorStyle} className={workspace.settings.editorStyle === editorStyle ? "segment-active" : ""} onClick={() => dispatch({ type: "settings/update", changes: { editorStyle } })}>
                    {editorStyle === "live" ? <Sparkles size={14} /> : <Code2 size={14} />}
                    {editorStyle === "live" ? "Live preview" : "Source"}
                  </button>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup title="Tab layout" description="Place tabs above the editor or in a vertical rail.">
              <div className="segmented-control">
                {(["horizontal", "vertical"] as const).map((tabLayout) => (
                  <button key={tabLayout} className={workspace.settings.tabLayout === tabLayout ? "segment-active" : ""} onClick={() => dispatch({ type: "settings/update", changes: { tabLayout } })}>
                    {tabLayout[0]?.toUpperCase()}{tabLayout.slice(1)}
                  </button>
                ))}
              </div>
            </SettingGroup>

            <SettingGroup title="Files and backups" description="Import .md files or a backup, and export standard .md files. A backup restores every tab as it was. Nothing is uploaded.">
              <div className="grid grid-cols-2 gap-2">
                <button className="settings-action" onClick={() => importRef.current?.click()}><Import size={15} />Import</button>
                <button className="settings-action" onClick={() => downloadFile(`${safeFilename(activeNote.title)}.md`, activeNote.markdown)}><FileDown size={15} />Export tab</button>
                <button className="settings-action" onClick={exportAll}><Download size={15} />Export all (.md)</button>
                <button className="settings-action" onClick={backUpAll}><DatabaseBackup size={15} />Back up (.json)</button>
              </div>
            </SettingGroup>

            <SettingGroup title="Keyboard shortcuts" description="Change the shortcut that opens TabbyNotes in your browser's extension shortcut settings.">
              <dl className="shortcut-list">
                {keyboardShortcuts.map(([action, keys]) => (
                  <div key={action}>
                    <dt>{action}</dt>
                    <dd><kbd>{keys}</kbd></dd>
                  </div>
                ))}
              </dl>
            </SettingGroup>

            <SettingGroup title="Safety" description="Ask before closing a tab. Closed tabs can be reopened with Ctrl/⌘ Shift T.">
              <label className="toggle-row">
                <span>Confirm tab deletion</span>
                <input type="checkbox" checked={workspace.settings.confirmDelete} onChange={(event) => dispatch({ type: "settings/update", changes: { confirmDelete: event.target.checked } })} />
              </label>
              <button className="danger-button mt-3 w-full" onClick={() => { setSettingsOpen(false); setPendingReset(true); }}><Trash2 size={15} />Clear all notes</button>
            </SettingGroup>

            <p className="rounded-xl bg-[var(--surface-muted)] p-3 text-[11px] leading-relaxed text-[var(--muted)]">
              TabbyNotes has no account, cloud sync, analytics, or access to the pages you visit. Notes remain in this browser profile until you clear extension data or uninstall it.
            </p>
          </div>
        </Dialog>
      )}

      {switcherOpen && (
        <QuickSwitcher
          notes={workspace.notes}
          activeNoteId={activeNote.id}
          onSelect={(id) => {
            dispatch({ type: "note/activate", id });
            setSwitcherOpen(false);
            focusEditorSoon();
          }}
          onClose={() => {
            setSwitcherOpen(false);
            focusEditorSoon();
          }}
        />
      )}

      {pendingDelete && (
        <Dialog title="Close this tab?" onClose={() => setPendingDelete(null)}>
          <div className="p-5">
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              “<strong className="text-[var(--ink)]">{pendingDelete.title}</strong>” will be removed from this browser.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="ghost-button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="danger-button" onClick={() => { deleteNote(pendingDelete); setPendingDelete(null); }}><Trash2 size={15} />Delete tab</button>
            </div>
          </div>
        </Dialog>
      )}

      {pendingReset && (
        <Dialog title="Clear every note?" onClose={() => setPendingReset(false)}>
          <div className="p-5">
            <p className="text-sm leading-relaxed text-[var(--muted)]">This permanently replaces all tabs with one empty note. Export your notes first if you may need them later.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="ghost-button" onClick={() => setPendingReset(false)}>Cancel</button>
              <button className="danger-button" onClick={() => { const note = createNote(); dispatch({ type: "notes/replace", notes: [note], activeNoteId: note.id }); setPendingReset(false); setSettingsOpen(false); }}><Trash2 size={15} />Clear everything</button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  );
}

function SettingGroup({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
      <p className="mb-3 mt-0.5 text-[11px] text-[var(--muted)]">{description}</p>
      {children}
    </section>
  );
}
