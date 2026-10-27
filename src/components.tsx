import { useEffect, useState, type ReactNode } from "react";
import {
  Monitor,
  PcCase,
  Gamepad2,
  Projector,
  Split,
  ArrowLeftRight,
  Dock,
  Cable,
  Check,
  AlertTriangle,
  CircleHelp,
  Circle,
} from "lucide-react";
import type { Kind, Status, Feature } from "./model";

export const deviceIcons = {
  computer: PcCase,
  console: Gamepad2,
  monitor: Monitor,
  projector: Projector,
  switch: ArrowLeftRight,
  splitter: Split,
  dock: Dock,
  adapter: Cable,
};
export function DeviceIcon({ kind, size = 20 }: { kind: Kind; size?: number }) {
  const Icon = deviceIcons[kind];
  return <Icon size={size} strokeWidth={1.7} />;
}
export function StatusIcon({
  status,
  size = 14,
}: {
  status: Status;
  size?: number;
}) {
  const Icon =
    status === "supported"
      ? Check
      : status === "incompatible"
        ? AlertTriangle
        : status === "uncertain"
          ? CircleHelp
          : Circle;
  return <Icon size={size} />;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const props = {
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => {
      if (draft !== value) onChange(draft);
    },
  };
  return (
    <Field label={label}>
      {multiline ? (
        <textarea {...props} rows={3} />
      ) : (
        <input
          {...props}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      )}
    </Field>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  nullable = true,
  min = 0.001,
  max = Number.MAX_SAFE_INTEGER,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  nullable?: boolean;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);
  return (
    <Field label={label}>
      <input
        type="number"
        step="any"
        min={min}
        max={max}
        value={draft}
        placeholder="Unknown"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === "" && nullable) {
            if (value !== null) onChange(null);
          }
          else {
            const n = Number(draft);
            if (Number.isFinite(n) && n >= min && n <= max) {
              if (n !== value) onChange(n);
            }
            else setDraft(value === null ? "" : String(value));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </Field>
  );
}
export function FeatureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Feature;
  onChange: (v: Feature) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Feature)}
      >
        <option value="unknown">Unknown</option>
        <option value="yes">Supported</option>
        <option value="no">Not supported</option>
      </select>
    </Field>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}
