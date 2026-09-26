# TabbyNotes

A local-only, tabbed Markdown notebook for Chrome and Firefox.

TabbyNotes has no account, cloud sync, analytics, content scripts, or access to the pages you visit. Notes are saved as Markdown strings in the extension's local browser profile and can be imported or exported as `.md` files.

## Install

- **Firefox:** [Get TabbyNotes on Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tabbynotes/)

## Screenshots

| Live preview (dark) | Live preview (light) |
| --- | --- |
| ![Live Markdown preview in the dark theme](docs/screenshots/live-preview-dark.png) | ![Live Markdown preview in the light theme](docs/screenshots/live-preview-light.png) |

| Vertical tab rail | Markdown source view |
| --- | --- |
| ![Notes with tabs in a vertical rail](docs/screenshots/vertical-tabs-dark.png) | ![Raw Markdown source view](docs/screenshots/source-mode-light.png) |

## Highlights

- Obsidian-style live preview keeps Markdown formatted and editable in one surface, including tables, images, video, audio and syntax-colored code blocks. Links to image, video and audio files get an icon that shows the file below the link.
- Markdown syntax appears on the active line; a Source setting shows the raw document.
- Tabs can sit horizontally above the editor or in a vertical rail. Double-click a tab to rename it.
- Open TabbyNotes in the browser side panel or a resizable window when the toolbar popup feels cramped. While the window is open, the toolbar button brings it forward instead of opening the popup. Open copies stay in sync; if two copies edit the same note at once, the later edit wins.
- Ctrl/⌘ P jumps to any note, Ctrl/⌘ F finds and replaces, and Alt+Shift+N opens TabbyNotes. Settings lists every shortcut.
- Closed tabs can be restored with Undo or Ctrl/⌘ Shift T.
- Markdown import/export: one `.md` per note, or every note in a `.zip` that imports back. JSON backups restore every tab exactly.
- Light and dark themes.

## Permissions

TabbyNotes asks for no permissions in Firefox. In Chrome it requests only `sidePanel`, which shows no install warning. Images, video and audio from the web stay a link until you click their icon (a setting can load embedded ones automatically), and are fetched without a referrer. The same icon hides them again.

## Toolchain

- Bun 1.4.2 (Rust runtime)
- TypeScript 7 (native Go compiler)
- WXT and React 19
- Tailwind CSS 4
- CodeMirror 6
- Vitest

Install Bun 1.4.2 or newer from the stable channel, then install dependencies:

```sh
bun upgrade --stable
bun install
```

## Development

```sh
bun run dev
bun run dev:firefox
```

## Verification

```sh
bun run typecheck
bun run test
bun run build
bun run build:firefox
```

`bun run typecheck` invokes the Go-based TypeScript 7 `tsc` compiler. WXT builds Chrome and Firefox Manifest V3 packages from the same source.

## Building for release

Requirements: Bun 1.4.2 or newer and Node.js 24 or newer. These steps work from a clean checkout or from the extracted sources zip.

```sh
bun install --frozen-lockfile
bun run zip:firefox
```

This builds in production mode and writes to `.output/`:

- `tabby-notes-<version>-firefox.zip`: the package to upload to Firefox Add-ons.
- `tabby-notes-<version>-sources.zip`: the source code Firefox Add-ons asks for. Building it with the two commands above reproduces the same extension.
- `firefox-mv3/`: the unpacked extension, matching the contents of the Firefox zip.

For Chrome, run `bun run zip` to get `tabby-notes-<version>-chrome.zip`.

To release a new version, change `version` in `package.json` (the manifest reads it from there), then run the commands above.

## Privacy and persistence

The extension requests no permissions. Notes are persisted through the extension page's standard `localStorage`; this data is local to the browser profile and is removed when the extension is uninstalled. Existing v4 data under the `saveState` key is migrated on first launch and retained as a recovery backup.

## Credits

The TabbyNotes icon is a cat icon from Flaticon, used under its [Free License](https://www.flaticon.com/legal) (attribution required):

<a href="https://www.flaticon.com/free-icons/cat" title="cat icons">Cat icons created by Magnific - Flaticon</a>
