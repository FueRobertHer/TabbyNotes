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
}

export interface WorkspaceSettings {
  theme: Theme;
  editorStyle: EditorStyle;
  tabLayout: TabLayout;
  confirmDelete: boolean;
}

export interface Workspace {
  version: typeof WORKSPACE_VERSION;
  notes: Note[];
  activeNoteId: string;
  settings: WorkspaceSettings;
}

export type WorkspaceAction =
  | { type: "note/add"; note?: Note }
  | { type: "note/update"; id: string; changes: Partial<Pick<Note, "title" | "markdown">> }
  | { type: "note/delete"; id: string }
  | { type: "note/activate"; id: string }
  | { type: "note/reorder"; sourceId: string; targetId: string; edge?: "before" | "after" }
  | { type: "notes/replace"; notes: Note[]; activeNoteId?: string }
  | { type: "settings/update"; changes: Partial<WorkspaceSettings> }
  | { type: "workspace/replace"; workspace: Workspace };

export function createNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Untitled note",
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
    },
  };
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
          note.id === action.id
            ? { ...note, ...action.changes, updatedAt: Date.now() }
            : note,
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
