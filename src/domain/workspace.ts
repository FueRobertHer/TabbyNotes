export const WORKSPACE_VERSION = 2 as const;

export type Theme = "system" | "light" | "dark";
export type EditorStyle = "live" | "source";
export type TabLayout = "horizontal" | "vertical";

export interface Note {
  id: string;
  title: string;
  markdown: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Whether the title follows the note's leading heading. Unset on notes saved before
   * this existed; see titleIsAutomatic for how those are read.
   */
  autoTitle?: boolean;
}

export interface WorkspaceSettings {
  theme: Theme;
  editorStyle: EditorStyle;
  tabLayout: TabLayout;
  confirmDelete: boolean;
  /** Load http(s) images in live preview without asking first. */
  loadRemoteImages: boolean;
}

export interface Workspace {
  version: typeof WORKSPACE_VERSION;
  notes: Note[];
  activeNoteId: string;
  settings: WorkspaceSettings;
}

export type WorkspaceAction =
  | { type: "note/add"; note?: Note }
  | { type: "note/update"; id: string; changes: NoteChanges }
  | { type: "note/delete"; id: string }
  | { type: "note/restore"; note: Note; index: number }
  | { type: "note/activate"; id: string }
  | { type: "note/reorder"; sourceId: string; targetId: string; edge?: "before" | "after" }
  | { type: "notes/replace"; notes: Note[]; activeNoteId?: string }
  | { type: "settings/update"; changes: Partial<WorkspaceSettings> }
  | { type: "workspace/replace"; workspace: Workspace };

export type NoteChanges = Partial<Pick<Note, "title" | "markdown" | "autoTitle">>;

export const DEFAULT_NOTE_TITLE = "Untitled note";

export function createNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_NOTE_TITLE,
    markdown: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createWorkspace(): Workspace {
  const note = createNote({
    title: "Welcome to TabbyNotes",
    markdown:
      "# Welcome to TabbyNotes\n\nThis is your new **Markdown** notebook.\n\n- Create a tab with the **+** button\n- Markdown formats as you write\n- Your notes stay only in this browser\n",
  });

  return {
    version: WORKSPACE_VERSION,
    notes: [note],
    activeNoteId: note.id,
    settings: {
      theme: "system",
      editorStyle: "live",
      tabLayout: "horizontal",
      confirmDelete: true,
      loadRemoteImages: false,
    },
  };
}

/** The text of a heading on the note's first non-blank line, without Markdown markers. */
export function leadingHeading(markdown: string): string | null {
  const firstLine = markdown.split("\n").find((line) => line.trim() !== "") ?? "";
  const match = /^#{1,6}\s+(.+?)(?:\s+#+)?\s*$/.exec(firstLine);
  const text = match?.[1]?.replace(/[*_`~]/g, "").trim().slice(0, 80);
  return text ? text : null;
}

/**
 * Whether a note's title follows its leading heading. Notes saved before the flag existed
 * count as automatic when the title is the default or matches the heading.
 */
export function titleIsAutomatic(note: Note): boolean {
  return note.autoTitle ?? (note.title === DEFAULT_NOTE_TITLE || note.title === leadingHeading(note.markdown));
}

function updateNote(note: Note, changes: NoteChanges): Note {
  const next: Note = { ...note, ...changes, updatedAt: Date.now() };
  if (changes.title !== undefined) {
    // Typing a title takes it over, unless the change says otherwise (e.g. resetting to default).
    next.autoTitle = changes.autoTitle ?? false;
  } else if (changes.markdown !== undefined && titleIsAutomatic(note)) {
    next.autoTitle = true;
    next.title = leadingHeading(changes.markdown) ?? DEFAULT_NOTE_TITLE;
  }
  return next;
}

/**
 * Combines a workspace another window just saved with this window's state, for when this
 * window has edits it hasn't saved yet (`lastSavedAt` is when it last did). Notes changed
 * here since then keep this window's version unless the other copy is newer; notes created
 * here since then are kept. Settings come from the other window, and this window keeps its
 * own active note.
 */
export function mergeWorkspaces(local: Workspace, incoming: Workspace, lastSavedAt: number): Workspace {
  const localById = new Map(local.notes.map((note) => [note.id, note]));
  const incomingIds = new Set(incoming.notes.map((note) => note.id));
  const notes = incoming.notes.map((note) => {
    const mine = localById.get(note.id);
    return mine && mine.updatedAt > lastSavedAt && mine.updatedAt > note.updatedAt ? mine : note;
  });
  for (const note of local.notes) {
    if (!incomingIds.has(note.id) && note.updatedAt > lastSavedAt) notes.push(note);
  }
  const activeNoteId = notes.some((note) => note.id === local.activeNoteId)
    ? local.activeNoteId
    : incoming.activeNoteId;
  return { ...incoming, notes, activeNoteId };
}

export function workspaceReducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case "note/add": {
      const note = action.note ?? createNote();
      return { ...state, notes: [...state.notes, note], activeNoteId: note.id };
    }

    case "note/update":
      return {
        ...state,
        notes: state.notes.map((note) =>
          note.id === action.id ? updateNote(note, action.changes) : note,
        ),
      };

    case "note/delete": {
      if (state.notes.length === 1) {
        const replacement = createNote();
        return { ...state, notes: [replacement], activeNoteId: replacement.id };
      }

      const deletedIndex = state.notes.findIndex((note) => note.id === action.id);
      if (deletedIndex < 0) return state;

      const notes = state.notes.filter((note) => note.id !== action.id);
      const activeNoteId =
        state.activeNoteId === action.id
          ? (notes[Math.min(deletedIndex, notes.length - 1)]?.id ?? notes[0]?.id ?? "")
          : state.activeNoteId;

      return { ...state, notes, activeNoteId };
    }

    case "note/restore": {
      if (state.notes.some((note) => note.id === action.note.id)) return state;
      // Deleting the last note leaves an empty placeholder; restoring replaces it.
      const [only] = state.notes;
      const onlyPlaceholder =
        state.notes.length === 1 && only?.markdown === "" && only.title === DEFAULT_NOTE_TITLE;
      const notes = onlyPlaceholder ? [] : [...state.notes];
      notes.splice(Math.max(0, Math.min(action.index, notes.length)), 0, action.note);
      return { ...state, notes, activeNoteId: action.note.id };
    }

    case "note/activate":
      return state.notes.some((note) => note.id === action.id)
        ? { ...state, activeNoteId: action.id }
        : state;

    case "note/reorder": {
      if (action.sourceId === action.targetId) return state;
      const sourceIndex = state.notes.findIndex((note) => note.id === action.sourceId);
      const targetIndex = state.notes.findIndex((note) => note.id === action.targetId);
      if (sourceIndex < 0 || targetIndex < 0) return state;

      const notes = [...state.notes];
      const [source] = notes.splice(sourceIndex, 1);
      if (!source) return state;
      // Recompute the target's index after removal, then drop before/after it.
      const nextTargetIndex = notes.findIndex((note) => note.id === action.targetId);
      const insertAt = nextTargetIndex + (action.edge === "after" ? 1 : 0);
      notes.splice(insertAt, 0, source);
      return { ...state, notes };
    }

    case "notes/replace": {
      const notes = action.notes.length > 0 ? action.notes : [createNote()];
      const requestedActiveId = action.activeNoteId;
      const activeNoteId =
        requestedActiveId && notes.some((note) => note.id === requestedActiveId)
          ? requestedActiveId
          : (notes[0]?.id ?? "");
      return { ...state, notes, activeNoteId };
    }

    case "settings/update":
      return { ...state, settings: { ...state.settings, ...action.changes } };

    case "workspace/replace":
      return action.workspace;
  }
}

export interface NoteSearchResult {
  note: Note;
  /** Text around the first body match, when the query matched the body rather than the title. */
  snippet?: string;
}

const SNIPPET_RADIUS = 40;

/**
 * Finds notes whose title or body contains every word of the query (case-insensitive).
 * Title matches rank first. An empty query lists every note, most recently edited first.
 */
export function searchNotes(notes: Note[], query: string): NoteSearchResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...notes].sort((a, b) => b.updatedAt - a.updatedAt).map((note) => ({ note }));
  }

  const ranked: { result: NoteSearchResult; rank: number }[] = [];
  for (const note of notes) {
    const title = note.title.toLowerCase();
    const body = note.markdown.toLowerCase();
    if (!words.every((word) => title.includes(word) || body.includes(word))) continue;

    const titleHits = words.filter((word) => title.includes(word)).length;
    const bodyWord = words.find((word) => !title.includes(word)) ?? (titleHits === 0 ? words[0] : undefined);
    let snippet: string | undefined;
    if (bodyWord) {
      const at = body.indexOf(bodyWord);
      const start = Math.max(0, at - SNIPPET_RADIUS);
      const end = Math.min(note.markdown.length, at + bodyWord.length + SNIPPET_RADIUS);
      snippet = `${start > 0 ? "…" : ""}${note.markdown.slice(start, end).replace(/\s+/g, " ").trim()}${end < note.markdown.length ? "…" : ""}`;
    }
    const rank = (title.startsWith(words[0] ?? "") ? 2 : 0) + (titleHits === words.length ? 2 : titleHits > 0 ? 1 : 0);
    ranked.push({ result: snippet ? { note, snippet } : { note }, rank });
  }
  // Array.prototype.sort is stable, so equal ranks keep tab order.
  return ranked.sort((a, b) => b.rank - a.rank).map(({ result }) => result);
}
