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

// Storage intentionally uses window.localStorage rather than chrome.storage.local.
// Only the extension's own pages (popup, standalone window, side panel) read or write the
// workspace, and they share this origin's localStorage. The synchronous
// localStorage API keeps load/save simple (no async loading state) and, crucially, needs
// no "storage" permission, keeping the permission list minimal (none in Firefox; only
// the warning-free "sidePanel" in Chrome).
// The tradeoffs (smaller quota, main-thread writes) are mitigated by debouncing saves in
// the popup. Revisit chrome.storage only if a background/service-worker surface ever needs
// the data or the quota becomes limiting.
// Browsers cap localStorage at about 5 million characters per extension (Chrome counts
// 10 MB of UTF-16, Firefox 5 MiB of characters). Use the lower figure so warnings come early.
export const STORAGE_QUOTA_CHARS = 5_000_000;

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

export function serializeBackup(workspace: Workspace): string {
  return `${JSON.stringify(workspace, null, 2)}\n`;
}

/** Reads the notes out of a backup made by serializeBackup, or null if the text isn't one. */
export function parseBackup(text: string): Note[] | null {
  try {
    return parseWorkspace(JSON.parse(text))?.notes ?? null;
  } catch {
    return null;
  }
}

/**
 * Prepares backed-up notes for adding to an existing workspace. Notes that are already
 * present unchanged are skipped, so restoring the same backup twice doesn't duplicate
 * them; a note whose ID exists with different content is kept as a copy with a new ID.
 */
export function notesToRestore(backup: Note[], existing: Note[]): Note[] {
  const existingById = new Map(existing.map((note) => [note.id, note]));
  return backup.flatMap((note) => {
    const current = existingById.get(note.id);
    if (!current) return [note];
    if (current.title === note.title && current.markdown === note.markdown) return [];
    return [{ ...note, id: crypto.randomUUID() }];
  });
}

/** Fraction (0 to 1+) of the estimated localStorage quota in use across every key. */
export function storageUsage(storage: Storage = window.localStorage): number {
  let used = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key === null) continue;
    used += key.length + (storage.getItem(key)?.length ?? 0);
  }
  return used / STORAGE_QUOTA_CHARS;
}
