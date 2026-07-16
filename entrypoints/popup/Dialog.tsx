import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  labelledBy?: string;
}

export default function Dialog({ title, children, onClose, labelledBy }: DialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLElement>(null);
  const generatedTitleId = useId();
  const titleId = labelledBy ?? generatedTitleId;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section
        ref={panelRef}
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog-panel"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-bold text-[var(--ink)]">
            {title}
          </h2>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={17} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
