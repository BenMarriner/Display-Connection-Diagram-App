import { useEffect, useRef, useState } from "react";

export default function InlineName({
  value,
  label,
  onCommit,
  className = "",
}: {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      className={`inline-name nodrag nopan ${className}`}
      aria-label={label}
      title="Rename · Enter to save · Escape to cancel"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        e.currentTarget.select();
      }}
      onBlur={() => {
        if (cancelled.current) {
          cancelled.current = false;
          setDraft(value);
          return;
        }
        const name = draft.trim() || value;
        setDraft(name);
        if (name !== value) onCommit(name);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          cancelled.current = true;
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
