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

- Obsidian-style live preview keeps Markdown formatted and editable in one surface.
- Markdown syntax appears on the active line; a Source setting shows the raw document.
- Tabs can sit horizontally above the editor or in a vertical rail.
- Keyboard tab navigation, drag reordering, Markdown import/export, and light/dark themes.

## Toolchain

- Bun 1.4 canary (Rust runtime)
- TypeScript 7 (native Go compiler)
- WXT and React 19
- Tailwind CSS 4
- CodeMirror 6
- Vitest

Install the current Bun 1.4 canary, then install dependencies:

```sh
bun upgrade --canary
bun install
```

The project deliberately avoids Bun-canary-only APIs so it remains straightforward to move to the stable 1.4 channel.

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

## Privacy and persistence

The extension requests no permissions. Notes are persisted through the extension page's standard `localStorage`; this data is local to the browser profile and is removed when the extension is uninstalled. Existing v4 data under the `saveState` key is migrated on first launch and retained as a recovery backup.

## Credits

The TabbyNotes icon is a cat icon from Flaticon, used under its [Free License](https://www.flaticon.com/legal) (attribution required):

<a href="https://www.flaticon.com/free-icons/cat" title="cat icons">Cat icons created by Magnific - Flaticon</a>
