import { createNote, DEFAULT_NOTE_TITLE, type Note } from "../domain/workspace";
import type { ZipEntry } from "./zip";

const markdownExtension = /\.(?:md|markdown|txt)$/i;
const reservedWindowsNames = /^(?:con|prn|aux|nul|com\d|lpt\d)$/i;

/** A file name (without extension) for a note's title that Windows, macOS and Linux all accept. */
export function safeFilename(title: string): string {
  let safe = title
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .replace(/[. ]+$/, "");
  if (reservedWindowsNames.test(safe)) safe = `${safe} note`;
  return safe || DEFAULT_NOTE_TITLE;
}

/** One Markdown file per note, named after its title and made unique ("Todo.md", "Todo (2).md"). */
export function markdownFiles(notes: Note[]): { name: string; note: Note }[] {
  const used = new Set<string>();
  return notes.map((note) => {
    const base = safeFilename(note.title);
    let name = `${base}.md`;
    // Windows and macOS treat names that differ only in case as the same file.
    for (let copy = 2; used.has(name.toLowerCase()); copy += 1) name = `${base} (${copy}).md`;
    used.add(name.toLowerCase());
    return { name, note };
  });
}

export function isMarkdownFile(name: string): boolean {
  return markdownExtension.test(name);
}

/** A note from an imported Markdown file, titled after the file and dated from it when known. */
export function noteFromMarkdownFile(path: string, markdown: string, modified?: Date): Note {
  const title = (path.split("/").pop() ?? path).replace(markdownExtension, "") || "Imported note";
  const time = modified?.getTime();
  return createNote({ title, markdown, ...(time && Number.isFinite(time) ? { createdAt: time, updatedAt: time } : {}) });
}

/** The Markdown files in a zip, leaving out hidden files and the extras macOS adds. */
export function markdownZipEntries(entries: ZipEntry[]): ZipEntry[] {
  return entries.filter(
    (entry) =>
      isMarkdownFile(entry.name) && !entry.name.split("/").some((part) => part.startsWith(".") || part === "__MACOSX"),
  );
}
