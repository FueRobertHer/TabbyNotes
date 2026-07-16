import {
  createNote,
  createWorkspace,
  type EditorStyle,
  type Note,
  type TabLayout,
  type Theme,
  type Workspace,
  WORKSPACE_VERSION,
} from "../domain/workspace";

export const WORKSPACE_KEY = "tabby-notes:workspace:v5";
export const LEGACY_KEY = "saveState";
export const LEGACY_BACKUP_KEY = "tabby-notes:legacy-backup:v4";
export const INVALID_WORKSPACE_BACKUP_KEY = "tabby-notes:invalid-workspace-backup:v5";

interface LegacyTab {
  title?: unknown;
  text?: unknown;
}

interface LegacyWorkspace {
  tabs?: unknown;
  activeTab?: unknown;
  confirmDelete?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

function isEditorStyle(value: unknown): value is EditorStyle {
  return value === "live" || value === "source";
}

function isTabLayout(value: unknown): value is TabLayout {
  return value === "horizontal" || value === "vertical";
}

function parseNote(value: unknown): Note | null {
  if (!isRecord(value)) return null;
  const { id, title, markdown, createdAt, updatedAt } = value;
  if (
    typeof id !== "string" ||
    typeof title !== "string" ||
    typeof markdown !== "string" ||
    typeof createdAt !== "number" ||
    typeof updatedAt !== "number"
  ) {
    return null;
  }
  return { id, title, markdown, createdAt, updatedAt };
}

function parseWorkspace(value: unknown): Workspace | null {
  if (
    !isRecord(value) ||
    (value.version !== 1 && value.version !== WORKSPACE_VERSION) ||
    !Array.isArray(value.notes) ||
    !isRecord(value.settings)
  ) {
    return null;
  }

  const notes = value.notes.map(parseNote);
  if (notes.some((note) => note === null)) return null;
  const validNotes = notes.filter((note): note is Note => note !== null);
  if (validNotes.length === 0) return null;

  const activeNoteId =
    typeof value.activeNoteId === "string" &&
    validNotes.some((note) => note.id === value.activeNoteId)
      ? value.activeNoteId
      : (validNotes[0]?.id ?? "");

  return {
    version: WORKSPACE_VERSION,
    notes: validNotes,
    activeNoteId,
    settings: {
      theme: isTheme(value.settings.theme) ? value.settings.theme : "system",
      editorStyle: isEditorStyle(value.settings.editorStyle)
        ? value.settings.editorStyle
        : "live",
      tabLayout: isTabLayout(value.settings.tabLayout)
        ? value.settings.tabLayout
        : "horizontal",
      confirmDelete:
        typeof value.settings.confirmDelete === "boolean"
          ? value.settings.confirmDelete
          : true,
    },
  };
}

function migrateLegacy(raw: string): Workspace | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;

  const legacy = value as LegacyWorkspace;
  if (!Array.isArray(legacy.tabs) || legacy.tabs.length === 0) return null;

  const notes = legacy.tabs.map((tabValue, index) => {
    const tab = isRecord(tabValue) ? (tabValue as LegacyTab) : {};
    return createNote({
      title:
        typeof tab.title === "string" && tab.title.trim()
          ? tab.title.trim()
          : `Note ${index + 1}`,
      markdown: typeof tab.text === "string" ? tab.text : "",
    });
  });

  const requestedIndex =
    typeof legacy.activeTab === "number" && Number.isInteger(legacy.activeTab)
      ? legacy.activeTab
      : 0;
  const activeIndex = Math.max(0, Math.min(requestedIndex, notes.length - 1));

  return {
    version: WORKSPACE_VERSION,
    notes,
    activeNoteId: notes[activeIndex]?.id ?? notes[0]?.id ?? "",
    settings: {
      theme: "system",
      editorStyle: "live",
      tabLayout: "horizontal",
      confirmDelete:
        typeof legacy.confirmDelete === "boolean" ? legacy.confirmDelete : true,
    },
  };
}

export function loadWorkspace(storage: Storage = window.localStorage): Workspace {
  const current = storage.getItem(WORKSPACE_KEY);
  if (current) {
    try {
      const parsed = parseWorkspace(JSON.parse(current));
      if (parsed) return parsed;
    } catch {
      // Fall through to legacy migration or a clean workspace.
    }
    try {
      storage.setItem(INVALID_WORKSPACE_BACKUP_KEY, current);
    } catch {
      // A full or disabled storage area should not prevent the popup from opening.
    }
  }

  const legacy = storage.getItem(LEGACY_KEY);
  if (legacy) {
    const migrated = migrateLegacy(legacy);
    if (migrated) {
      storage.setItem(LEGACY_BACKUP_KEY, legacy);
      storage.setItem(WORKSPACE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }

  return createWorkspace();
}

export function saveWorkspace(
  workspace: Workspace,
  storage: Storage = window.localStorage,
): void {
  storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
}
