// Shortcuts are written like "Mod+Shift+T", where Mod is ⌘ on a Mac and Ctrl elsewhere.
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const keyLabels: Record<string, string> = isMac ? { Mod: "⌘", Alt: "⌥" } : { Mod: "Ctrl" };

function keyLabel(key: string) {
  return keyLabels[key] ?? key;
}

/** Plain text for tooltips, e.g. "Ctrl+Shift+T" or "⌘+Shift+T". */
export function shortcutText(combo: string) {
  return combo.split("+").map(keyLabel).join("+");
}

/** Renders one or more shortcuts as keycaps, separated by a slash. */
export function Keys({ combos }: { combos: readonly string[] }) {
  return (
    <span className="keys">
      {combos.map((combo, index) => (
        <span key={combo} className="keys-combo">
          {index > 0 && <span className="keys-or">/</span>}
          {combo.split("+").map((key) => (
            <kbd key={key}>{keyLabel(key)}</kbd>
          ))}
        </span>
      ))}
    </span>
  );
}
