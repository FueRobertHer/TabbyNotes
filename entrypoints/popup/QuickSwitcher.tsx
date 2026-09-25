import { FileText, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { type Note, searchNotes } from "../../src/domain/workspace";

interface QuickSwitcherProps {
  notes: Note[];
  activeNoteId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Ctrl/⌘ P palette: type to filter notes by title and text, Enter to open one. */
export default function QuickSwitcher({ notes, activeNoteId, onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const results = useMemo(() => searchNotes(notes, query), [notes, query]);

  useEffect(() => setHighlighted(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const choose = (index: number) => {
    const result = results[index];
    if (result) onSelect(result.note.id);
  };

  return (
    <div className="dialog-backdrop quick-switcher-backdrop" onMouseDown={onClose}>
      <section
        aria-label="Go to note"
        aria-modal="true"
        className="dialog-panel quick-switcher"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <label className="quick-switcher-search">
          <Search size={15} aria-hidden="true" />
          <input
            autoFocus
            aria-activedescendant={results[highlighted] ? `${listId}-${highlighted}` : undefined}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded="true"
            aria-label="Search notes"
            placeholder="Search notes by title or text"
            role="combobox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (results.length === 0) return;
                const step = event.key === "ArrowDown" ? 1 : -1;
                setHighlighted((current) => (current + step + results.length) % results.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                choose(highlighted);
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              } else if (event.key === "Tab") {
                event.preventDefault();
              }
            }}
          />
        </label>
        <ul ref={listRef} id={listId} className="quick-switcher-results" role="listbox" aria-label="Notes">
          {results.map(({ note, snippet }, index) => (
            <li
              key={note.id}
              id={`${listId}-${index}`}
              data-index={index}
              aria-selected={index === highlighted}
              className={`quick-switcher-result ${index === highlighted ? "quick-switcher-result-active" : ""}`}
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setHighlighted(index)}
              onClick={() => choose(index)}
            >
              <FileText size={14} className="quick-switcher-icon" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="quick-switcher-title">{note.title}</span>
                {snippet && <span className="quick-switcher-snippet">{snippet}</span>}
              </span>
              {note.id === activeNoteId && <span className="quick-switcher-badge">Open</span>}
            </li>
          ))}
          {results.length === 0 && <li className="quick-switcher-empty">No notes match “{query.trim()}”</li>}
        </ul>
      </section>
    </div>
  );
}
