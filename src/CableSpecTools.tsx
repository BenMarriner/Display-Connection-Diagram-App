import { ArrowUpRight } from "lucide-react";
import type { Cable, Project } from "./model";
import { Field } from "./components";
import { applyCablePreset, cablePresetMatches, cablePresets, cableProtocol } from "./cablePresets";

export default function CableSpecTools({ cable, project, update, notify }: {
  cable: Cable;
  project: Project;
  update: (cable: Cable) => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const protocol = cableProtocol(project, cable);
  const presets = cablePresets.filter((p) => p.protocol === protocol);
  const applied = presets.find((p) => cablePresetMatches(cable, p));
  const usesUsbC = project.devices.some((d) => d.ports.some((p) =>
    (p.id === cable.sourcePort || p.id === cable.targetPort) && p.connector === "USB-C"));
  return (
    <div className="cable-spec-tools">
      <Field label="Cable spec template">
        <select
          aria-label="Cable spec template"
          value={applied?.id ?? ""}
          onChange={(event) => {
            const preset = presets.find((p) => p.id === event.target.value);
            if (!preset) return update({ ...cable, presetId: null });
            try {
              update(applyCablePreset(project, cable, preset));
              notify(`Applied “${preset.name}” to ${cable.name || "cable"}.`);
            } catch (error) {
              notify(error instanceof Error ? error.message : "Could not apply cable template.", true);
            }
          }}
        >
          <option value="">Custom / entered specs</option>
          <optgroup label={`${protocol ?? "Video"} cable standards`}>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        </select>
      </Field>
      {applied ? (
        <div className="cable-template-description">
          <p className="inline-note">{applied.description}</p>
          <a className="back-button" href={applied.sourceUrl} target="_blank" rel="noreferrer">
            Cable standard reference <ArrowUpRight size={12} />
          </a>
        </div>
      ) : <p className="inline-note">Choose the certification on your cable or enter its verified rating below.</p>}
      <p className="inline-note">Templates set bandwidth limits. Your cable label, length, notes and feature settings are preserved.</p>
      {usesUsbC && <p className="inline-note">For USB-C, use a DisplayPort template only when the actual USB-C/DisplayPort cable declares that rating. Video lane allocation also limits bandwidth.</p>}
    </div>
  );
}
