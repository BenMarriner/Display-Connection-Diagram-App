import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Cable, Plus, Search, X, ArrowRight } from "lucide-react";
import type { Project } from "./model";
import {
  compatibleChoices,
  type ConnectionChoice,
  type ConnectionOrigin,
  type LibraryItem,
} from "./connections";
import { DeviceIcon } from "./components";
import { matchesLibrarySearch } from "./librarySearch";

export type ConnectionMenuState = {
  origin: ConnectionOrigin;
  screen: { x: number; y: number };
  position: { x: number; y: number };
};
export default function ConnectionMenu({
  menu,
  project,
  library,
  close,
  choose,
}: {
  menu: ConnectionMenuState;
  project: Project;
  library: LibraryItem[];
  close: () => void;
  choose: (choice: ConnectionChoice) => void;
}) {
  const [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState(menu.screen);
  const device = project.devices.find((d) => d.id === menu.origin.deviceId);
  const port = device?.ports.find((p) => p.id === menu.origin.portId);
  const all = useMemo(
    () => compatibleChoices(project, menu.origin, library),
    [project, menu.origin, library],
  );
  const choices = all
    .filter((c) => {
      const text = `${c.label} ${c.port.name} ${c.port.connector} ${c.port.direction} ${c.keywords ?? ""}`;
      return matchesLibrarySearch(text, query);
    })
    .slice(0, 100);
  useEffect(() => setActive(0), [query]);
  useLayoutEffect(() => {
    const position = () => {
      const box = ref.current?.getBoundingClientRect();
      if (box)
        setPoint({
          x: Math.max(12, Math.min(menu.screen.x, innerWidth - box.width - 12)),
          y: Math.max(
            12,
            Math.min(menu.screen.y, innerHeight - box.height - 12),
          ),
        });
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [menu.screen]);
  useEffect(() => {
    ref.current
      ?.querySelector(`[data-choice-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  if (!device || !port) return null;
  let group = "";
  return createPortal(
    <div className="connection-menu-backdrop" onPointerDown={close}>
      <div
        ref={ref}
        className="connection-menu"
        style={{ left: point.x, top: point.y }}
        role="dialog"
        aria-modal="true"
        aria-label={`Connect ${device.name} / ${port.name}`}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") close();
          if (e.key === "Tab") {
            const controls = e.currentTarget.querySelectorAll<HTMLElement>(
              "input,button:not(:disabled)",
            );
            const first = controls[0],
              last = controls[controls.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, choices.length - 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          }
          if (
            e.key === "Enter" &&
            e.target instanceof HTMLInputElement &&
            choices[active]
          ) {
            e.preventDefault();
            choose(choices[active]);
          }
        }}
      >
        <div className="connection-menu-heading">
          <Cable size={17} />
          <div>
            <strong>
              Connect {port.connector}{" "}
              {port.direction === "out" ? "input" : "output"}
            </strong>
            <small>
              {port.direction === "out" ? "From" : "To"} {device.name} /{" "}
              {port.name}
            </small>
          </div>
          <button
            className="icon-button"
            onClick={close}
            title="Cancel connection"
          >
            <X size={15} />
          </button>
        </div>
        <label className="connection-search">
          <Search size={15} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices or ports…"
            aria-label="Search compatible devices or ports"
          />
        </label>
        <div className="connection-context-label">
          Compatible ports only · {all.length} choices
        </div>
        <div
          className="connection-options"
          role="listbox"
          aria-label="Compatible connection options"
        >
          {choices.map((choice, index) => {
            const heading = group !== choice.group;
            group = choice.group;
            return (
              <div key={choice.key}>
                {heading && (
                  <div className="connection-option-group">{choice.group}</div>
                )}
                <button
                  className={`connection-option ${active === index ? "active" : ""}`}
                  role="option"
                  aria-selected={active === index}
                  data-choice-index={index}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(choice)}
                >
                  <DeviceIcon kind={choice.device.kind} size={19} />
                  <div>
                    <strong>{choice.label}</strong>
                    <small>
                      {choice.port.name} · {choice.port.connector}{" "}
                      {choice.port.direction === "in" ? "input" : "output"}
                    </small>
                  </div>
                  {choice.create ? (
                    <Plus size={14} />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                </button>
              </div>
            );
          })}
          {!choices.length && (
            <p className="connection-no-results">
              No compatible ports match. Try another device or add a compatible
              port to a device first.
            </p>
          )}
        </div>
        <div className="connection-menu-footer">
          ↑ ↓ browse · Enter connect · Esc cancel
          <br />
          Signal limits are checked after connecting.
        </div>
      </div>
    </div>,
    document.body,
  );
}
