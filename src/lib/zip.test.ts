import { describe, expect, it } from "vitest";

import { createZip, readZip } from "./zip";

// Made by Windows PowerShell's Compress-Archive: one deflated file, "notes\Todo.md".
const windowsZip = Uint8Array.from(
  atob(
    "UEsDBBQAAAAIADuNOV1tfJkNFgAAAOQAAAANAAAAbm90ZXNcVG9kby5tZFNWCMlPyefi0lVIKq1UyM3MyR5+TABQSwECFAAUAAAACAA7jTldbXyZDRYAAADkAAAADQAAAAAAAAAAAAAAAAAAAAAAbm90ZXNcVG9kby5tZFBLBQYAAAAAAQABADsAAABBAAAAAAA=",
  ),
  (character) => character.charCodeAt(0),
);

describe("zip", () => {
  it("reads back what it writes, including names beyond ASCII and modified times", async () => {
    const encoder = new TextEncoder();
    const modified = new Date(2026, 8, 25, 14, 30, 42);
    const zip = createZip([
      { name: "Café notes.md", data: encoder.encode("# Café\n\nCroissants 🥐"), modified },
      { name: "Empty.md", data: new Uint8Array(), modified },
    ]);

    const entries = await readZip(zip);
    const decoder = new TextDecoder();
    expect(entries.map((entry) => [entry.name, decoder.decode(entry.data)])).toEqual([
      ["Café notes.md", "# Café\n\nCroissants 🥐"],
      ["Empty.md", ""],
    ]);
    // Zip keeps times to the even second.
    expect(entries[0]?.modified).toEqual(new Date(2026, 8, 25, 14, 30, 42));
  });

  it("reads a compressed zip made by Windows, with its folder separators", async () => {
    const [entry, ...rest] = await readZip(windowsZip);
    expect(rest).toEqual([]);
    expect(entry?.name).toBe("notes/Todo.md");
    expect(new TextDecoder().decode(entry?.data)).toBe(`# Todo\n\n${"- buy milk\n".repeat(20)}`);
  });

  it("rejects files that aren't zips", async () => {
    await expect(readZip(new TextEncoder().encode("# Just Markdown"))).rejects.toThrow("Not a zip file");
  });
});
